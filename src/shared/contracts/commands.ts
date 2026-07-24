import type { CommandCard, CommandCardQuery } from '../types/command';

export type CommandCardsQuery = CommandCardQuery;

export type CommandCardsResponse = {
  cards: CommandCard[];
  visibleCount: number;
};
