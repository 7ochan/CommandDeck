export type CommandDefinition = {
  definitionId: string;
  sourceHistoryId: string | null;
  command: string;
  createdAt: number;
  updatedAt: number;
};

export type CommandDeckItem = {
  deckItemId: string;
  definitionId: string;
  sourceHistoryId: string | null;
  displayName: string;
  command: string;
  description: string | null;
  position: number;
  addedAt: number;
  updatedAt: number;
};

export type CommandDeckItemUpdate = {
  displayName?: string;
  command?: string;
  description?: string | null;
};
