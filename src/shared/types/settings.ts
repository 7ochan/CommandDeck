export const APPLICATION_THEMES = ['dark', 'light', 'system'] as const;
export type ApplicationTheme = (typeof APPLICATION_THEMES)[number];

export const TERMINAL_CURSOR_STYLES = ['block', 'underline', 'bar'] as const;
export type TerminalCursorStyle = (typeof TERMINAL_CURSOR_STYLES)[number];

export const TERMINAL_FONT_SIZE_RANGE = { min: 10, max: 24 } as const;
export const TERMINAL_SCROLLBACK_RANGE = {
  min: 1_000,
  max: 100_000,
} as const;

export const DEVELOPER_HUB_TAB_IDS = ['deck', 'history'] as const;
export type DeveloperHubTabId = (typeof DEVELOPER_HUB_TAB_IDS)[number];

export type AppSettings = {
  general: {
    restorePreviousWorkspace: boolean;
    confirmBeforeDeletingWorkspace: boolean;
    autoFocusTerminalAfterSwitching: boolean;
  };
  terminal: {
    fontSize: number;
    cursorStyle: TerminalCursorStyle;
    cursorBlink: boolean;
    scrollbackSize: number;
  };
  appearance: {
    theme: ApplicationTheme;
  };
  developerHub: {
    rememberLastSelectedTab: boolean;
  };
};

export type AppSettingsUpdate = {
  general?: Partial<AppSettings['general']>;
  terminal?: Partial<AppSettings['terminal']>;
  appearance?: Partial<AppSettings['appearance']>;
  developerHub?: Partial<AppSettings['developerHub']>;
};

/** Durable UI context controlled by settings, but not directly editable. */
export type AppSettingsState = {
  lastWorkspaceId: string | null;
  lastDeveloperHubTab: DeveloperHubTabId | null;
};

export type AppSettingsStateUpdate = Partial<AppSettingsState>;

export type SettingsSnapshot = {
  settings: AppSettings;
  state: AppSettingsState;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: {
    restorePreviousWorkspace: true,
    confirmBeforeDeletingWorkspace: true,
    autoFocusTerminalAfterSwitching: true,
  },
  terminal: {
    fontSize: 14,
    cursorStyle: 'bar',
    cursorBlink: true,
    scrollbackSize: 5_000,
  },
  appearance: {
    theme: 'dark',
  },
  developerHub: {
    rememberLastSelectedTab: false,
  },
};

export const DEFAULT_APP_SETTINGS_STATE: AppSettingsState = {
  lastWorkspaceId: null,
  lastDeveloperHubTab: null,
};
