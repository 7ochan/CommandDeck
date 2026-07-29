export const APPLICATION_THEMES = ['dark', 'light', 'system'] as const;
export type ApplicationTheme = (typeof APPLICATION_THEMES)[number];

export const TERMINAL_CURSOR_STYLES = ['block', 'underline', 'bar'] as const;
export type TerminalCursorStyle = (typeof TERMINAL_CURSOR_STYLES)[number];

export const DIR_COLORS = [
  'cyan',
  'emerald',
  'purple',
  'amber',
  'coral',
  'blue',
  'magenta',
] as const;
export type DirColor = (typeof DIR_COLORS)[number];

export const TERMINAL_FONT_SIZE_RANGE = { min: 10, max: 24 } as const;
export const TERMINAL_SCROLLBACK_RANGE = {
  min: 1_000,
  max: 100_000,
} as const;

export const DEVELOPER_HUB_TAB_IDS = ['deck', 'history'] as const;
export type DeveloperHubTabId = (typeof DEVELOPER_HUB_TAB_IDS)[number];

export const DECK_SCOPES = ['workspace', 'global'] as const;
export type DeckScope = (typeof DECK_SCOPES)[number];
export const AI_PROVIDERS = [
  'gemini',
  'openai',
  'anthropic',
  'ollama',
] as const;
export type AIProviderId = (typeof AI_PROVIDERS)[number];

export type AIProviderStatus = {
  connected: boolean;
  lastVerifiedAt?: number;
  error?: string;
};

export type AISettings = {
  enabled: boolean;
  provider: AIProviderId;
  model: string;
  hasApiKey: boolean;
  providerStatus?: Record<string, AIProviderStatus>;
  providerModels?: Record<string, string>;
};

export type AppSettings = {
  general: {
    restorePreviousWorkspace: boolean;
    confirmBeforeDeletingWorkspace: boolean;
    autoFocusTerminalAfterSwitching: boolean;
    showLeftSidebar: boolean;
    showRightSidebar: boolean;
    hoverToRevealSidebars: boolean;
  };
  terminal: {
    fontSize: number;
    cursorStyle: TerminalCursorStyle;
    cursorBlink: boolean;
    scrollbackSize: number;
    dirColor: DirColor;
  };
  appearance: {
    theme: ApplicationTheme;
  };
  developerHub: {
    rememberLastSelectedTab: boolean;
    showHistoryTab: boolean;
    deckScope: DeckScope;
  };
  ai: AISettings;
  keybindings: Record<string, string>;
};

export type AppSettingsUpdate = {
  general?: Partial<AppSettings['general']>;
  terminal?: Partial<AppSettings['terminal']>;
  appearance?: Partial<AppSettings['appearance']>;
  developerHub?: Partial<AppSettings['developerHub']>;
  ai?: Partial<AppSettings['ai']>;
  keybindings?: AppSettings['keybindings'];
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
    showLeftSidebar: true,
    showRightSidebar: true,
    hoverToRevealSidebars: true,
  },
  terminal: {
    fontSize: 14,
    cursorStyle: 'bar',
    cursorBlink: true,
    scrollbackSize: 5_000,
    dirColor: 'cyan',
  },
  appearance: {
    theme: 'dark',
  },
  developerHub: {
    rememberLastSelectedTab: false,
    showHistoryTab: true,
    deckScope: 'workspace',
  },
  ai: {
    enabled: false,
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    hasApiKey: false,
    providerStatus: {},
    providerModels: {
      gemini: 'gemini-2.0-flash',
      openai: 'gpt-4o-mini',
    },
  },
  keybindings: {},
};

export const DEFAULT_APP_SETTINGS_STATE: AppSettingsState = {
  lastWorkspaceId: null,
  lastDeveloperHubTab: null,
};
