import { z } from 'zod';

import { getServerContainer } from '@/server/runtime/server-container-registry';

const commandIdSchema = z.string().min(1).max(200);

type CommandRouteContext = {
  params: Promise<{ commandId: string }>;
};

export async function DELETE(
  _request: Request,
  { params }: CommandRouteContext,
): Promise<Response> {
  const parsedCommandId = commandIdSchema.safeParse((await params).commandId);

  if (!parsedCommandId.success) {
    return Response.json(
      { error: 'Invalid command card ID.' },
      { status: 400 },
    );
  }

  const deleted = getServerContainer().commandService.deleteCommandCard(
    parsedCommandId.data,
  );

  return deleted
    ? new Response(null, { status: 204 })
    : Response.json({ error: 'Command card not found.' }, { status: 404 });
}
