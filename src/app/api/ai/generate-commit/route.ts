import { NextResponse } from 'next/server';
import { aiService } from '../../../../server/ai/ai-service';
import type { AIProviderId } from '../../../../shared/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { provider = 'gemini', diff, apiKey } = await request.json();

    if (!diff || diff.trim().length === 0) {
      return NextResponse.json(
        { error: 'Diff content cannot be empty.' },
        { status: 400 },
      );
    }

    const result = await aiService.generateCommitMessage(
      provider as AIProviderId,
      diff,
      apiKey,
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
