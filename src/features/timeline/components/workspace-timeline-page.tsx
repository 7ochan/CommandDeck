'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { requestDeveloperHubTab } from '@/components/layout/developer-hub-navigation';
import { Icon } from '@/components/ui/icon';
import { CommandDeckPaletteSource } from '@/features/command-deck/components/command-deck-palette-source';
import { useCommandDeck } from '@/features/command-deck/hooks/use-command-deck';
import { useRegisterHistoryPaletteActions } from '@/features/command-history/command-palette';
import { useCommandHistory } from '@/features/command-history/hooks/use-command-history';
import { useSettings } from '@/features/settings/settings-provider';
import { WorkspaceSwitcher } from '@/features/workspaces/components/workspace-switcher';
import { useRegisterWorkspacePaletteActions } from '@/features/workspaces/command-palette';
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces';
import type { WorkspaceSummary } from '@/shared/types';

import { queuePendingTimelineExecution } from '../pending-execution.ts';
import { WorkspaceTimeline } from './workspace-timeline.tsx';

export function WorkspaceTimelinePage() {
  const workspacesState = useWorkspaces();

  if (workspacesState.isLoading) {
    return <TimelinePageState message="Loading Workspaces…" />;
  }

  if (!workspacesState.activeWorkspace) {
    return (
      <TimelinePageState
        message={workspacesState.loadError ?? 'No Workspace is available.'}
        isError
      />
    );
  }

  return (
    <ActiveWorkspaceTimeline
      key={workspacesState.activeWorkspace.workspaceId}
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

type ActiveWorkspaceTimelineProps = {
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

function ActiveWorkspaceTimeline({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onRefreshWorkspaces,
}: ActiveWorkspaceTimelineProps) {
  const router = useRouter();
  const history = useCommandHistory(activeWorkspace.workspaceId);
  const selectHistoryEntry = history.selectEntry;
  const { items: deckItems, addFromHistory } = useCommandDeck(
    activeWorkspace.workspaceId,
  );
  const { settings } = useSettings();
  const { showLeftSidebar, hoverToRevealSidebars } = settings.general;
  const [isLeftHovered, setIsLeftHovered] = useState(false);
  const isLeftVisible =
    showLeftSidebar || (hoverToRevealSidebars && isLeftHovered);
  const isLeftOverlay = !showLeftSidebar && isLeftVisible;

  const deckHistoryIds = useMemo(
    () =>
      new Set(
        deckItems.flatMap(({ sourceHistoryId }) =>
          sourceHistoryId ? [sourceHistoryId] : [],
        ),
      ),
    [deckItems],
  );
  const addToDeck = useCallback(
    async (historyId: string) => {
      await addFromHistory(historyId);
      void onRefreshWorkspaces();
    },
    [addFromHistory, onRefreshWorkspaces],
  );
  const runAgain = useCallback(
    (command: string) => {
      try {
        queuePendingTimelineExecution({
          workspaceId: activeWorkspace.workspaceId,
          command,
        });
        router.push('/');
        return true;
      } catch {
        return false;
      }
    },
    [activeWorkspace.workspaceId, router],
  );
  const openHistoryEntry = useCallback(
    (commandId: string) => {
      selectHistoryEntry(commandId);
      requestDeveloperHubTab('history');
      router.push('/');
    },
    [router, selectHistoryEntry],
  );

  useRegisterHistoryPaletteActions({
    entries: history.paletteEntries,
    onOpen: openHistoryEntry,
  });
  useRegisterWorkspacePaletteActions({
    workspaces,
    activeWorkspaceId: activeWorkspace.workspaceId,
    onSelect: onSelectWorkspace,
  });

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
            onSelect={onSelectWorkspace}
            onCreate={onCreateWorkspace}
            onRename={onRenameWorkspace}
            onDelete={onDeleteWorkspace}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <section className="cd-surface cd-surface--toolbar flex shrink-0 items-center justify-between gap-3 rounded-none border-b border-[var(--border-soft)] bg-[var(--surface-1)] px-4 py-2 shadow-none">
          <div className="flex items-center gap-3">
            <span className="cd-clay-tile cd-clay-tile--info flex size-7 shrink-0 items-center justify-center rounded-sm">
              <Icon name="timeline" size={15} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">
                Workspace Timeline
              </h2>
              <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                {activeWorkspace.name}
                <span className="mx-1.5 text-[var(--text-subtle)]">·</span>
                {activeWorkspace.historyCount} captured commands
              </p>
            </div>
          </div>
        </section>

        <WorkspaceTimeline
          entries={history.entries}
          deckHistoryIds={deckHistoryIds}
          query={history.query}
          isLoading={history.isLoading}
          isSearching={history.isSearching}
          loadError={history.loadError}
          onSearchTermChange={history.setSearchTerm}
          onToggleStatus={history.toggleStatus}
          onClearQuery={history.clearQuery}
          onRunAgain={runAgain}
          onAddToDeck={addToDeck}
        />
      </div>

      <CommandDeckPaletteSource items={deckItems} onRun={runAgain} />
    </div>
  );
}

function TimelinePageState({
  message,
  isError = false,
}: {
  message: string;
  isError?: boolean;
}) {
  return (
    <div className="cd-surface flex min-h-0 flex-1 items-center justify-center rounded-none">
      <p
        className={`text-[12px] ${isError ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}
      >
        {message}
      </p>
    </div>
  );
}
