import { NextResponse } from 'next/server';
import { executeGitCommit } from '@/server/git/git-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cwd = process.cwd(), message } = body;

    const result = await executeGitCommit(cwd, message);
    return NextResponse.json(result);
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
