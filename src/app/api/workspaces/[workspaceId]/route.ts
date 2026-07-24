import type { RenameWorkspaceRequest } from '@/shared/contracts';
import {
  renameWorkspaceSchema,
  workspaceIdSchema,
  workspaceSummarySchema,
} from '@/shared/schemas';
import { getServerContainer } from '@/server/runtime/server-container-registry';

type WorkspaceRouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function PATCH(
  request: Request,
  { params }: WorkspaceRouteContext,
): Promise<Response> {
  const parsedId = workspaceIdSchema.safeParse((await params).workspaceId);

  if (!parsedId.success) {
    return Response.json({ error: 'Invalid Workspace ID.' }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsedRequest = renameWorkspaceSchema.safeParse(payload);

  if (!parsedRequest.success) {
    return Response.json(
      { error: 'Workspace name must contain 1 to 80 characters.' },
      { status: 400 },
    );
  }

  const requestBody: RenameWorkspaceRequest = parsedRequest.data;
  const result = getServerContainer().workspaceService.renameWorkspace(
    parsedId.data,
    requestBody.name,
  );

  if (result.outcome === 'name-exists') {
    return Response.json(
      { error: 'A Workspace with this name already exists.' },
      { status: 409 },
    );
  }

  return result.outcome === 'renamed'
    ? Response.json(workspaceSummarySchema.parse(result.workspace))
    : Response.json({ error: 'Workspace not found.' }, { status: 404 });
}

export async function DELETE(
  _request: Request,
  { params }: WorkspaceRouteContext,
): Promise<Response> {
  const parsedId = workspaceIdSchema.safeParse((await params).workspaceId);

  if (!parsedId.success) {
    return Response.json({ error: 'Invalid Workspace ID.' }, { status: 400 });
  }

  const result = getServerContainer().workspaceService.deleteWorkspace(
    parsedId.data,
  );

  if (result.outcome === 'final-workspace') {
    return Response.json(
      { error: 'The final Workspace cannot be deleted.' },
      { status: 409 },
    );
  }

  return result.outcome === 'deleted'
    ? new Response(null, { status: 204 })
    : Response.json({ error: 'Workspace not found.' }, { status: 404 });
}
