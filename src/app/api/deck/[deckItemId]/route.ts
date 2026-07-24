import { z } from 'zod';

import type { UpdateCommandDeckItemRequest } from '@/shared/contracts';
import {
  commandDeckItemSchema,
  updateCommandDeckItemSchema,
  workspaceIdSchema,
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
  const parsedWorkspaceId = workspaceIdSchema.safeParse(
    new URL(request.url).searchParams.get('workspaceId'),
  );

  if (!parsedId.success || !parsedWorkspaceId.success) {
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
  const result = getServerContainer().commandDeckService.updateDeckItem(
    parsedWorkspaceId.data,
    parsedId.data,
    update,
  );

  if (result.outcome === 'invalid-template') {
    return Response.json({ error: result.message }, { status: 422 });
  }

  return result.outcome === 'updated'
    ? Response.json(commandDeckItemSchema.parse(result.item))
    : Response.json({ error: 'Command Deck item not found.' }, { status: 404 });
}

export async function DELETE(
  request: Request,
  { params }: DeckItemRouteContext,
): Promise<Response> {
  const parsedId = deckItemIdSchema.safeParse((await params).deckItemId);
  const parsedWorkspaceId = workspaceIdSchema.safeParse(
    new URL(request.url).searchParams.get('workspaceId'),
  );

  if (!parsedId.success || !parsedWorkspaceId.success) {
    return Response.json({ error: 'Invalid Deck item ID.' }, { status: 400 });
  }

  const removed = getServerContainer().commandDeckService.removeDeckItem(
    parsedWorkspaceId.data,
    parsedId.data,
  );

  return removed
    ? new Response(null, { status: 204 })
    : Response.json({ error: 'Command Deck item not found.' }, { status: 404 });
}
