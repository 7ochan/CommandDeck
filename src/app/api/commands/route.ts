import type { CommandCardsResponse } from '@/shared/contracts';
import { getServerContainer } from '@/server/runtime/server-container-registry';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const response: CommandCardsResponse = {
    cards: getServerContainer().commandService.listCommandCards(),
  };

  return Response.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
