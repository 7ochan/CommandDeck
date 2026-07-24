import type { CommandHistoryResponse } from '@/shared/contracts';
import { commandHistoryQuerySchema, workspaceIdSchema } from '@/shared/schemas';
import { getServerContainer } from '@/server/runtime/server-container-registry';

export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const parsedQuery = commandHistoryQuerySchema.safeParse({
    searchTerm: url.searchParams.get('q') ?? '',
    statuses: url.searchParams.getAll('status'),
  });
  const parsedWorkspaceId = workspaceIdSchema.safeParse(
    url.searchParams.get('workspaceId'),
  );

  if (!parsedQuery.success || !parsedWorkspaceId.success) {
    return Response.json(
      { error: 'Invalid Command History query.' },
      { status: 400 },
    );
  }

  if (
    !getServerContainer().workspaceService.workspaceExists(
      parsedWorkspaceId.data,
    )
  ) {
    return Response.json({ error: 'Workspace not found.' }, { status: 404 });
  }

  const entries = getServerContainer().commandHistoryService.listHistory(
    parsedWorkspaceId.data,
    parsedQuery.data,
  );
  const response: CommandHistoryResponse = {
    entries,
    visibleCount: entries.length,
  };

  return Response.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
