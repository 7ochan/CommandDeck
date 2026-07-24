'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { requestDeveloperHubTab } from '@/components/layout/developer-hub-navigation';
import { CommandDeckPaletteSource } from '@/features/command-deck/components/command-deck-palette-source';
import { useCommandDeck } from '@/features/command-deck/hooks/use-command-deck';
import { useRegisterHistoryPaletteActions } from '@/features/command-history/command-palette';
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
import { useRegisterWorkspacePaletteActions } from '@/features/workspaces/command-palette';
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
  /**
   * Workspaces that have been visited at least once.  We only mount a
   * <Terminal> (and therefore spawn a PTY) when the user first activates a
   * workspace.  Once mounted, the Terminal stays alive for the session so its
   * xterm buffer is preserved across switches.
   */
  const [activatedWorkspaceIds, setActivatedWorkspaceIds] = useState<
    ReadonlySet<string>
  >(() => new Set([activeWorkspace.workspaceId]));

  /**
   * Imperative handles keyed by workspace ID.  `runCommand` and
   * `closeWorkspaceSession` are always dispatched to the active workspace's
   * handle.
   */
  const terminalRefs = useRef(new Map<string, TerminalHandle>());

  const [terminalConnectionStatus, setTerminalConnectionStatus] =
    useState<TerminalConnectionStatus>('connecting');

  const {
    entries,
    paletteEntries,
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

  // Ensure the active workspace's terminal is always activated (lazy-spawn on
  // first visit; idempotent for subsequent selections).
  if (!activatedWorkspaceIds.has(activeWorkspace.workspaceId)) {
    setActivatedWorkspaceIds(
      (prev) => new Set([...prev, activeWorkspace.workspaceId]),
    );
  }

  const activeTerminal = useCallback(
    () => terminalRefs.current.get(activeWorkspace.workspaceId) ?? null,
    [activeWorkspace.workspaceId],
  );

  const runCommandAgain = useCallback(
    (command: string) => activeTerminal()?.runCommand(command) ?? false,
    [activeTerminal],
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

  const openHistoryEntry = useCallback(
    (commandId: string) => {
      selectEntry(commandId);
      requestDeveloperHubTab('history');
    },
    [selectEntry],
  );

  const handleDeleteWorkspace = useCallback(
    async (workspaceId: string) => {
      if (workspaceId !== activeWorkspace.workspaceId) {
        // Non-active workspace: delete from DB, close its PTY via the active
        // terminal's socket, then unmount the terminal.
        await onDeleteWorkspace(workspaceId);
        activeTerminal()?.closeWorkspaceSession(workspaceId);
        setActivatedWorkspaceIds((prev) => {
          const next = new Set(prev);
          next.delete(workspaceId);
          return next;
        });
        return;
      }

      // Active workspace: switch to a fallback first.
      const fallback = workspaces.find(
        (workspace) => workspace.workspaceId !== workspaceId,
      );

      if (!fallback) {
        throw new Error('The final Workspace cannot be deleted.');
      }

      // Activate the fallback terminal immediately (it may not have been
      // visited yet).  The CSS stack ensures it is visible right away via the
      // activeWorkspace prop change triggered by onSelectWorkspace.
      setActivatedWorkspaceIds((prev) => {
        if (prev.has(fallback.workspaceId)) return prev;
        return new Set([...prev, fallback.workspaceId]);
      });

      // Switch the active workspace in state (and in the DB).  This is
      // instant — no WS round-trip needed because each terminal maintains its
      // own persistent WebSocket connection.
      onSelectWorkspace(fallback.workspaceId);

      try {
        await onDeleteWorkspace(workspaceId);
        // Close the deleted workspace's PTY via the fallback terminal's socket.
        terminalRefs.current
          .get(fallback.workspaceId)
          ?.closeWorkspaceSession(workspaceId);
      } catch (error) {
        // Roll back: re-select the original workspace.
        onSelectWorkspace(workspaceId);
        throw error;
      }

      // Unmount the deleted terminal after the PTY close message is sent.
      setActivatedWorkspaceIds((prev) => {
        const next = new Set(prev);
        next.delete(workspaceId);
        return next;
      });
    },
    [
      activeTerminal,
      activeWorkspace.workspaceId,
      onDeleteWorkspace,
      onSelectWorkspace,
      workspaces,
    ],
  );

  useRegisterHistoryPaletteActions({
    entries: paletteEntries,
    onOpen: openHistoryEntry,
  });

  useRegisterWorkspacePaletteActions({
    workspaces,
    activeWorkspaceId: activeWorkspace.workspaceId,
    onSelect: onSelectWorkspace,
  });

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

      if (activeTerminal()?.runCommand(pendingExecution.command)) {
        clearPendingTimelineExecution();
        window.clearInterval(timerId);
      } else if (attempts >= 100) {
        window.clearInterval(timerId);
      }
    };
    const timerId = window.setInterval(executeWhenReady, 50);
    executeWhenReady();

    return () => window.clearInterval(timerId);
  }, [
    activeTerminal,
    activeWorkspace.workspaceId,
    onSelectWorkspace,
    workspaces,
  ]);

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
        {/*
         * Terminal stack: one <Terminal> per activated workspace.
         *
         * All terminals are kept mounted (never unmounted on switch) so their
         * xterm.js buffer — scrollback, cursor, colors — is fully preserved.
         * The inactive ones are hidden with `visibility: hidden` rather than
         * `display: none` so xterm can still measure the container dimensions
         * and the ResizeObserver keeps the PTY cols/rows in sync.
         *
         * The active workspace's terminal sits on top (z-10) and receives
         * pointer events.  Inactive terminals are pointer-inert and
         * aria-hidden so they are invisible to assistive technology.
         */}
        <div className="relative flex min-h-0 min-w-0 flex-1">
          {[...activatedWorkspaceIds].map((workspaceId) => {
            const isActive = workspaceId === activeWorkspace.workspaceId;
            return (
              <div
                key={workspaceId}
                className={
                  isActive
                    ? 'absolute inset-0 z-10 flex'
                    : 'absolute inset-0 z-0 flex'
                }
                style={isActive ? undefined : { visibility: 'hidden' }}
                aria-hidden={!isActive}
              >
                <Terminal
                  ref={(handle) => {
                    if (handle) {
                      terminalRefs.current.set(workspaceId, handle);
                    } else {
                      terminalRefs.current.delete(workspaceId);
                    }
                  }}
                  workspaceId={workspaceId}
                  active={isActive}
                  onCommandCompleted={
                    isActive ? handleCommandCompleted : undefined
                  }
                  onConnectionStatusChange={
                    isActive ? setTerminalConnectionStatus : undefined
                  }
                />
              </div>
            );
          })}
        </div>

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

      <CommandDeckPaletteSource
        key={activeWorkspace.workspaceId}
        items={deckItems}
        onRun={runCommandAgain}
      />
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
