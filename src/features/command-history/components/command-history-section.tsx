'use client';

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { hasActiveCommandHistoryQuery } from '@/shared/history-status';
import type { CommandHistoryQuery, CommandHistoryStatus } from '@/shared/types';

import {
  getNavigatedHistoryEntryId,
  hasNewLeadingHistoryEntry,
  isNearHistoryListTop,
  shouldClearHistorySelection,
  type HistoryNavigationDirection,
} from '../history-list-behavior';
import type { CommandHistoryEntry as CommandHistoryEntryModel } from '../types';
import { CommandHistoryEntry } from './history-entry';
import { HistorySearchControls } from './history-search-controls';

type CommandHistorySectionProps = {
  entries: CommandHistoryEntryModel[];
  selectedEntryId: string | null;
  deckHistoryIds: ReadonlySet<string>;
  query: CommandHistoryQuery;
  isLoading: boolean;
  isSearching: boolean;
  loadError: string | null;
  onSearchTermChange: (searchTerm: string) => void;
  onToggleStatus: (status: CommandHistoryStatus) => void;
  onClearQuery: () => void;
  onSelectEntry: (commandId: string) => void;
  onClearSelection: () => void;
  onRunAgain: (command: string) => boolean;
  onAddToDeck: (historyId: string) => Promise<void>;
};

export function CommandHistorySection({
  entries,
  selectedEntryId,
  deckHistoryIds,
  query,
  isLoading,
  isSearching,
  loadError,
  onSearchTermChange,
  onToggleStatus,
  onClearQuery,
  onSelectEntry,
  onClearSelection,
  onRunAgain,
  onAddToDeck,
}: CommandHistorySectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const entryButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousEntryIdsRef = useRef<Set<string>>(new Set());
  const wasNearTopRef = useRef(true);
  const [interactionMessage, setInteractionMessage] = useState('');
  const hasActiveQuery = hasActiveCommandHistoryQuery(query);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const previousEntryIds = previousEntryIdsRef.current;

    if (
      scrollContainer &&
      !isLoading &&
      wasNearTopRef.current &&
      hasNewLeadingHistoryEntry(previousEntryIds, entries)
    ) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }

    previousEntryIdsRef.current = new Set(
      entries.map(({ commandId }) => commandId),
    );
  }, [entries, isLoading]);

  const registerEntryButton = useCallback(
    (commandId: string, button: HTMLButtonElement | null) => {
      if (button) {
        entryButtonRefs.current.set(commandId, button);
      } else {
        entryButtonRefs.current.delete(commandId);
      }
    },
    [],
  );

  const rerunCommand = useCallback(
    (command: string) => {
      const reran = onRunAgain(command);
      setInteractionMessage(
        reran
          ? 'Command sent to the active terminal.'
          : 'The active terminal is not connected.',
      );
      return reran;
    },
    [onRunAgain],
  );

  const navigateEntries = useCallback(
    (commandId: string, direction: HistoryNavigationDirection) => {
      const targetId = getNavigatedHistoryEntryId(
        entries,
        commandId,
        direction,
      );

      if (!targetId) {
        return;
      }

      onSelectEntry(targetId);
      entryButtonRefs.current.get(targetId)?.focus({ preventScroll: true });
      entryButtonRefs.current
        .get(targetId)
        ?.scrollIntoView({ block: 'nearest' });
    },
    [entries, onSelectEntry],
  );

  const handleSectionKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!shouldClearHistorySelection(event.key) || !selectedEntryId) {
      return;
    }

    const eventTarget = event.target;

    if (
      eventTarget instanceof Element &&
      eventTarget.closest('input, textarea, dialog[open]')
    ) {
      return;
    }

    event.preventDefault();
    entryButtonRefs.current.get(selectedEntryId)?.focus();
    onClearSelection();
    setInteractionMessage('History selection cleared.');
  };

  return (
    <section
      ref={sectionRef}
      className="flex min-h-0 flex-1 flex-col"
      aria-labelledby="command-history-title"
      tabIndex={-1}
      onKeyDown={handleSectionKeyDown}
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/8 px-3">
        <div className="flex items-center gap-2">
          <h2
            id="command-history-title"
            className="font-mono text-[11px] font-medium text-slate-300"
          >
            History
          </h2>
          <span className="rounded-full bg-white/6 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
            {entries.length} visible
          </span>
        </div>
        <span className="font-mono text-[8px] tracking-wide text-slate-600 uppercase">
          Automatic
        </span>
      </div>

      <HistorySearchControls
        query={query}
        isSearching={isSearching}
        onSearchTermChange={onSearchTermChange}
        onToggleStatus={onToggleStatus}
      />

      <p className="sr-only" aria-live="polite">
        {interactionMessage}
      </p>

      {entries.length === 0 ? (
        <HistoryEmptyState
          isLoading={isLoading}
          isSearching={isSearching}
          loadError={loadError}
          hasActiveQuery={hasActiveQuery}
          onClearQuery={onClearQuery}
        />
      ) : (
        <div
          ref={scrollContainerRef}
          className="command-history-scrollbar min-h-0 flex-1 overflow-y-auto p-2.5"
          onScroll={(event) => {
            wasNearTopRef.current = isNearHistoryListTop(
              event.currentTarget.scrollTop,
            );
          }}
        >
          {loadError && (
            <p className="mb-2 rounded-lg border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-[10px] leading-4 text-amber-200/70">
              {loadError}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {entries.map((entry, index) => (
              <CommandHistoryEntry
                key={entry.commandId}
                entry={entry}
                isSelected={entry.commandId === selectedEntryId}
                isTabStop={
                  entry.commandId === selectedEntryId ||
                  (!selectedEntryId && index === 0)
                }
                isInDeck={deckHistoryIds.has(entry.commandId)}
                searchTerm={query.searchTerm}
                registerButton={registerEntryButton}
                onSelect={onSelectEntry}
                onNavigate={navigateEntries}
                onRunAgain={rerunCommand}
                onAddToDeck={onAddToDeck}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

type HistoryEmptyStateProps = {
  isLoading: boolean;
  isSearching: boolean;
  loadError: string | null;
  hasActiveQuery: boolean;
  onClearQuery: () => void;
};

function HistoryEmptyState({
  isLoading,
  isSearching,
  loadError,
  hasActiveQuery,
  onClearQuery,
}: HistoryEmptyStateProps) {
  const title = isLoading
    ? 'Loading History'
    : isSearching
      ? 'Searching History'
      : loadError
        ? 'History unavailable'
        : hasActiveQuery
          ? 'No matching History entries'
          : 'History starts with your next command';
  const description =
    loadError ??
    (hasActiveQuery
      ? 'Try another command, directory, or status.'
      : 'Completed commands are recorded here automatically.');

  return (
    <div className="flex min-h-36 flex-1 flex-col items-center justify-center px-6 text-center">
      <span
        className="font-mono text-lg text-emerald-300/60"
        aria-hidden="true"
      >
        {isLoading || isSearching ? '…' : '>_'}
      </span>
      <h3 className="mt-3 text-xs font-medium text-slate-300">{title}</h3>
      <p className="mt-1.5 max-w-52 text-[10px] leading-4 text-slate-500">
        {description}
      </p>
      {!isLoading && !isSearching && !loadError && hasActiveQuery && (
        <button
          type="button"
          className="mt-3 rounded-md border border-emerald-300/20 bg-emerald-300/8 px-2.5 py-1 text-[10px] text-emerald-200 focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:outline-none"
          onClick={onClearQuery}
        >
          Clear search and filters
        </button>
      )}
    </div>
  );
}
