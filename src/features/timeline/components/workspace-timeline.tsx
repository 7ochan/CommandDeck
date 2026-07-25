'use client';

import { useCallback, useMemo, useState } from 'react';

import { HistorySearchControls } from '@/features/command-history/components/history-search-controls';
import { Icon } from '@/components/ui/icon';
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
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 xl:flex-row">
      <section className="cd-surface flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[13px]">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-soft)] px-4 py-3.5">
          <div>
            <div className="flex items-center gap-2">
              <Icon
                name="timeline"
                size={15}
                className="text-[var(--text-muted)]"
              />
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">
                Activity sessions
              </h2>
              <span className="rounded bg-[var(--surface-3)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                {entries.length} events
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
              {sessions.length} Activity Session
              {sessions.length === 1 ? '' : 's'} from immutable History
            </p>
          </div>
          <span className="hidden font-mono text-[9px] tracking-wide text-[var(--text-subtle)] uppercase sm:inline">
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
              <p className="mb-3 rounded-lg border border-[rgb(232_185_106_/_20%)] bg-[var(--warning-soft)] px-3 py-2 text-[11px] text-[var(--warning)]">
                {loadError}
              </p>
            )}
            <div className="space-y-2.5">
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
      <span className="cd-empty-mark" aria-hidden="true">
        {isLoading || isSearching ? (
          <span className="size-4 animate-spin rounded-full border border-[var(--text-subtle)] border-t-[var(--accent)] motion-reduce:animate-none" />
        ) : (
          <Icon name="timeline" size={18} />
        )}
      </span>
      <h3 className="mt-3 text-[13px] font-semibold text-[var(--text-secondary)]">
        {title}
      </h3>
      <p className="mt-1.5 max-w-xs text-[11px] leading-4.5 text-[var(--text-muted)]">
        {loadError ??
          (hasActiveQuery
            ? 'Try another command, directory, or status.'
            : 'Completed History entries become Timeline events automatically.')}
      </p>
      {!isLoading && !isSearching && !loadError && hasActiveQuery && (
        <button
          type="button"
          className="cd-button cd-button--primary mt-3 min-h-8 text-[11px]"
          onClick={onClearQuery}
        >
          Clear search and filters
        </button>
      )}
    </div>
  );
}
