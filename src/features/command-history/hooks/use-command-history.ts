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

export function useCommandHistory(workspaceId: string): CommandHistoryState {
  const [data, setData] = useState<{
    workspaceId: string;
    entries: CommandHistoryEntry[];
    isLoading: boolean;
    isSearching: boolean;
    loadError: string | null;
  }>({
    workspaceId,
    entries: [],
    isLoading: true,
    isSearching: true,
    loadError: null,
  });
  const [selection, setSelection] = useState<{
    workspaceId: string;
    commandId: string | null;
  }>({ workspaceId, commandId: null });
  const [queryState, setQueryState] = useState<{
    workspaceId: string;
    query: CommandHistoryQuery;
  }>({ workspaceId, query: EMPTY_COMMAND_HISTORY_QUERY });
  const query =
    queryState.workspaceId === workspaceId
      ? queryState.query
      : EMPTY_COMMAND_HISTORY_QUERY;
  const activeWorkspaceIdRef = useRef(workspaceId);
  const activeQueryRef = useRef({ workspaceId, query });
  const liveEntriesRef = useRef(new Map<string, CommandHistoryEntry>());
  const loadedWorkspaceIdsRef = useRef(new Set<string>());
  const restoredWorkspaceIdsRef = useRef(new Set<string>());

  useEffect(() => {
    activeWorkspaceIdRef.current = workspaceId;
    activeQueryRef.current = { workspaceId, query };
  }, [query, workspaceId]);

  useEffect(() => {
    const controller = new AbortController();
    const debounceTimer = window.setTimeout(
      () => {
        void loadCommandHistory(workspaceId, query, controller.signal)
          .then(({ entries: persistedEntries }) => {
            const matchingLiveEntries = [
              ...liveEntriesRef.current.values(),
            ].filter(
              (entry) =>
                entry.workspaceId === workspaceId &&
                matchesCommandHistoryQuery(entry, query),
            );
            const visibleEntries = mergeHistoryEntries(
              persistedEntries,
              matchingLiveEntries,
            );

            setData({
              workspaceId,
              entries: visibleEntries,
              isLoading: false,
              isSearching: false,
              loadError: null,
            });
            setSelection((currentSelection) => {
              const visibleIds = new Set(
                visibleEntries.map(({ commandId }) => commandId),
              );
              const currentId =
                currentSelection.workspaceId === workspaceId
                  ? currentSelection.commandId
                  : null;

              if (currentId && visibleIds.has(currentId)) {
                return { workspaceId, commandId: currentId };
              }

              if (!restoredWorkspaceIdsRef.current.has(workspaceId)) {
                restoredWorkspaceIdsRef.current.add(workspaceId);
                const restoredId = resolveRestoredHistoryEntryId(
                  loadSelectedHistoryEntryId(workspaceId),
                  visibleIds,
                );

                if (restoredId) {
                  return { workspaceId, commandId: restoredId };
                }
              }

              saveSelectedHistoryEntryId(workspaceId, null);
              return { workspaceId, commandId: null };
            });
          })
          .catch((error: unknown) => {
            if (!controller.signal.aborted) {
              setData({
                workspaceId,
                entries: [],
                isLoading: false,
                isSearching: false,
                loadError:
                  error instanceof Error
                    ? error.message
                    : 'Unable to load Command History.',
              });
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) {
              loadedWorkspaceIdsRef.current.add(workspaceId);
            }
          });
      },
      loadedWorkspaceIdsRef.current.has(workspaceId) ? 120 : 0,
    );

    return () => {
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [query, workspaceId]);

  const addCompletedCommand = useCallback(
    (command: CommandCompletedPayload) => {
      const entry: CommandHistoryEntry = {
        ...command,
        createdAt: Date.now(),
      };

      liveEntriesRef.current.set(entry.commandId, entry);

      const activeQuery = activeQueryRef.current;

      if (
        entry.workspaceId === activeWorkspaceIdRef.current &&
        activeQuery.workspaceId === entry.workspaceId &&
        matchesCommandHistoryQuery(entry, activeQuery.query)
      ) {
        setData((currentData) =>
          currentData.workspaceId === entry.workspaceId
            ? {
                ...currentData,
                entries: mergeHistoryEntries(currentData.entries, [entry]),
              }
            : currentData,
        );
      }
    },
    [],
  );

  const setSearchTerm = useCallback((searchTerm: string) => {
    const activeWorkspaceId = activeWorkspaceIdRef.current;
    setData((currentData) =>
      currentData.workspaceId === activeWorkspaceId
        ? { ...currentData, isSearching: true }
        : currentData,
    );
    setQueryState((currentState) => ({
      workspaceId: activeWorkspaceId,
      query: {
        ...(currentState.workspaceId === activeWorkspaceId
          ? currentState.query
          : EMPTY_COMMAND_HISTORY_QUERY),
        searchTerm,
      },
    }));
  }, []);

  const toggleStatus = useCallback((status: CommandHistoryStatus) => {
    const activeWorkspaceId = activeWorkspaceIdRef.current;
    setData((currentData) =>
      currentData.workspaceId === activeWorkspaceId
        ? { ...currentData, isSearching: true }
        : currentData,
    );
    setQueryState((currentState) => {
      const currentQuery =
        currentState.workspaceId === activeWorkspaceId
          ? currentState.query
          : EMPTY_COMMAND_HISTORY_QUERY;
      return {
        workspaceId: activeWorkspaceId,
        query: {
          ...currentQuery,
          statuses: currentQuery.statuses.includes(status)
            ? currentQuery.statuses.filter((candidate) => candidate !== status)
            : [...currentQuery.statuses, status],
        },
      };
    });
  }, []);

  const clearQuery = useCallback(() => {
    const activeWorkspaceId = activeWorkspaceIdRef.current;
    setData((currentData) =>
      currentData.workspaceId === activeWorkspaceId
        ? { ...currentData, isSearching: true }
        : currentData,
    );
    setQueryState({
      workspaceId: activeWorkspaceId,
      query: EMPTY_COMMAND_HISTORY_QUERY,
    });
  }, []);

  const selectEntry = useCallback((commandId: string) => {
    const activeWorkspaceId = activeWorkspaceIdRef.current;
    setSelection({ workspaceId: activeWorkspaceId, commandId });
    saveSelectedHistoryEntryId(activeWorkspaceId, commandId);
  }, []);

  const clearSelection = useCallback(() => {
    const activeWorkspaceId = activeWorkspaceIdRef.current;
    setSelection({ workspaceId: activeWorkspaceId, commandId: null });
    saveSelectedHistoryEntryId(activeWorkspaceId, null);
  }, []);

  const hasCurrentData = data.workspaceId === workspaceId;

  return {
    entries: hasCurrentData ? data.entries : [],
    selectedEntryId:
      selection.workspaceId === workspaceId ? selection.commandId : null,
    query,
    isLoading: hasCurrentData ? data.isLoading : true,
    isSearching: hasCurrentData ? data.isSearching : true,
    loadError: hasCurrentData ? data.loadError : null,
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
