import { NextResponse } from 'next/server';
import { aiService } from '../../../../server/ai/ai-service';
import type { AIProviderId } from '../../../../shared/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { provider = 'gemini', apiKey } = await request.json();
    aiService.setApiKey(provider as AIProviderId, apiKey);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }
}
