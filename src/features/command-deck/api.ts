import {
  commandDeckItemSchema,
  commandDeckResponseSchema,
} from '@/shared/schemas';
import type { CommandDeckItem, CommandDeckItemUpdate } from '@/shared/types';

export async function loadCommandDeck(
  signal?: AbortSignal,
): Promise<CommandDeckItem[]> {
  const response = await fetch('/api/deck', { cache: 'no-store', signal });

  if (!response.ok) {
    throw new Error(`Unable to load Command Deck (${response.status}).`);
  }

  const payload: unknown = await response.json();
  return commandDeckResponseSchema.parse(payload).items;
}

export async function addHistoryEntryToDeck(
  historyId: string,
): Promise<CommandDeckItem> {
  const response = await fetch('/api/deck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ historyId }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        `Unable to add command to the Deck (${response.status}).`,
      ),
    );
  }

  const payload: unknown = await response.json();
  return commandDeckItemSchema.parse(payload);
}

export async function updateCommandDeckItem(
  deckItemId: string,
  update: CommandDeckItemUpdate,
): Promise<CommandDeckItem> {
  const response = await fetch(`/api/deck/${encodeURIComponent(deckItemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        `Unable to update Deck item (${response.status}).`,
      ),
    );
  }

  const payload: unknown = await response.json();
  return commandDeckItemSchema.parse(payload);
}

export async function removeCommandDeckItem(deckItemId: string): Promise<void> {
  const response = await fetch(`/api/deck/${encodeURIComponent(deckItemId)}`, {
    method: 'DELETE',
  });

  if (response.ok || response.status === 404) {
    return;
  }

  throw new Error(`Unable to remove Deck item (${response.status}).`);
}

async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload: unknown = await response.json();

    if (
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
    ) {
      return payload.error;
    }
  } catch {
    // Use the transport-aware fallback when the response is not JSON.
  }

  return fallback;
}
