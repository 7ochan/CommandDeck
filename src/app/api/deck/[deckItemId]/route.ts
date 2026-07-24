import { z } from 'zod';

import type { UpdateCommandDeckItemRequest } from '@/shared/contracts';
import {
  commandDeckItemSchema,
  updateCommandDeckItemSchema,
} from '@/shared/schemas';
import { getServerContainer } from '@/server/runtime/server-container-registry';

const deckItemIdSchema = z.string().min(1).max(200);

type DeckItemRouteContext = {
  params: Promise<{ deckItemId: string }>;
};

export async function PATCH(
  request: Request,
  { params }: DeckItemRouteContext,
): Promise<Response> {
  const parsedId = deckItemIdSchema.safeParse((await params).deckItemId);

  if (!parsedId.success) {
    return Response.json({ error: 'Invalid Deck item ID.' }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsedUpdate = updateCommandDeckItemSchema.safeParse(payload);

  if (!parsedUpdate.success) {
    return Response.json(
      { error: 'Invalid Command Deck update.' },
      { status: 400 },
    );
  }

  const update: UpdateCommandDeckItemRequest = {
    ...parsedUpdate.data,
    ...(parsedUpdate.data.description === '' ? { description: null } : {}),
  };
  const item = getServerContainer().commandDeckService.updateDeckItem(
    parsedId.data,
    update,
  );

  return item
    ? Response.json(commandDeckItemSchema.parse(item))
    : Response.json({ error: 'Command Deck item not found.' }, { status: 404 });
}

export async function DELETE(
  _request: Request,
  { params }: DeckItemRouteContext,
): Promise<Response> {
  const parsedId = deckItemIdSchema.safeParse((await params).deckItemId);

  if (!parsedId.success) {
    return Response.json({ error: 'Invalid Deck item ID.' }, { status: 400 });
  }

  const removed = getServerContainer().commandDeckService.removeDeckItem(
    parsedId.data,
  );

  return removed
    ? new Response(null, { status: 204 })
    : Response.json({ error: 'Command Deck item not found.' }, { status: 404 });
}
