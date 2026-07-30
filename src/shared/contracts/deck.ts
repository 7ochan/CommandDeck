import type { CommandDeckItem, CommandDeckItemUpdate } from '../types/deck.ts';

export type CommandDeckResponse = {
  items: CommandDeckItem[];
};

export type AddCommandDeckItemRequest = {
  workspaceId: string;
  historyId: string;
};

export type UpdateCommandDeckItemRequest = CommandDeckItemUpdate;
