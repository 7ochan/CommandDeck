import type {
  CommandHistoryEntry,
  CommandHistoryQuery,
} from '../types/command.ts';

export type CommandHistoryRequest = CommandHistoryQuery;

export type CommandHistoryResponse = {
  entries: CommandHistoryEntry[];
  visibleCount: number;
};
