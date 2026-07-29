import { NextResponse } from 'next/server';
import { getWorkspaceGitDiff } from '@/server/git/git-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cwd = url.searchParams.get('cwd') || process.cwd();

  const result = await getWorkspaceGitDiff(cwd);
  return NextResponse.json(result);
}
