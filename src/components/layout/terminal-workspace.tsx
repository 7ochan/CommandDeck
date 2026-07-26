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
import { useSettings } from '@/features/settings/settings-provider';
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

  const { settings } = useSettings();
  const { showLeftSidebar, showRightSidebar, hoverToRevealSidebars } =
    settings.general;

  const [isLeftHovered, setIsLeftHovered] = useState(false);
  const [isRightHovered, setIsRightHovered] = useState(false);

  const isLeftVisible =
    showLeftSidebar || (hoverToRevealSidebars && isLeftHovered);
  const isRightVisible =
    showRightSidebar || (hoverToRevealSidebars && isRightHovered);
  const isLeftOverlay = !showLeftSidebar && isLeftVisible;
  const isRightOverlay = !showRightSidebar && isRightVisible;

  const [terminalConnectionStatus, setTerminalConnectionStatus] =
    useState<TerminalConnectionStatus>('connecting');

  const [commandInputValue, setCommandInputValue] = useState('');
  const [localHistory, setLocalHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const warpInputRef = useRef<HTMLInputElement>(null);

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const command = commandInputValue.trim();
    if (!command) return;

    const activeHandle = terminalRefs.current.get(activeWorkspace.workspaceId);
    if (activeHandle) {
      activeHandle.runCommand(command);
    }

    setLocalHistory((prev) => [command, ...prev]);
    setHistoryIndex(-1);
    setCommandInputValue('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (localHistory.length === 0) return;
      const nextIndex = Math.min(historyIndex + 1, localHistory.length - 1);
      setHistoryIndex(nextIndex);
      setCommandInputValue(localHistory[nextIndex] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setCommandInputValue('');
      } else {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setCommandInputValue(localHistory[nextIndex] ?? '');
      }
    }
  };

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
    <div className="relative flex min-h-0 flex-1 gap-2.5 overflow-hidden">
      {/* Left Edge Hover Trigger Zone */}
      {!showLeftSidebar && hoverToRevealSidebars && !isLeftHovered && (
        <div
          className="absolute top-0 bottom-0 left-0 z-40 w-4 cursor-pointer"
          onMouseEnter={() => setIsLeftHovered(true)}
          title="Hover to show Workspaces"
        />
      )}

      {/* Left Sidebar (Workspace Switcher) */}
      {isLeftVisible && (
        <div
          className={
            isLeftOverlay
              ? 'absolute top-0 bottom-0 left-0 z-50 flex shadow-2xl transition-transform duration-200'
              : 'flex shrink-0'
          }
          onMouseLeave={
            isLeftOverlay ? () => setIsLeftHovered(false) : undefined
          }
        >
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
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-2.5 overflow-hidden">
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

          {/* Warp-Style Bottom Context & Exclusive Typing Panel */}
          <div
            className="shrink-0 cursor-text border-t border-[var(--border-soft)] bg-[var(--canvas-raised)] p-3"
            onClick={() => warpInputRef.current?.focus()}
          >
            {/* Top Row: Context Badges */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border-soft)] bg-[var(--surface-2)] px-2.5 py-1 text-[var(--text-primary)]">
                <Icon
                  name="workspace"
                  size={12}
                  className="text-[var(--text-muted)]"
                />
                ~/desktop/{activeWorkspace.name}
              </span>
              <span className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border-soft)] bg-[var(--surface-2)] px-2.5 py-1 text-[var(--text-secondary)]">
                <Icon
                  name="branch"
                  size={11}
                  className="text-[var(--text-muted)]"
                />
                main
              </span>
              <span className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border-soft)] bg-[var(--surface-2)] px-2.5 py-1 text-[var(--text-muted)]">
                v22.0.0
              </span>
              <span className="rounded-[6px] border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1 text-[var(--text-subtle)]">
                ± 0
              </span>
            </div>

            {/* Middle Row: Exclusive Interactive Warp Typing Bar */}
            <form
              onSubmit={handleInputSubmit}
              className="mt-2.5 flex items-center gap-2.5 rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-1)] px-3 py-2 transition-colors focus-within:border-[var(--border-strong)]"
            >
              <span className="font-mono text-[13px] font-bold text-[var(--text-primary)] select-none">
                ❯
              </span>
              <input
                ref={warpInputRef}
                type="text"
                value={commandInputValue}
                onChange={(e) => setCommandInputValue(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Enter shell command or script…"
                className="w-full bg-transparent font-mono text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-subtle)]"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
              {commandInputValue ? (
                <button
                  type="submit"
                  className="cd-button cd-button--primary h-6 min-h-0 shrink-0 px-2 font-mono text-[10px]"
                >
                  Run ↵
                </button>
              ) : (
                <span className="cd-kbd shrink-0 text-[9px]">↵ Run</span>
              )}
            </form>

            {/* Bottom Row: Helpers & Shortcut Badges */}
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[var(--text-subtle)]">
              <span className="flex items-center gap-2">
                <span>↑/↓ History</span>
                <span>·</span>
                <span>Esc Clear</span>
              </span>
              <span className="flex items-center gap-2">
                <span>⌘K Commands</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Sidebar (Developer Hub) */}
        {isRightVisible && (
          <div
            className={
              isRightOverlay
                ? 'absolute top-0 right-0 bottom-0 z-50 flex shadow-2xl transition-transform duration-200'
                : 'flex shrink-0'
            }
            onMouseLeave={
              isRightOverlay ? () => setIsRightHovered(false) : undefined
            }
          >
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
        )}
      </div>

      {/* Right Edge Hover Trigger Zone */}
      {!showRightSidebar && hoverToRevealSidebars && !isRightHovered && (
        <div
          className="absolute top-0 right-0 bottom-0 z-40 w-4 cursor-pointer"
          onMouseEnter={() => setIsRightHovered(true)}
          title="Hover to show Developer Hub"
        />
      )}

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
