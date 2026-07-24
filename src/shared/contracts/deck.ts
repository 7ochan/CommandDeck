import type { CommandDeckItem, CommandDeckItemUpdate } from '../types/deck';

export type CommandDeckResponse = {
  items: CommandDeckItem[];
};

export type AddCommandDeckItemRequest = {
  historyId: string;
};

export type UpdateCommandDeckItemRequest = CommandDeckItemUpdate;
