import { NextResponse } from 'next/server';
import { aiService } from '../../../../server/ai/ai-service.ts';
import type { AIProviderId } from '../../../../shared/types/index.ts';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { provider = 'gemini', apiKey } = await request.json();
    const result = await aiService.testConnection(
      provider as AIProviderId,
      apiKey,
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }
}
