import type { CommandHistoryResponse } from '@/shared/contracts';
import { commandHistoryResponseSchema } from '@/shared/schemas';
import type { CommandHistoryQuery } from '@/shared/types';

import { buildCommandHistoryUrl } from './query.ts';

export async function loadCommandHistory(
  workspaceId: string,
  query: CommandHistoryQuery,
  signal?: AbortSignal,
): Promise<CommandHistoryResponse> {
  const response = await fetch(buildCommandHistoryUrl(workspaceId, query), {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unable to load Command History (${response.status}).`);
  }

  const payload: unknown = await response.json();
  return commandHistoryResponseSchema.parse(payload);
}
