import type { CommandHistoryQuery } from '@/shared/types';

export function buildCommandHistoryUrl(
  workspaceId: string,
  query: CommandHistoryQuery,
): string {
  const parameters = new URLSearchParams();
  parameters.set('workspaceId', workspaceId);
  const searchTerm = query.searchTerm.trim();

  if (searchTerm) {
    parameters.set('q', searchTerm);
  }

  for (const status of query.statuses) {
    parameters.append('status', status);
  }

  return `/api/history?${parameters.toString()}`;
}
