'use client';

import { useCallback, useEffect, useState } from 'react';

import type { CommandCompletedPayload } from '@/shared/types';

import { deleteCommandCard, loadCommandCards } from '../api';
import {
  loadSelectedCommandCardId,
  resolveRestoredCommandCardId,
  saveSelectedCommandCardId,
} from '../selection-storage';
import type { CommandCard } from '../types';

type CommandCardsState = {
  cards: CommandCard[];
  selectedCardId: string | null;
  isLoading: boolean;
  loadError: string | null;
  addCompletedCommand: (command: CommandCompletedPayload) => void;
  selectCard: (commandId: string) => void;
  clearSelection: () => void;
  deleteCard: (commandId: string) => Promise<void>;
};

export function useCommandCards(): CommandCardsState {
  const [cards, setCards] = useState<CommandCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void loadCommandCards(controller.signal)
      .then((persistedCards) => {
        setCards((currentCards) =>
          mergeCommandCards(currentCards, persistedCards),
        );
        setSelectedCardId((currentId) => {
          if (currentId) {
            return currentId;
          }

          const restoredId = resolveRestoredCommandCardId(
            loadSelectedCommandCardId(),
            new Set(persistedCards.map(({ commandId }) => commandId)),
          );

          if (restoredId) {
            return restoredId;
          }

          saveSelectedCommandCardId(null);
          return null;
        });
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Unable to load command cards.',
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

  const addCompletedCommand = useCallback(
    (command: CommandCompletedPayload) => {
      const card: CommandCard = {
        ...command,
        createdAt: Date.now(),
      };

      setCards((currentCards) => mergeCommandCards(currentCards, [card]));
    },
    [],
  );

  const selectCard = useCallback((commandId: string) => {
    setSelectedCardId(commandId);
    saveSelectedCommandCardId(commandId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCardId(null);
    saveSelectedCommandCardId(null);
  }, []);

  const deleteCard = useCallback(async (commandId: string) => {
    await deleteCommandCard(commandId);
    setCards((currentCards) =>
      currentCards.filter((card) => card.commandId !== commandId),
    );
    setSelectedCardId((currentId) => {
      if (currentId !== commandId) {
        return currentId;
      }

      saveSelectedCommandCardId(null);
      return null;
    });
  }, []);

  return {
    cards,
    selectedCardId,
    isLoading,
    loadError,
    addCompletedCommand,
    selectCard,
    clearSelection,
    deleteCard,
  };
}

function mergeCommandCards(
  currentCards: CommandCard[],
  incomingCards: CommandCard[],
): CommandCard[] {
  const cardsById = new Map(currentCards.map((card) => [card.commandId, card]));

  for (const card of incomingCards) {
    cardsById.set(card.commandId, card);
  }

  return [...cardsById.values()].sort(compareByCompletionTime);
}

function compareByCompletionTime(
  left: CommandCard,
  right: CommandCard,
): number {
  return (
    right.endedAt - left.endedAt ||
    right.createdAt - left.createdAt ||
    right.startedAt - left.startedAt ||
    left.commandId.localeCompare(right.commandId)
  );
}
