import type { CommandHistoryResponse } from '@/shared/contracts';
import { commandHistoryQuerySchema } from '@/shared/schemas';
import { getServerContainer } from '@/server/runtime/server-container-registry';

export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const parsedQuery = commandHistoryQuerySchema.safeParse({
    searchTerm: url.searchParams.get('q') ?? '',
    statuses: url.searchParams.getAll('status'),
  });

  if (!parsedQuery.success) {
    return Response.json(
      { error: 'Invalid Command History query.' },
      { status: 400 },
    );
  }

  const entries = getServerContainer().commandHistoryService.listHistory(
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
