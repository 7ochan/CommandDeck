'use client';

import { useCallback, useEffect, useState } from 'react';

import type { CommandDeckItem, CommandDeckItemUpdate } from '@/shared/types';

import {
  addHistoryEntryToDeck,
  loadCommandDeck,
  removeCommandDeckItem,
  updateCommandDeckItem,
} from '../api';

type CommandDeckState = {
  items: CommandDeckItem[];
  isLoading: boolean;
  loadError: string | null;
  addFromHistory: (historyId: string) => Promise<void>;
  updateItem: (
    deckItemId: string,
    update: CommandDeckItemUpdate,
  ) => Promise<void>;
  removeItem: (deckItemId: string) => Promise<void>;
};

export function useCommandDeck(): CommandDeckState {
  const [items, setItems] = useState<CommandDeckItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void loadCommandDeck(controller.signal)
      .then((loadedItems) => {
        setItems(loadedItems);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Unable to load Command Deck.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const addFromHistory = useCallback(async (historyId: string) => {
    const item = await addHistoryEntryToDeck(historyId);
    setItems((currentItems) => mergeDeckItem(currentItems, item));
  }, []);

  const updateItem = useCallback(
    async (deckItemId: string, update: CommandDeckItemUpdate) => {
      const item = await updateCommandDeckItem(deckItemId, update);
      setItems((currentItems) => mergeDeckItem(currentItems, item));
    },
    [],
  );

  const removeItem = useCallback(async (deckItemId: string) => {
    await removeCommandDeckItem(deckItemId);
    setItems((currentItems) =>
      currentItems.filter((item) => item.deckItemId !== deckItemId),
    );
  }, []);

  return {
    items,
    isLoading,
    loadError,
    addFromHistory,
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
