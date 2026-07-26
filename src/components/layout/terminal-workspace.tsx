'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { requestDeveloperHubTab } from '@/components/layout/developer-hub-navigation';
import { Icon } from '@/components/ui/icon';
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
import { useKeybindings } from '@/features/keybindings/keybindings-provider';
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

  const { setActionHandler } = useKeybindings();

  const handleQuickCreate = useCallback(async () => {
    const defaultName = `Session ${workspaces.length + 1}`;
    const created = await onCreateWorkspace(defaultName);
    onSelectWorkspace(created.workspaceId);
  }, [onCreateWorkspace, onSelectWorkspace, workspaces.length]);

  useEffect(() => {
    const unbindNewWorkspace = setActionHandler('workspace.new', () => {
      void handleQuickCreate();
    });

    const unbindCloseWorkspace = setActionHandler('workspace.close', () => {
      void handleDeleteWorkspace(activeWorkspace.workspaceId);
    });

    const unbindRenameWorkspace = setActionHandler('workspace.rename', () => {
      const name = window.prompt('Rename Workspace:', activeWorkspace.name);
      if (name?.trim() && name.trim() !== activeWorkspace.name) {
        void onRenameWorkspace(activeWorkspace.workspaceId, name.trim());
      }
    });

    const unbindNextWorkspace = setActionHandler('workspace.next', () => {
      const idx = workspaces.findIndex(
        (w) => w.workspaceId === activeWorkspace.workspaceId,
      );
      if (idx !== -1 && workspaces.length > 1) {
        const nextWs = workspaces[(idx + 1) % workspaces.length];
        onSelectWorkspace(nextWs.workspaceId);
      }
    });

    const unbindPreviousWorkspace = setActionHandler(
      'workspace.previous',
      () => {
        const idx = workspaces.findIndex(
          (w) => w.workspaceId === activeWorkspace.workspaceId,
        );
        if (idx !== -1 && workspaces.length > 1) {
          const prevWs =
            workspaces[(idx - 1 + workspaces.length) % workspaces.length];
          onSelectWorkspace(prevWs.workspaceId);
        }
      },
    );

    const unbindFocusTerminal = setActionHandler('terminal.focus', () => {
      activeTerminal()?.focus();
    });

    const unbindClearTerminal = setActionHandler('terminal.clear', () => {
      activeTerminal()?.clear();
    });

    const unbindSearchCommands = setActionHandler(
      'developerHub.searchCommands',
      () => {
        requestDeveloperHubTab('deck');
      },
    );

    const unbindSearchTemplates = setActionHandler(
      'developerHub.searchTemplates',
      () => {
        requestDeveloperHubTab('deck');
      },
    );

    const unbindGoBack = setActionHandler('navigation.goBack', () => {
      window.history.back();
    });

    const unbindGoForward = setActionHandler('navigation.goForward', () => {
      window.history.forward();
    });

    return () => {
      unbindNewWorkspace();
      unbindCloseWorkspace();
      unbindRenameWorkspace();
      unbindNextWorkspace();
      unbindPreviousWorkspace();
      unbindFocusTerminal();
      unbindClearTerminal();
      unbindSearchCommands();
      unbindSearchTemplates();
      unbindGoBack();
      unbindGoForward();
    };
  }, [
    activeTerminal,
    activeWorkspace.name,
    activeWorkspace.workspaceId,
    handleDeleteWorkspace,
    handleQuickCreate,
    onRenameWorkspace,
    onSelectWorkspace,
    setActionHandler,
    workspaces,
  ]);

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
    <div className="flex min-h-0 flex-1 gap-2.5 overflow-hidden">
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

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 lg:flex-row">
        {/* Main Terminal Shell + Status Bar Container */}
        <div className="cd-terminal-shell relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[15px] border border-[var(--border-soft)] bg-[var(--terminal)]">
          {/*
           * Terminal stack: one <Terminal> per activated workspace.
           */}
          <div className="relative flex min-h-0 min-w-0 flex-1">
            {[...activatedWorkspaceIds].map((workspaceId) => {
              const isActive = workspaceId === activeWorkspace.workspaceId;
              return (
                <div
                  key={workspaceId}
                  className={
                    isActive
                      ? 'absolute inset-0 z-10 flex p-2.5 sm:p-3.5'
                      : 'absolute inset-0 z-0 flex p-2.5 sm:p-3.5'
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

          {/* Bottom Status Bar matching user screenshot */}
          <div className="shrink-0 border-t border-[var(--border-soft)] bg-[var(--canvas-raised)] px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="flex items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-0.5 text-[var(--text-primary)]">
                <span className="size-1.5 rounded-full bg-[var(--text-muted)]" />
                v22.0.0
              </span>
              <span className="flex items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-0.5 text-[var(--text-primary)]">
                <Icon name="workspace" size={12} />
                ~/desktop/{activeWorkspace.name}
              </span>
              <span className="flex items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-0.5 text-[var(--text-muted)]">
                <Icon name="branch" size={11} />
                main
              </span>
              <span className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-0.5 text-[var(--text-subtle)]">
                ± 0
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-[var(--text-subtle)]">
              <span>Run commands</span>
              <span>⌘ ↵ new /agent conversation</span>
            </div>
          </div>
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
    <div className="cd-surface flex min-h-0 flex-1 items-center justify-center rounded-[13px]">
      <p
        className={`text-[12px] ${isError ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}
      >
        {message}
      </p>
    </div>
  );
}
