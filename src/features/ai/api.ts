import type { AIProviderId } from '@/shared/types';
import type { AICommitResult, AITestConnectionResult } from './types';

export async function fetchWorkspaceGitDiff(cwd?: string): Promise<{
  diff: string;
  isStaged: boolean;
  hasChanges: boolean;
  error?: string;
}> {
  const url = cwd
    ? `/api/git/diff?cwd=${encodeURIComponent(cwd)}`
    : '/api/git/diff';
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to fetch Git diff');
  }
  return response.json();
}

export async function executeGitCommitMessage(
  message: string,
  cwd?: string,
): Promise<{ success: boolean; output?: string; error?: string }> {
  const response = await fetch('/api/git/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, cwd }),
  });
  return response.json();
}

export async function setAIProviderApiKey(
  provider: AIProviderId,
  apiKey: string,
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/api/ai/key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey }),
  });
  return response.json();
}

export async function testAIConnection(
  provider: AIProviderId,
  apiKey?: string,
): Promise<AITestConnectionResult> {
  const response = await fetch('/api/ai/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey }),
  });
  return response.json();
}

export async function generateAICommitMessage(
  diff: string,
  provider: AIProviderId = 'gemini',
  apiKey?: string,
  model?: string,
): Promise<AICommitResult> {
  const response = await fetch('/api/ai/generate-commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ diff, provider, apiKey, model }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to generate commit message.');
  }

  return data;
}
