import type { CommandCardsResponse } from '@/shared/contracts';
import { commandCardsResponseSchema } from '@/shared/schemas';
import type { CommandCardQuery } from '@/shared/types';

import { buildCommandCardsUrl } from './query';

export async function loadCommandCards(
  query: CommandCardQuery,
  signal?: AbortSignal,
): Promise<CommandCardsResponse> {
  const response = await fetch(buildCommandCardsUrl(query), {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unable to load command cards (${response.status}).`);
  }

  const payload: unknown = await response.json();
  return commandCardsResponseSchema.parse(payload);
}

export { buildCommandCardsUrl } from './query';

export async function deleteCommandCard(commandId: string): Promise<void> {
  const response = await fetch(
    `/api/commands/${encodeURIComponent(commandId)}`,
    { method: 'DELETE' },
  );

  if (response.ok || response.status === 404) {
    return;
  }

  throw new Error(`Unable to delete command card (${response.status}).`);
}
