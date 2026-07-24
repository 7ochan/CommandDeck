import type {
  CommandHistoryEntry,
  CommandHistoryQuery,
} from '../types/command';

export type CommandHistoryRequest = CommandHistoryQuery;

export type CommandHistoryResponse = {
  entries: CommandHistoryEntry[];
  visibleCount: number;
};
