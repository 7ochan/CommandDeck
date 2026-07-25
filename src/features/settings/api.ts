import { settingsSnapshotSchema } from '@/shared/schemas';
import type {
  AppSettingsStateUpdate,
  AppSettingsUpdate,
  SettingsSnapshot,
} from '@/shared/types';

export async function loadSettings(
  signal?: AbortSignal,
): Promise<SettingsSnapshot> {
  const response = await fetch('/api/settings', {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unable to load Settings (${response.status}).`);
  }

  return settingsSnapshotSchema.parse(await response.json());
}

export async function saveSettings(
  settings: AppSettingsUpdate | undefined,
  state: AppSettingsStateUpdate | undefined,
): Promise<SettingsSnapshot> {
  const response = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, state }),
  });

  if (!response.ok) {
    throw new Error(`Unable to save Settings (${response.status}).`);
  }

  return settingsSnapshotSchema.parse(await response.json());
}
