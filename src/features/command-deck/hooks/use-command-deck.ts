'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { CommandDeckItem, CommandDeckItemUpdate } from '@/shared/types';
import { useSettings } from '@/features/settings/settings-provider';
import { loadWorkspaces } from '@/features/workspaces/api';

import {
  addHistoryEntryToDeck,
  createCustomDeckItem,
  loadCommandDeck,
  removeCommandDeckItem,
  updateCommandDeckItem,
} from '../api.ts';

type CommandDeckState = {
  items: CommandDeckItem[];
  isLoading: boolean;
  loadError: string | null;
  addFromHistory: (historyId: string) => Promise<void>;
  createCustomItem: (
    displayName: string,
    command: string,
    description?: string | null,
  ) => Promise<void>;
  updateItem: (
    deckItemId: string,
    update: CommandDeckItemUpdate,
  ) => Promise<void>;
  removeItem: (deckItemId: string) => Promise<void>;
};

export function useCommandDeck(workspaceId: string): CommandDeckState {
  const { settings } = useSettings();
  const deckScope = settings.developerHub.deckScope;

  const [data, setData] = useState<{
    workspaceId: string;
    items: CommandDeckItem[];
    isLoading: boolean;
    loadError: string | null;
  }>({ workspaceId, items: [], isLoading: true, loadError: null });
  const activeWorkspaceIdRef = useRef(workspaceId);

  useEffect(() => {
    activeWorkspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  useEffect(() => {
    const controller = new AbortController();

    if (deckScope === 'global') {
      void (async () => {
        try {
          const workspaces = await loadWorkspaces(controller.signal);
          const deckPromises = workspaces.map((ws) =>
            loadCommandDeck(ws.workspaceId, controller.signal).catch(() => []),
          );
          const results = await Promise.all(deckPromises);
          const allItems = results.flat();
          const uniqueMap = new Map<string, CommandDeckItem>();
          allItems.forEach((item) => {
            const key = `${item.command}::${item.displayName}`;
            if (!uniqueMap.has(key)) {
              uniqueMap.set(key, item);
            }
          });
          const merged = Array.from(uniqueMap.values()).sort(compareDeckItems);
          if (!controller.signal.aborted) {
            setData({
              workspaceId,
              items: merged,
              isLoading: false,
              loadError: null,
            });
          }
        } catch (error: unknown) {
          if (!controller.signal.aborted) {
            setData({
              workspaceId,
              items: [],
              isLoading: false,
              loadError:
                error instanceof Error
                  ? error.message
                  : 'Unable to load Command Deck.',
            });
          }
        }
      })();
    } else {
      void loadCommandDeck(workspaceId, controller.signal)
        .then((loadedItems) => {
          if (!controller.signal.aborted) {
            setData({
              workspaceId,
              items: loadedItems,
              isLoading: false,
              loadError: null,
            });
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setData({
              workspaceId,
              items: [],
              isLoading: false,
              loadError:
                error instanceof Error
                  ? error.message
                  : 'Unable to load Command Deck.',
            });
          }
        });
    }

    return () => controller.abort();
  }, [workspaceId, deckScope]);

  const addFromHistory = useCallback(async (historyId: string) => {
    const activeWorkspaceId = activeWorkspaceIdRef.current;
    const item = await addHistoryEntryToDeck(activeWorkspaceId, historyId);
    setData((currentData) =>
      currentData.workspaceId === activeWorkspaceId
        ? {
            ...currentData,
            items: mergeDeckItem(currentData.items, item),
          }
        : currentData,
    );
  }, []);

  const createCustomItem = useCallback(
    async (
      displayName: string,
      command: string,
      description?: string | null,
    ) => {
      const activeWorkspaceId = activeWorkspaceIdRef.current;
      const item = await createCustomDeckItem(
        activeWorkspaceId,
        displayName,
        command,
        description,
      );
      setData((currentData) =>
        currentData.workspaceId === activeWorkspaceId
          ? {
              ...currentData,
              items: mergeDeckItem(currentData.items, item),
            }
          : currentData,
      );
    },
    [],
  );

  const updateItem = useCallback(
    async (deckItemId: string, update: CommandDeckItemUpdate) => {
      const activeWorkspaceId = activeWorkspaceIdRef.current;
      const item = await updateCommandDeckItem(
        activeWorkspaceId,
        deckItemId,
        update,
      );
      setData((currentData) =>
        currentData.workspaceId === activeWorkspaceId
          ? {
              ...currentData,
              items: mergeDeckItem(currentData.items, item),
            }
          : currentData,
      );
    },
    [],
  );

  const removeItem = useCallback(async (deckItemId: string) => {
    const activeWorkspaceId = activeWorkspaceIdRef.current;
    await removeCommandDeckItem(activeWorkspaceId, deckItemId);
    setData((currentData) =>
      currentData.workspaceId === activeWorkspaceId
        ? {
            ...currentData,
            items: currentData.items.filter(
              (item) => item.deckItemId !== deckItemId,
            ),
          }
        : currentData,
    );
  }, []);

  const hasCurrentData = data.workspaceId === workspaceId;

  return {
    items: hasCurrentData ? data.items : [],
    isLoading: hasCurrentData ? data.isLoading : true,
    loadError: hasCurrentData ? data.loadError : null,
    addFromHistory,
    createCustomItem,
    updateItem,
    removeItem,
  };
}

function mergeDeckItem(
  currentItems: CommandDeckItem[],
  incomingItem: CommandDeckItem,
): CommandDeckItem[] {
  const existingIndex = currentItems.findIndex(
    ({ deckItemId }) => deckItemId === incomingItem.deckItemId,
  );

  if (existingIndex === -1) {
    return [...currentItems, incomingItem].sort(compareDeckItems);
  }

  return currentItems.map((item, index) =>
    index === existingIndex ? incomingItem : item,
  );
}

function compareDeckItems(left: CommandDeckItem, right: CommandDeckItem) {
  return left.position - right.position || left.addedAt - right.addedAt;
}
