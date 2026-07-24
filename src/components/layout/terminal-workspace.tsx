'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useCommandDeck } from '@/features/command-deck/hooks/use-command-deck';
import { useCommandHistory } from '@/features/command-history/hooks/use-command-history';
import {
  Terminal,
  type TerminalHandle,
  type TerminalConnectionStatus,
} from '@/features/terminal/components/terminal';
import {
  clearPendingTimelineExecution,
  loadPendingTimelineExecution,
} from '@/features/timeline/pending-execution';
import { WorkspaceSwitcher } from '@/features/workspaces/components/workspace-switcher';
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces';
import type { CommandCompletedPayload, WorkspaceSummary } from '@/shared/types';

import { DeveloperHub } from './developer-hub';

const CONNECTION_STATUS_PRESENTATION: Record<
  TerminalConnectionStatus,
  { label: string; tone: 'connected' | 'pending' | 'offline' | 'error' }
> = {
  connecting: { label: 'Connecting', tone: 'pending' },
  switching: { label: 'Switching', tone: 'pending' },
  connected: { label: 'Connected', tone: 'connected' },
  disconnected: { label: 'Disconnected', tone: 'offline' },
  error: { label: 'Connection error', tone: 'error' },
  exited: { label: 'Shell exited', tone: 'offline' },
};

export function TerminalWorkspace() {
  const workspacesState = useWorkspaces();

  if (workspacesState.isLoading) {
    return <WorkspaceLoadingState message="Loading Workspaces…" />;
  }

  if (!workspacesState.activeWorkspace) {
    return (
      <WorkspaceLoadingState
        message={workspacesState.loadError ?? 'No Workspace is available.'}
        isError
      />
    );
  }

  return (
    <ActiveWorkspaceLayout
      workspaces={workspacesState.workspaces}
      activeWorkspace={workspacesState.activeWorkspace}
      onSelectWorkspace={workspacesState.selectWorkspace}
      onCreateWorkspace={workspacesState.createWorkspace}
      onRenameWorkspace={workspacesState.renameWorkspace}
      onDeleteWorkspace={workspacesState.deleteWorkspace}
      onRefreshWorkspaces={workspacesState.refreshWorkspaces}
    />
  );
}

type ActiveWorkspaceLayoutProps = {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<WorkspaceSummary>;
  onRenameWorkspace: (
    workspaceId: string,
    name: string,
  ) => Promise<WorkspaceSummary>;
  onDeleteWorkspace: (workspaceId: string) => Promise<void>;
  onRefreshWorkspaces: () => Promise<void>;
};

