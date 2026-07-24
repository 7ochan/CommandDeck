import type { CommandHistoryResponse } from '@/shared/contracts';
import { commandHistoryResponseSchema } from '@/shared/schemas';
import type { CommandHistoryQuery } from '@/shared/types';

import { buildCommandHistoryUrl } from './query';

export async function loadCommandHistory(
  query: CommandHistoryQuery,
  signal?: AbortSignal,
): Promise<CommandHistoryResponse> {
  const response = await fetch(buildCommandHistoryUrl(query), {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unable to load Command History (${response.status}).`);
  }

  const payload: unknown = await response.json();
  return commandHistoryResponseSchema.parse(payload);
}
