import { NextResponse } from 'next/server';
import { aiService } from '../../../../server/ai/ai-service';
import type { AIProviderId } from '../../../../shared/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const hasApiKeyMap = aiService.getAllHasMap();
    return NextResponse.json({ success: true, hasApiKeyMap });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { provider = 'gemini', apiKey } = await request.json();
    if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
      aiService.setApiKey(provider as AIProviderId, apiKey);
    }
    return NextResponse.json({
      success: true,
      hasApiKeyMap: aiService.getAllHasMap(),
    });
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
