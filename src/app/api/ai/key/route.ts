import { NextResponse } from 'next/server';
import { aiService } from '../../../../server/ai/ai-service.ts';
import type { AIProviderId } from '../../../../shared/types/index.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = (searchParams.get('provider') ?? 'gemini') as AIProviderId;
    return NextResponse.json({
      success: true,
      hasApiKey: aiService.hasApiKey(provider),
    });
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
    const providerId = provider as AIProviderId;
    if (typeof apiKey === 'string') {
      aiService.setApiKey(providerId, apiKey);
    }
    return NextResponse.json({
      success: true,
      hasApiKey: aiService.hasApiKey(providerId),
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
