import type {
  AppSettingsStateUpdate,
  AppSettingsUpdate,
  SettingsSnapshot,
} from '../types/settings';

export type SettingsResponse = SettingsSnapshot;

export type UpdateSettingsRequest = {
  settings?: AppSettingsUpdate;
  state?: AppSettingsStateUpdate;
};
