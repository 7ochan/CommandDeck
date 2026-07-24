'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { requestDeveloperHubTab } from '@/components/layout/developer-hub-navigation';
import { CommandDeckPaletteSource } from '@/features/command-deck/components/command-deck-palette-source';
import { useCommandDeck } from '@/features/command-deck/hooks/use-command-deck';
import { useRegisterHistoryPaletteActions } from '@/features/command-history/command-palette';
import { useCommandHistory } from '@/features/command-history/hooks/use-command-history';
import { WorkspaceSwitcher } from '@/features/workspaces/components/workspace-switcher';
import { useRegisterWorkspacePaletteActions } from '@/features/workspaces/command-palette';
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces';
import type { WorkspaceSummary } from '@/shared/types';

import { queuePendingTimelineExecution } from '../pending-execution';
import { WorkspaceTimeline } from './workspace-timeline';

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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-stretch gap-3">
        <section className="flex min-w-0 flex-1 items-center justify-between rounded-xl border border-white/9 bg-[#090d14] px-5 py-3">
          <div>
            <p className="font-mono text-[9px] tracking-[0.14em] text-cyan-300/50 uppercase">
              Active Workspace
            </p>
            <h2 className="mt-1 text-sm font-medium text-slate-200">
              {activeWorkspace.name}
            </h2>
          </div>
          <div className="flex gap-5 text-right font-mono text-[9px] text-slate-600">
            <span>{activeWorkspace.historyCount} History</span>
            <span>{activeWorkspace.deckCount} Deck</span>
          </div>
        </section>
        <div className="w-[clamp(19rem,31vw,25rem)] shrink-0">
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            onSelect={onSelectWorkspace}
            onCreate={onCreateWorkspace}
            onRename={onRenameWorkspace}
            onDelete={onDeleteWorkspace}
          />
        </div>
      </div>

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
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-white/8 bg-[#070b11]">
      <p className={`text-xs ${isError ? 'text-rose-300' : 'text-slate-500'}`}>
        {message}
      </p>
    </div>
  );
}
