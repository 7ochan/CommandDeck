'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  EMPTY_COMMAND_HISTORY_QUERY,
  matchesCommandHistoryQuery,
} from '@/shared/history-status';
import type {
  CommandCompletedPayload,
  CommandHistoryQuery,
  CommandHistoryStatus,
} from '@/shared/types';

import { loadCommandHistory } from '../api';
import {
  loadSelectedHistoryEntryId,
  resolveRestoredHistoryEntryId,
  saveSelectedHistoryEntryId,
} from '../selection-storage';
import type { CommandHistoryEntry } from '../types';

type CommandHistoryState = {
  entries: CommandHistoryEntry[];
  selectedEntryId: string | null;
  query: CommandHistoryQuery;
  isLoading: boolean;
  isSearching: boolean;
  loadError: string | null;
  addCompletedCommand: (command: CommandCompletedPayload) => void;
  setSearchTerm: (searchTerm: string) => void;
  toggleStatus: (status: CommandHistoryStatus) => void;
  clearQuery: () => void;
  selectEntry: (commandId: string) => void;
  clearSelection: () => void;
};

export function useCommandHistory(): CommandHistoryState {
  const [entries, setEntries] = useState<CommandHistoryEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [query, setQuery] = useState<CommandHistoryQuery>(
    EMPTY_COMMAND_HISTORY_QUERY,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeQueryRef = useRef(query);
  const liveEntriesRef = useRef(new Map<string, CommandHistoryEntry>());
  const hasLoadedRef = useRef(false);
  const hasRestoredSelectionRef = useRef(false);

  useEffect(() => {
    activeQueryRef.current = query;
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const debounceTimer = window.setTimeout(
      () => {
        void loadCommandHistory(query, controller.signal)
          .then(({ entries: persistedEntries }) => {
            const matchingLiveEntries = [
              ...liveEntriesRef.current.values(),
            ].filter((entry) => matchesCommandHistoryQuery(entry, query));
            const visibleEntries = mergeHistoryEntries(
              persistedEntries,
              matchingLiveEntries,
            );

            setEntries(visibleEntries);
            setSelectedEntryId((currentId) => {
              const visibleIds = new Set(
                visibleEntries.map(({ commandId }) => commandId),
              );

              if (currentId && visibleIds.has(currentId)) {
                return currentId;
              }

              if (!hasRestoredSelectionRef.current) {
                hasRestoredSelectionRef.current = true;
                const restoredId = resolveRestoredHistoryEntryId(
                  loadSelectedHistoryEntryId(),
                  visibleIds,
                );

                if (restoredId) {
                  return restoredId;
                }
              }

              saveSelectedHistoryEntryId(null);
              return null;
            });
            setLoadError(null);
          })
          .catch((error: unknown) => {
            if (!controller.signal.aborted) {
              setLoadError(
                error instanceof Error
                  ? error.message
                  : 'Unable to load Command History.',
              );
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) {
              hasLoadedRef.current = true;
              setIsLoading(false);
              setIsSearching(false);
            }
          });
      },
      hasLoadedRef.current ? 120 : 0,
    );

    return () => {
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [query]);

  const addCompletedCommand = useCallback(
    (command: CommandCompletedPayload) => {
      const entry: CommandHistoryEntry = {
        ...command,
        createdAt: Date.now(),
      };

      liveEntriesRef.current.set(entry.commandId, entry);

      if (matchesCommandHistoryQuery(entry, activeQueryRef.current)) {
        setEntries((currentEntries) =>
          mergeHistoryEntries(currentEntries, [entry]),
        );
      }
    },
    [],
  );

  const setSearchTerm = useCallback((searchTerm: string) => {
    setIsSearching(true);
    setQuery((currentQuery) => ({ ...currentQuery, searchTerm }));
  }, []);

  const toggleStatus = useCallback((status: CommandHistoryStatus) => {
    setIsSearching(true);
    setQuery((currentQuery) => ({
      ...currentQuery,
      statuses: currentQuery.statuses.includes(status)
        ? currentQuery.statuses.filter((candidate) => candidate !== status)
        : [...currentQuery.statuses, status],
    }));
  }, []);

  const clearQuery = useCallback(() => {
    setIsSearching(true);
    setQuery(EMPTY_COMMAND_HISTORY_QUERY);
  }, []);

  const selectEntry = useCallback((commandId: string) => {
    setSelectedEntryId(commandId);
    saveSelectedHistoryEntryId(commandId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEntryId(null);
    saveSelectedHistoryEntryId(null);
  }, []);

  return {
    entries,
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
  };
}

function mergeHistoryEntries(
  currentEntries: CommandHistoryEntry[],
  incomingEntries: CommandHistoryEntry[],
): CommandHistoryEntry[] {
  const entriesById = new Map(
    currentEntries.map((entry) => [entry.commandId, entry]),
  );

  for (const entry of incomingEntries) {
    entriesById.set(entry.commandId, entry);
  }

  return [...entriesById.values()].sort(compareByCompletionTime);
}

function compareByCompletionTime(
  left: CommandHistoryEntry,
  right: CommandHistoryEntry,
): number {
  return (
    right.endedAt - left.endedAt ||
    right.createdAt - left.createdAt ||
    right.startedAt - left.startedAt ||
    left.commandId.localeCompare(right.commandId)
  );
}
