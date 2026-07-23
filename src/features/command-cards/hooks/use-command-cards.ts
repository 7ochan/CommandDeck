'use client';

import { useCallback, useState } from 'react';

import type { CommandCompletedPayload } from '@/shared/types';

import type { CommandCard } from '../types';

type CommandCardsState = {
  cards: CommandCard[];
  selectedCardId: string | null;
  addCompletedCommand: (command: CommandCompletedPayload) => void;
  selectCard: (commandId: string) => void;
};

export function useCommandCards(): CommandCardsState {
  const [cards, setCards] = useState<CommandCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const addCompletedCommand = useCallback(
    (command: CommandCompletedPayload) => {
      const card: CommandCard = {
        commandId: command.commandId,
        command: command.command,
        cwd: command.cwd,
        exitCode: command.exitCode,
        durationMs: command.durationMs,
        startedAt: command.startedAt,
        finishedAt: command.finishedAt,
      };

      setCards((currentCards) =>
        [
          ...currentCards.filter(
            ({ commandId }) => commandId !== card.commandId,
          ),
          card,
        ].sort(compareByCompletionTime),
      );
    },
    [],
  );

  const selectCard = useCallback((commandId: string) => {
    setSelectedCardId(commandId);
  }, []);

  return { cards, selectedCardId, addCompletedCommand, selectCard };
}

function compareByCompletionTime(
  left: CommandCard,
  right: CommandCard,
): number {
  return (
    right.finishedAt - left.finishedAt ||
    right.startedAt - left.startedAt ||
    left.commandId.localeCompare(right.commandId)
  );
}
