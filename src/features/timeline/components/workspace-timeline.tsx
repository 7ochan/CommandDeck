'use client';

import { useCallback, useMemo, useState } from 'react';

import { HistorySearchControls } from '@/features/command-history/components/history-search-controls';
import { hasActiveCommandHistoryQuery } from '@/shared/history-status';
import type {
  CommandHistoryEntry,
  CommandHistoryQuery,
  CommandHistoryStatus,
} from '@/shared/types';

import { groupHistoryIntoActivitySessions } from '../activity-sessions';
import { ActivitySession } from './activity-session';
import { TimelineEventDetails } from './timeline-event-details';

type WorkspaceTimelineProps = {
  entries: CommandHistoryEntry[];
  deckHistoryIds: ReadonlySet<string>;
  query: CommandHistoryQuery;
  isLoading: boolean;
  isSearching: boolean;
  loadError: string | null;
  onSearchTermChange: (searchTerm: string) => void;
  onToggleStatus: (status: CommandHistoryStatus) => void;
  onClearQuery: () => void;
  onRunAgain: (command: string) => boolean;
  onAddToDeck: (historyId: string) => Promise<void>;
};

export function WorkspaceTimeline({
  entries,
  deckHistoryIds,
  query,
  isLoading,
  isSearching,
  loadError,
  onSearchTermChange,
  onToggleStatus,
  onClearQuery,
  onRunAgain,
  onAddToDeck,
}: WorkspaceTimelineProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const sessions = useMemo(
    () => groupHistoryIntoActivitySessions(entries).toReversed(),
    [entries],
  );
  const selectedEntry = useMemo(
    () =>
      entries.find(({ commandId }) => commandId === selectedEventId) ?? null,
    [entries, selectedEventId],
  );
  const selectEvent = useCallback((commandId: string) => {
    setSelectedEventId(commandId);
  }, []);
  const hasActiveQuery = hasActiveCommandHistoryQuery(query);

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/9 bg-[#070b11] shadow-2xl shadow-black/20">
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-xs font-medium text-slate-200">
                Workspace Timeline
              </h2>
              <span className="rounded-full bg-white/6 px-2 py-0.5 font-mono text-[9px] text-slate-500">
                {entries.length} events
              </span>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-600">
              {sessions.length} Activity Session
              {sessions.length === 1 ? '' : 's'} from immutable History
            </p>
          </div>
          <span className="font-mono text-[8px] tracking-wide text-slate-700 uppercase">
            Newest sessions first
          </span>
        </div>

        <HistorySearchControls
          query={query}
          isSearching={isSearching}
          onSearchTermChange={onSearchTermChange}
          onToggleStatus={onToggleStatus}
        />

        {entries.length === 0 ? (
          <TimelineEmptyState
            isLoading={isLoading}
            isSearching={isSearching}
            loadError={loadError}
            hasActiveQuery={hasActiveQuery}
            onClearQuery={onClearQuery}
          />
        ) : (
          <div className="command-history-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
            {loadError && (
              <p className="mb-3 rounded-lg border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-[10px] text-amber-200/70">
                {loadError}
              </p>
            )}
            <div className="space-y-3">
              {sessions.map((session, index) => (
                <ActivitySession
                  key={session.sessionId}
                  session={session}
                  defaultExpanded={index === 0}
                  selectedEventId={selectedEntry?.commandId ?? null}
                  searchTerm={query.searchTerm}
                  onSelectEvent={selectEvent}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <TimelineEventDetails
        entry={selectedEntry}
        isInDeck={
          selectedEntry ? deckHistoryIds.has(selectedEntry.commandId) : false
        }
        onClose={() => setSelectedEventId(null)}
        onRunAgain={onRunAgain}
        onAddToDeck={onAddToDeck}
      />
    </div>
  );
}

function TimelineEmptyState({
  isLoading,
  isSearching,
  loadError,
  hasActiveQuery,
  onClearQuery,
}: {
  isLoading: boolean;
  isSearching: boolean;
  loadError: string | null;
  hasActiveQuery: boolean;
  onClearQuery: () => void;
}) {
  const title = isLoading
    ? 'Loading Timeline'
    : isSearching
      ? 'Updating Timeline'
      : loadError
        ? 'Timeline unavailable'
        : hasActiveQuery
          ? 'No matching Timeline events'
          : 'Your Timeline starts with the next command';

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="font-mono text-xl text-cyan-300/40" aria-hidden="true">
        {isLoading || isSearching ? '…' : '◷'}
      </span>
      <h3 className="mt-3 text-xs font-medium text-slate-300">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[10px] leading-4 text-slate-600">
        {loadError ??
          (hasActiveQuery
            ? 'Try another command, directory, or status.'
            : 'Completed History entries become Timeline events automatically.')}
      </p>
      {!isLoading && !isSearching && !loadError && hasActiveQuery && (
        <button
          type="button"
          className="mt-3 rounded-md border border-cyan-300/20 bg-cyan-300/8 px-3 py-1.5 text-[10px] text-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:outline-none"
          onClick={onClearQuery}
        >
          Clear search and filters
        </button>
      )}
    </div>
  );
}
