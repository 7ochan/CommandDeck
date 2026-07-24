import type { CommandCardQuery } from '@/shared/types';

export function buildCommandCardsUrl(query: CommandCardQuery): string {
  const parameters = new URLSearchParams();
  const searchTerm = query.searchTerm.trim();

  if (searchTerm) {
    parameters.set('q', searchTerm);
  }

  for (const status of query.statuses) {
    parameters.append('status', status);
  }

  const queryString = parameters.toString();
  return queryString ? `/api/commands?${queryString}` : '/api/commands';
}
