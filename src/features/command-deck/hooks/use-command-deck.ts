'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { CommandDeckItem, CommandDeckItemUpdate } from '@/shared/types';

import {
  addHistoryEntryToDeck,
  createCustomDeckItem,
  loadCommandDeck,
  removeCommandDeckItem,
  updateCommandDeckItem,
} from '../api';

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

    void loadCommandDeck(workspaceId, controller.signal)
      .then((loadedItems) => {
        setData({
          workspaceId,
          items: loadedItems,
          isLoading: false,
          loadError: null,
        });
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

    return () => controller.abort();
  }, [workspaceId]);

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
