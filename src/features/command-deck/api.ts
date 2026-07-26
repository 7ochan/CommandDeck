import {
  commandDeckItemSchema,
  commandDeckResponseSchema,
} from '@/shared/schemas';
import type { CommandDeckItem, CommandDeckItemUpdate } from '@/shared/types';

export async function loadCommandDeck(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<CommandDeckItem[]> {
  const parameters = new URLSearchParams({ workspaceId });
  const response = await fetch(`/api/deck?${parameters.toString()}`, {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unable to load Command Deck (${response.status}).`);
  }

  const payload: unknown = await response.json();
  return commandDeckResponseSchema.parse(payload).items;
}

export async function addHistoryEntryToDeck(
  workspaceId: string,
  historyId: string,
): Promise<CommandDeckItem> {
  const response = await fetch('/api/deck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, historyId }),
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

export async function createCustomDeckItem(
  workspaceId: string,
  displayName: string,
  command: string,
  description?: string | null,
): Promise<CommandDeckItem> {
  const response = await fetch('/api/deck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceId,
      displayName,
      command,
      description,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        `Unable to create Deck item (${response.status}).`,
      ),
    );
  }

  const payload: unknown = await response.json();
  return commandDeckItemSchema.parse(payload);
}

export async function updateCommandDeckItem(
  workspaceId: string,
  deckItemId: string,
  update: CommandDeckItemUpdate,
): Promise<CommandDeckItem> {
  const parameters = new URLSearchParams({ workspaceId });
  const response = await fetch(
    `/api/deck/${encodeURIComponent(deckItemId)}?${parameters.toString()}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    },
  );

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

export async function removeCommandDeckItem(
  workspaceId: string,
  deckItemId: string,
): Promise<void> {
  const parameters = new URLSearchParams({ workspaceId });
  const response = await fetch(
    `/api/deck/${encodeURIComponent(deckItemId)}?${parameters.toString()}`,
    { method: 'DELETE' },
  );

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
