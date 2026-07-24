import type {
  CreateWorkspaceRequest,
  WorkspacesResponse,
} from '@/shared/contracts';
import {
  createWorkspaceSchema,
  workspaceSummarySchema,
} from '@/shared/schemas';
import { getServerContainer } from '@/server/runtime/server-container-registry';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const response: WorkspacesResponse = {
    workspaces: getServerContainer().workspaceService.listWorkspaces(),
  };

  return Response.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsedRequest = createWorkspaceSchema.safeParse(payload);

  if (!parsedRequest.success) {
    return Response.json(
      { error: 'Workspace name must contain 1 to 80 characters.' },
      { status: 400 },
    );
  }

  const requestBody: CreateWorkspaceRequest = parsedRequest.data;
  const result = getServerContainer().workspaceService.createWorkspace(
    requestBody.name,
  );

  return result.outcome === 'created'
    ? Response.json(workspaceSummarySchema.parse(result.workspace), {
        status: 201,
      })
    : Response.json(
        { error: 'A Workspace with this name already exists.' },
        { status: 409 },
      );
}
