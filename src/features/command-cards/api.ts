import { commandCardsResponseSchema } from '@/shared/schemas';

import type { CommandCard } from './types';

export async function loadCommandCards(
  signal?: AbortSignal,
): Promise<CommandCard[]> {
  const response = await fetch('/api/commands', {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unable to load command cards (${response.status}).`);
  }

  const payload: unknown = await response.json();
  return commandCardsResponseSchema.parse(payload).cards;
}

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
