import type {
  CommandCompletedPayload,
  CommandHistoryQuery,
  CommandHistoryStatus,
} from './types/command';

export const COMMAND_HISTORY_STATUSES = [
  'success',
  'failed',
  'interrupted',
] as const satisfies readonly CommandHistoryStatus[];

export const EMPTY_COMMAND_HISTORY_QUERY: CommandHistoryQuery = {
  searchTerm: '',
  statuses: [],
};

export function getCommandHistoryStatus(
  command: Pick<CommandCompletedPayload, 'completionReason' | 'exitCode'>,
): CommandHistoryStatus {
  if (command.completionReason === 'session-exit' || command.exitCode === 130) {
    return 'interrupted';
  }

  return command.exitCode === 0 ? 'success' : 'failed';
}

export function matchesCommandHistoryQuery(
  command: Pick<
    CommandCompletedPayload,
    'command' | 'completionReason' | 'cwd' | 'exitCode'
  >,
  query: CommandHistoryQuery,
): boolean {
  const searchTerm = query.searchTerm.trim().toLocaleLowerCase();
  const matchesSearch =
    searchTerm.length === 0 ||
    command.command.toLocaleLowerCase().includes(searchTerm) ||
    command.cwd.toLocaleLowerCase().includes(searchTerm);
  const matchesStatus =
    query.statuses.length === 0 ||
    query.statuses.includes(getCommandHistoryStatus(command));

  return matchesSearch && matchesStatus;
}

export function hasActiveCommandHistoryQuery(
  query: CommandHistoryQuery,
): boolean {
  return query.searchTerm.trim().length > 0 || query.statuses.length > 0;
}
