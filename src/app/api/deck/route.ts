import type {
  AddCommandDeckItemRequest,
  CommandDeckResponse,
} from '@/shared/contracts';
import {
  addCommandDeckItemSchema,
  commandDeckItemSchema,
} from '@/shared/schemas';
import { getServerContainer } from '@/server/runtime/server-container-registry';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const response: CommandDeckResponse = {
    items: getServerContainer().commandDeckService.listDeckItems(),
  };

  return Response.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsedRequest = addCommandDeckItemSchema.safeParse(payload);

  if (!parsedRequest.success) {
    return Response.json(
      { error: 'Invalid Command Deck request.' },
      { status: 400 },
    );
  }

  const requestBody: AddCommandDeckItemRequest = parsedRequest.data;
  const result = getServerContainer().commandDeckService.addHistoryEntry(
    requestBody.historyId,
  );

  if (result.outcome === 'history-not-found') {
    return Response.json(
      { error: 'Command History entry not found.' },
      { status: 404 },
    );
  }

  if (result.outcome === 'invalid-template') {
    return Response.json({ error: result.message }, { status: 422 });
  }

  return Response.json(commandDeckItemSchema.parse(result.item), {
    status: result.outcome === 'created' ? 201 : 200,
  });
}
