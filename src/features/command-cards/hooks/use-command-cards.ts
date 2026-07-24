'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  EMPTY_COMMAND_CARD_QUERY,
  matchesCommandCardQuery,
} from '@/shared/command-card-status';
import type {
  CommandCardQuery,
  CommandCardStatus,
  CommandCompletedPayload,
} from '@/shared/types';

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
  query: CommandCardQuery;
  isLoading: boolean;
  isSearching: boolean;
  loadError: string | null;
  addCompletedCommand: (command: CommandCompletedPayload) => void;
  setSearchTerm: (searchTerm: string) => void;
  toggleStatus: (status: CommandCardStatus) => void;
  clearQuery: () => void;
  selectCard: (commandId: string) => void;
  clearSelection: () => void;
  deleteCard: (commandId: string) => Promise<void>;
};

export function useCommandCards(): CommandCardsState {
  const [cards, setCards] = useState<CommandCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [query, setQuery] = useState<CommandCardQuery>(
    EMPTY_COMMAND_CARD_QUERY,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeQueryRef = useRef(query);
  const liveCardsRef = useRef(new Map<string, CommandCard>());
  const hasLoadedRef = useRef(false);
  const hasRestoredSelectionRef = useRef(false);

  useEffect(() => {
    activeQueryRef.current = query;
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const debounceTimer = window.setTimeout(
      () => {
        void loadCommandCards(query, controller.signal)
          .then(({ cards: persistedCards }) => {
            const matchingLiveCards = [...liveCardsRef.current.values()].filter(
              (card) => matchesCommandCardQuery(card, query),
            );
            const visibleCards = mergeCommandCards(
              persistedCards,
              matchingLiveCards,
            );

            setCards(visibleCards);
            setSelectedCardId((currentId) => {
              const visibleIds = new Set(
                visibleCards.map(({ commandId }) => commandId),
              );

              if (currentId && visibleIds.has(currentId)) {
                return currentId;
              }

              if (!hasRestoredSelectionRef.current) {
                hasRestoredSelectionRef.current = true;
                const restoredId = resolveRestoredCommandCardId(
                  loadSelectedCommandCardId(),
                  visibleIds,
                );

                if (restoredId) {
                  return restoredId;
                }
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
      const card: CommandCard = {
        ...command,
        createdAt: Date.now(),
      };

      liveCardsRef.current.set(card.commandId, card);

      if (matchesCommandCardQuery(card, activeQueryRef.current)) {
        setCards((currentCards) => mergeCommandCards(currentCards, [card]));
      }
    },
    [],
  );

  const setSearchTerm = useCallback((searchTerm: string) => {
    setIsSearching(true);
    setQuery((currentQuery) => ({ ...currentQuery, searchTerm }));
  }, []);

  const toggleStatus = useCallback((status: CommandCardStatus) => {
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
    setQuery(EMPTY_COMMAND_CARD_QUERY);
  }, []);

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
    liveCardsRef.current.delete(commandId);
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
    query,
    isLoading,
    isSearching,
    loadError,
    addCompletedCommand,
    setSearchTerm,
    toggleStatus,
    clearQuery,
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
