import {
  workspaceSummarySchema,
  workspacesResponseSchema,
} from '@/shared/schemas';
import type { WorkspaceSummary } from '@/shared/types';

export async function loadWorkspaces(
  signal?: AbortSignal,
): Promise<WorkspaceSummary[]> {
  const response = await fetch('/api/workspaces', {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unable to load Workspaces (${response.status}).`);
  }

  const payload: unknown = await response.json();
  return workspacesResponseSchema.parse(payload).workspaces;
}

export async function createWorkspace(name: string): Promise<WorkspaceSummary> {
  return mutateWorkspace('/api/workspaces', 'POST', { name });
}

export async function renameWorkspace(
  workspaceId: string,
  name: string,
): Promise<WorkspaceSummary> {
  return mutateWorkspace(
    `/api/workspaces/${encodeURIComponent(workspaceId)}`,
    'PATCH',
    { name },
  );
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}`,
    { method: 'DELETE' },
  );

  if (response.ok) {
    return;
  }

  throw new Error(
    await readApiError(
      response,
      `Unable to delete Workspace (${response.status}).`,
    ),
  );
}

async function mutateWorkspace(
  url: string,
  method: 'POST' | 'PATCH',
  body: { name: string },
): Promise<WorkspaceSummary> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        `Unable to save Workspace (${response.status}).`,
      ),
    );
  }

  const payload: unknown = await response.json();
  return workspaceSummarySchema.parse(payload);
}

async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload: unknown = await response.json();

    if (
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
    ) {
      return payload.error;
    }
  } catch {
    // Use the status-aware fallback for non-JSON responses.
  }

  return fallback;
}
