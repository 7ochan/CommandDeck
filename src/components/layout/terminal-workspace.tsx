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
import { RenameWorkspaceDialog } from '@/features/workspaces/components/rename-workspace-dialog';
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

  const { settings, updateSettings } = useSettings();
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

  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 240;
    try {
      const stored = localStorage.getItem('cmd-deck-left-sidebar-width');
      return stored ? Math.max(160, Math.min(480, Number(stored))) : 240;
    } catch {
      return 240;
    }
  });

  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 256;
    try {
      const stored = localStorage.getItem('cmd-deck-right-sidebar-width');
      return stored ? Math.max(180, Math.min(540, Number(stored))) : 256;
    } catch {
      return 256;
    }
  });

  const isDraggingLeftRef = useRef(false);
  const isDraggingRightRef = useRef(false);

  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingLeftRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingLeftRef.current) return;
      const newWidth = Math.max(160, Math.min(480, moveEvent.clientX));
      setLeftSidebarWidth(newWidth);
      window.dispatchEvent(new Event('resize'));
    };

    const onMouseUp = () => {
      isDraggingLeftRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.dispatchEvent(new Event('resize'));

      setLeftSidebarWidth((current) => {
        try {
          localStorage.setItem('cmd-deck-left-sidebar-width', String(current));
        } catch {}
        return current;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleLeftResizeReset = useCallback(() => {
    setLeftSidebarWidth(240);
    try {
      localStorage.setItem('cmd-deck-left-sidebar-width', '240');
    } catch {}
    window.dispatchEvent(new Event('resize'));
  }, []);

  const handleRightResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRightRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRightRef.current) return;
      const newWidth = Math.max(
        180,
        Math.min(540, window.innerWidth - moveEvent.clientX),
      );
      setRightSidebarWidth(newWidth);
      window.dispatchEvent(new Event('resize'));
    };

    const onMouseUp = () => {
      isDraggingRightRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.dispatchEvent(new Event('resize'));

      setRightSidebarWidth((current) => {
        try {
          localStorage.setItem('cmd-deck-right-sidebar-width', String(current));
        } catch {}
        return current;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleRightResizeReset = useCallback(() => {
    setRightSidebarWidth(256);
    try {
      localStorage.setItem('cmd-deck-right-sidebar-width', '256');
    } catch {}
    window.dispatchEvent(new Event('resize'));
  }, []);

  const [terminalConnectionStatus, setTerminalConnectionStatus] =
    useState<TerminalConnectionStatus>('connecting');

  const [renamingWorkspace, setRenamingWorkspace] =
    useState<WorkspaceSummary | null>(null);

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
    createCustomItem,
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

  const handleSelectWorkspace = useCallback(
    (workspaceId: string) => {
      onSelectWorkspace(workspaceId);
      setTimeout(() => {
        terminalRefs.current.get(workspaceId)?.focus();
      }, 0);
    },
    [onSelectWorkspace],
  );

  const runCommandAgain = useCallback(
    (command: string) => {
      const term = activeTerminal();
      const result = term?.runCommand(command) ?? false;
      setTimeout(() => {
        term?.focus();
      }, 0);
      return result;
    },
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
      setRenamingWorkspace(activeWorkspace);
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

    const unbindToggleSidebar = setActionHandler('app.toggleSidebar', () => {
      updateSettings({
        general: { showRightSidebar: !settings.general.showRightSidebar },
      });
    });

    const unbindSearchCommands = setActionHandler(
      'developerHub.searchCommands',
      () => {
        if (!settings.general.showRightSidebar) {
          updateSettings({ general: { showRightSidebar: true } });
        }
        requestDeveloperHubTab('deck');
      },
    );

    const unbindSearchTemplates = setActionHandler(
      'developerHub.searchTemplates',
      () => {
        if (!settings.general.showRightSidebar) {
          updateSettings({ general: { showRightSidebar: true } });
        }
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
      unbindToggleSidebar();
      unbindSearchCommands();
      unbindSearchTemplates();
      unbindGoBack();
      unbindGoForward();
    };
  }, [
    activeTerminal,
    activeWorkspace,
    handleDeleteWorkspace,
    handleQuickCreate,
    onRenameWorkspace,
    onSelectWorkspace,
    setActionHandler,
    settings.general.showRightSidebar,
    updateSettings,
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
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
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
        <>
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
              width={leftSidebarWidth}
              onSelect={handleSelectWorkspace}
              onCreate={onCreateWorkspace}
              onRename={onRenameWorkspace}
              onDelete={handleDeleteWorkspace}
            />
          </div>

          {/* Left Sidebar Resizer Divider */}
          {!isLeftOverlay && (
            <div
              className="group relative z-30 flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-[var(--border-soft)] transition-colors hover:bg-[var(--accent)] active:bg-[var(--accent)]"
              onMouseDown={handleLeftResizeStart}
              onDoubleClick={handleLeftResizeReset}
              title="Drag to resize Left Sidebar (Double-click to reset)"
              aria-label="Resize Left Sidebar"
              role="separator"
            >
              <div className="h-6 w-0.5 rounded-full bg-[var(--text-subtle)] opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          )}
        </>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Main Terminal Shell + Status Bar Container */}
        <div
          className="cd-terminal-shell relative flex min-h-0 min-w-0 flex-1 cursor-text flex-col overflow-hidden rounded-none border-0 bg-[var(--terminal)]"
          onClick={() => {
            activeTerminal()?.focus();
          }}
        >
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
                      ? 'absolute inset-0 z-10 flex px-2 py-1'
                      : 'absolute inset-0 z-0 flex px-2 py-1'
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
        </div>

        {/* Right Sidebar (Developer Hub) */}
        {isRightVisible && (
          <>
            {/* Right Sidebar Resizer Divider */}
            {!isRightOverlay && (
              <div
                className="group relative z-30 flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-[var(--border-soft)] transition-colors hover:bg-[var(--accent)] active:bg-[var(--accent)]"
                onMouseDown={handleRightResizeStart}
                onDoubleClick={handleRightResizeReset}
                title="Drag to resize Right Sidebar (Double-click to reset)"
                aria-label="Resize Right Sidebar"
                role="separator"
              >
                <div className="h-6 w-0.5 rounded-full bg-[var(--text-subtle)] opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            )}

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
                width={rightSidebarWidth}
                onHistorySearchTermChange={setSearchTerm}
                onToggleHistoryStatus={toggleStatus}
                onClearHistoryQuery={clearQuery}
                onSelectHistoryEntry={selectEntry}
                onClearHistorySelection={clearSelection}
                onAddHistoryToDeck={handleAddToDeck}
                onCreateDeckItem={createCustomItem}
                onUpdateDeckItem={updateItem}
                onRemoveDeckItem={handleRemoveFromDeck}
                onRunCommand={runCommandAgain}
              />
            </div>
          </>
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

      <RenameWorkspaceDialog
        workspace={renamingWorkspace}
        isOpen={Boolean(renamingWorkspace)}
        onRename={onRenameWorkspace}
        onClose={() => setRenamingWorkspace(null)}
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
