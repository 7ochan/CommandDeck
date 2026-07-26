import type {
  AppSettings,
  AppSettingsUpdate,
  ApplicationTheme,
} from '@/shared/types';

export type ResolvedTheme = Exclude<ApplicationTheme, 'system'>;

export function mergeAppSettings(
  current: AppSettings,
  update: AppSettingsUpdate,
): AppSettings {
  return {
    general: { ...current.general, ...update.general },
    terminal: { ...current.terminal, ...update.terminal },
    appearance: { ...current.appearance, ...update.appearance },
    developerHub: { ...current.developerHub, ...update.developerHub },
    keybindings: update.keybindings
      ? { ...current.keybindings, ...update.keybindings }
      : current.keybindings,
  };
}

export function resolveApplicationTheme(
  preference: ApplicationTheme,
  systemPrefersDark: boolean,
): ResolvedTheme {
  return preference === 'system'
    ? systemPrefersDark
      ? 'dark'
      : 'light'
    : preference;
}