function ActiveWorkspaceLayout({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onRefreshWorkspaces,
}: ActiveWorkspaceLayoutProps) {
  const terminalRef = useRef<TerminalHandle>(null);
  const [terminalConnectionStatus, setTerminalConnectionStatus] =
    useState<TerminalConnectionStatus>('connecting');
  const {
    entries,
    selectedEntryId,
    query,
    isLoading,
    isSearching,
    loadError,
    addCompletedCommand,
    setSearchTerm,
    toggleStatus,
    clearQuery,
    selectEntry,
    clearSelection,
  } = useCommandHistory(activeWorkspace.workspaceId);
  const {
    items: deckItems,
    isLoading: isDeckLoading,
    loadError: deckLoadError,
    addFromHistory,
    updateItem,
    removeItem,
  } = useCommandDeck(activeWorkspace.workspaceId);
  const runCommandAgain = useCallback(
    (command: string) => terminalRef.current?.runCommand(command) ?? false,
    [],
  );
  const handleCommandCompleted = useCallback(
    (command: CommandCompletedPayload) => {
      addCompletedCommand(command);
      void onRefreshWorkspaces();
    },
    [addCompletedCommand, onRefreshWorkspaces],
  );
  const handleAddToDeck = useCallback(
    async (historyId: string) => {
      await addFromHistory(historyId);
      void onRefreshWorkspaces();
    },
    [addFromHistory, onRefreshWorkspaces],
  );
  const handleRemoveFromDeck = useCallback(
    async (deckItemId: string) => {
      await removeItem(deckItemId);
      void onRefreshWorkspaces();
    },
    [onRefreshWorkspaces, removeItem],
  );
  const handleDeleteWorkspace = useCallback(
    async (workspaceId: string) => {
      if (workspaceId !== activeWorkspace.workspaceId) {
        await onDeleteWorkspace(workspaceId);
        return;
      }

      const fallback = workspaces.find(
        (workspace) => workspace.workspaceId !== workspaceId,
      );

      if (!fallback) {
        throw new Error('The final Workspace cannot be deleted.');
      }

      const terminalSelected = await terminalRef.current?.selectWorkspace(
        fallback.workspaceId,
      );

      if (!terminalSelected) {
        throw new Error(
          'Wait for the terminal to connect before deleting the active Workspace.',
        );
      }

      try {
        await onDeleteWorkspace(workspaceId);
      } catch (error) {
        await terminalRef.current?.selectWorkspace(workspaceId);
        throw error;
      }
    },
    [activeWorkspace.workspaceId, onDeleteWorkspace, workspaces],
  );

  useEffect(() => {
    const pendingExecution = loadPendingTimelineExecution();

    if (!pendingExecution) {
      return;
    }

    if (
      !workspaces.some(
        ({ workspaceId }) => workspaceId === pendingExecution.workspaceId,
      )
    ) {
      clearPendingTimelineExecution();
      return;
    }

    if (pendingExecution.workspaceId !== activeWorkspace.workspaceId) {
      onSelectWorkspace(pendingExecution.workspaceId);
      return;
    }

    let attempts = 0;
    const executeWhenReady = () => {
      attempts += 1;

      if (terminalRef.current?.runCommand(pendingExecution.command)) {
        clearPendingTimelineExecution();
        window.clearInterval(timerId);
      } else if (attempts >= 100) {
        window.clearInterval(timerId);
      }
    };
    const timerId = window.setInterval(executeWhenReady, 50);
    executeWhenReady();

    return () => window.clearInterval(timerId);
  }, [activeWorkspace.workspaceId, onSelectWorkspace, workspaces]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <WorkspaceSwitcher
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        connectionStatus={
          CONNECTION_STATUS_PRESENTATION[terminalConnectionStatus]
        }
        onSelect={onSelectWorkspace}
        onCreate={onCreateWorkspace}
        onRename={onRenameWorkspace}
        onDelete={handleDeleteWorkspace}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
        <Terminal
          ref={terminalRef}
          workspaceId={activeWorkspace.workspaceId}
          onCommandCompleted={handleCommandCompleted}
          onConnectionStatusChange={setTerminalConnectionStatus}
        />
        <DeveloperHub
          deckItems={deckItems}
          isDeckLoading={isDeckLoading}
          deckLoadError={deckLoadError}
          historyEntries={entries}
          selectedHistoryEntryId={selectedEntryId}
          historyQuery={query}
          isHistoryLoading={isLoading}
          isHistorySearching={isSearching}
          historyLoadError={loadError}
          onHistorySearchTermChange={setSearchTerm}
          onToggleHistoryStatus={toggleStatus}
          onClearHistoryQuery={clearQuery}
          onSelectHistoryEntry={selectEntry}
          onClearHistorySelection={clearSelection}
          onAddHistoryToDeck={handleAddToDeck}
          onUpdateDeckItem={updateItem}
          onRemoveDeckItem={handleRemoveFromDeck}
          onRunCommand={runCommandAgain}
        />
      </div>
    </div>
  );
}

function WorkspaceLoadingState({
  message,
  isError = false,
}: {
  message: string;
  isError?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-white/8 bg-[#070b11]">
      <p className={`text-xs ${isError ? 'text-rose-300' : 'text-slate-500'}`}>
        {message}
      </p>
    </div>
  );
}
