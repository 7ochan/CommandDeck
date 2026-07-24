import type {
  CommandCardQuery,
  CommandCardStatus,
  CommandCompletedPayload,
} from './types/command';

export const COMMAND_CARD_STATUSES = [
  'success',
  'failed',
  'interrupted',
] as const satisfies readonly CommandCardStatus[];

export const EMPTY_COMMAND_CARD_QUERY: CommandCardQuery = {
  searchTerm: '',
  statuses: [],
};

export function getCommandCardStatus(
  command: Pick<CommandCompletedPayload, 'completionReason' | 'exitCode'>,
): CommandCardStatus {
  if (command.completionReason === 'session-exit' || command.exitCode === 130) {
    return 'interrupted';
  }

  return command.exitCode === 0 ? 'success' : 'failed';
}

export function matchesCommandCardQuery(
  command: Pick<
    CommandCompletedPayload,
    'command' | 'completionReason' | 'cwd' | 'exitCode'
  >,
  query: CommandCardQuery,
): boolean {
  const searchTerm = query.searchTerm.trim().toLocaleLowerCase();
  const matchesSearch =
    searchTerm.length === 0 ||
    command.command.toLocaleLowerCase().includes(searchTerm) ||
    command.cwd.toLocaleLowerCase().includes(searchTerm);
  const matchesStatus =
    query.statuses.length === 0 ||
    query.statuses.includes(getCommandCardStatus(command));

  return matchesSearch && matchesStatus;
}

export function hasActiveCommandCardQuery(query: CommandCardQuery): boolean {
  return query.searchTerm.trim().length > 0 || query.statuses.length > 0;
}
