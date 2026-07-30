import type {
  AppSettingsStateUpdate,
  AppSettingsUpdate,
  SettingsSnapshot,
} from '../types/settings.ts';

export type SettingsResponse = SettingsSnapshot;

export type UpdateSettingsRequest = {
  settings?: AppSettingsUpdate;
  state?: AppSettingsStateUpdate;
};
