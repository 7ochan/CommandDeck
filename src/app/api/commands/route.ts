import type { CommandCardsResponse } from '@/shared/contracts';
import { commandCardQuerySchema } from '@/shared/schemas';
import { getServerContainer } from '@/server/runtime/server-container-registry';

export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const parsedQuery = commandCardQuerySchema.safeParse({
    searchTerm: url.searchParams.get('q') ?? '',
    statuses: url.searchParams.getAll('status'),
  });

  if (!parsedQuery.success) {
    return Response.json(
      { error: 'Invalid command card query.' },
      { status: 400 },
    );
  }

  const cards = getServerContainer().commandService.listCommandCards(
    parsedQuery.data,
  );
  const response: CommandCardsResponse = {
    cards,
    visibleCount: cards.length,
  };

  return Response.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
