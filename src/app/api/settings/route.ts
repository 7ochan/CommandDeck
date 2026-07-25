import type {
  SettingsResponse,
  UpdateSettingsRequest,
} from '@/shared/contracts';
import {
  settingsSnapshotSchema,
  updateSettingsRequestSchema,
} from '@/shared/schemas';
import { getServerContainer } from '@/server/runtime/server-container-registry';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const response: SettingsResponse = settingsSnapshotSchema.parse(
    getServerContainer().settingsService.getSnapshot(),
  );

  return Response.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PATCH(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsedRequest = updateSettingsRequestSchema.safeParse(payload);

  if (!parsedRequest.success) {
    return Response.json(
      { error: 'One or more settings are invalid.' },
      { status: 400 },
    );
  }

  const update: UpdateSettingsRequest = parsedRequest.data;
  const response: SettingsResponse = settingsSnapshotSchema.parse(
    getServerContainer().settingsService.update(update.settings, update.state),
  );

  return Response.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
