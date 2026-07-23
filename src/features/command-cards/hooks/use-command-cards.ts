'use client';

import { useCallback, useEffect, useState } from 'react';

import type { CommandCompletedPayload } from '@/shared/types';

import { deleteCommandCard, loadCommandCards } from '../api';
import type { CommandCard } from '../types';

type CommandCardsState = {
  cards: CommandCard[];
  selectedCardId: string | null;
  isLoading: boolean;
  loadError: string | null;
  addCompletedCommand: (command: CommandCompletedPayload) => void;
  selectCard: (commandId: string) => void;
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
    setSelectedCardId((currentId) =>
      currentId === commandId ? null : commandId,
    );
  }, []);

  const deleteCard = useCallback(async (commandId: string) => {
    await deleteCommandCard(commandId);
    setCards((currentCards) =>
      currentCards.filter((card) => card.commandId !== commandId),
    );
    setSelectedCardId((currentId) =>
      currentId === commandId ? null : currentId,
    );
  }, []);

  return {
    cards,
    selectedCardId,
    isLoading,
    loadError,
    addCompletedCommand,
    selectCard,
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
