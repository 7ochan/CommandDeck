'use client';

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { hasActiveCommandHistoryQuery } from '@/shared/history-status';
import { Icon } from '@/components/ui/icon';
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
      <h2 id="command-history-title" className="sr-only">
        Command History
      </h2>

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
            <p className="mb-2 rounded-lg border border-[rgb(232_185_106_/_20%)] bg-[var(--warning-soft)] px-3 py-2 text-[11px] leading-4 text-[var(--warning)]">
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
    <div className="flex min-h-40 flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="cd-empty-mark" aria-hidden="true">
        {isLoading || isSearching ? (
          <span className="size-4 animate-spin rounded-full border border-[var(--text-subtle)] border-t-[var(--accent)] motion-reduce:animate-none" />
        ) : (
          <Icon name="history" size={18} />
        )}
      </span>
      <h3 className="mt-3 text-[13px] font-semibold text-[var(--text-secondary)]">
        {title}
      </h3>
      <p className="mt-1.5 max-w-56 text-[11px] leading-4.5 text-[var(--text-muted)]">
        {description}
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
