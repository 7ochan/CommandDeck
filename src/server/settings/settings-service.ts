import { z } from 'zod';

import {
  APPLICATION_THEMES,
  DEFAULT_APP_SETTINGS,
  DEFAULT_APP_SETTINGS_STATE,
  DEVELOPER_HUB_TAB_IDS,
  TERMINAL_FONT_SIZE_RANGE,
  TERMINAL_CURSOR_STYLES,
  TERMINAL_SCROLLBACK_RANGE,
  type AppSettingsStateUpdate,
  type AppSettingsUpdate,
  type SettingsSnapshot,
} from '../../shared/types/settings.js';
import type {
  SettingsRepository,
  StoredSetting,
} from '../db/repositories/settings-repository.js';

const KEYS = {
  restorePreviousWorkspace: 'general.restorePreviousWorkspace',
  confirmBeforeDeletingWorkspace: 'general.confirmBeforeDeletingWorkspace',
  autoFocusTerminalAfterSwitching: 'general.autoFocusTerminalAfterSwitching',
  terminalFontSize: 'terminal.fontSize',
  terminalCursorStyle: 'terminal.cursorStyle',
  terminalCursorBlink: 'terminal.cursorBlink',
  terminalScrollbackSize: 'terminal.scrollbackSize',
  theme: 'appearance.theme',
  rememberLastSelectedTab: 'developerHub.rememberLastSelectedTab',
  keybindings: 'keybindings.customizations',
  lastWorkspaceId: 'state.lastWorkspaceId',
  lastDeveloperHubTab: 'state.lastDeveloperHubTab',
} as const;

export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly now: () => number = Date.now,
  ) {}

  getSnapshot(): SettingsSnapshot {
    const values = new Map(
      this.repository.findAll().map(({ key, value }) => [key, value]),
    );

    return {
      settings: {
        general: {
          restorePreviousWorkspace: read(
            values,
            KEYS.restorePreviousWorkspace,
            booleanSchema,
            DEFAULT_APP_SETTINGS.general.restorePreviousWorkspace,
          ),
          confirmBeforeDeletingWorkspace: read(
            values,
            KEYS.confirmBeforeDeletingWorkspace,
            booleanSchema,
            DEFAULT_APP_SETTINGS.general.confirmBeforeDeletingWorkspace,
          ),
          autoFocusTerminalAfterSwitching: read(
            values,
            KEYS.autoFocusTerminalAfterSwitching,
            booleanSchema,
            DEFAULT_APP_SETTINGS.general.autoFocusTerminalAfterSwitching,
          ),
        },
        terminal: {
          fontSize: read(
            values,
            KEYS.terminalFontSize,
            terminalFontSizeSchema,
            DEFAULT_APP_SETTINGS.terminal.fontSize,
          ),
          cursorStyle: read(
            values,
            KEYS.terminalCursorStyle,
            terminalCursorStyleSchema,
            DEFAULT_APP_SETTINGS.terminal.cursorStyle,
          ),
          cursorBlink: read(
            values,
            KEYS.terminalCursorBlink,
            booleanSchema,
            DEFAULT_APP_SETTINGS.terminal.cursorBlink,
          ),
          scrollbackSize: read(
            values,
            KEYS.terminalScrollbackSize,
            terminalScrollbackSizeSchema,
            DEFAULT_APP_SETTINGS.terminal.scrollbackSize,
          ),
        },
        appearance: {
          theme: read(
            values,
            KEYS.theme,
            applicationThemeSchema,
            DEFAULT_APP_SETTINGS.appearance.theme,
          ),
        },
        developerHub: {
          rememberLastSelectedTab: read(
            values,
            KEYS.rememberLastSelectedTab,
            booleanSchema,
            DEFAULT_APP_SETTINGS.developerHub.rememberLastSelectedTab,
          ),
        },
        keybindings: read(
          values,
          KEYS.keybindings,
          keybindingsSchema,
          DEFAULT_APP_SETTINGS.keybindings,
        ),
      },
      state: {
        lastWorkspaceId: read(
          values,
          KEYS.lastWorkspaceId,
          nullableWorkspaceIdSchema,
          DEFAULT_APP_SETTINGS_STATE.lastWorkspaceId,
        ),
        lastDeveloperHubTab: read(
          values,
          KEYS.lastDeveloperHubTab,
          developerHubTabIdSchema.nullable(),
          DEFAULT_APP_SETTINGS_STATE.lastDeveloperHubTab,
        ),
      },
    };
  }

  update(
    settingsUpdate?: AppSettingsUpdate,
    stateUpdate?: AppSettingsStateUpdate,
  ): SettingsSnapshot {
    const updatedAt = this.now();
    const entries: StoredSetting[] = [];
    addDefinedSettings(entries, settingsUpdate, updatedAt);
    addDefinedState(entries, stateUpdate, updatedAt);

    if (entries.length > 0) {
      this.repository.upsert(entries);
    }

    return this.getSnapshot();
  }
}

const booleanSchema = z.boolean();
const nullableWorkspaceIdSchema = z.string().min(1).max(200).nullable();
const applicationThemeSchema = z.enum(APPLICATION_THEMES);
const developerHubTabIdSchema = z.enum(DEVELOPER_HUB_TAB_IDS);
const terminalCursorStyleSchema = z.enum(TERMINAL_CURSOR_STYLES);
const terminalFontSizeSchema = z
  .number()
  .int()
  .min(TERMINAL_FONT_SIZE_RANGE.min)
  .max(TERMINAL_FONT_SIZE_RANGE.max);
const terminalScrollbackSizeSchema = z
  .number()
  .int()
  .min(TERMINAL_SCROLLBACK_RANGE.min)
  .max(TERMINAL_SCROLLBACK_RANGE.max);

const keybindingsSchema = z.record(z.string(), z.string());

type SafeParser<T> = Pick<z.ZodType<T>, 'safeParse'>;

function read<T>(
  values: ReadonlyMap<string, string>,
  key: string,
  schema: SafeParser<T>,
  fallback: T,
): T {
  const stored = values.get(key);

  if (stored === undefined) {
    return fallback;
  }

  try {
    const parsed = schema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

function addDefinedSettings(
  entries: StoredSetting[],
  update: AppSettingsUpdate | undefined,
  updatedAt: number,
): void {
  const add = (key: string, value: unknown) => {
    if (value !== undefined) {
      entries.push({ key, value: JSON.stringify(value), updatedAt });
    }
  };

  add(KEYS.restorePreviousWorkspace, update?.general?.restorePreviousWorkspace);
  add(
    KEYS.confirmBeforeDeletingWorkspace,
    update?.general?.confirmBeforeDeletingWorkspace,
  );
  add(
    KEYS.autoFocusTerminalAfterSwitching,
    update?.general?.autoFocusTerminalAfterSwitching,
  );
  add(KEYS.terminalFontSize, update?.terminal?.fontSize);
  add(KEYS.terminalCursorStyle, update?.terminal?.cursorStyle);
  add(KEYS.terminalCursorBlink, update?.terminal?.cursorBlink);
  add(KEYS.terminalScrollbackSize, update?.terminal?.scrollbackSize);
  add(KEYS.theme, update?.appearance?.theme);
  add(
    KEYS.rememberLastSelectedTab,
    update?.developerHub?.rememberLastSelectedTab,
  );
  add(KEYS.keybindings, update?.keybindings);
}

function addDefinedState(
  entries: StoredSetting[],
  update: AppSettingsStateUpdate | undefined,
  updatedAt: number,
): void {
  const add = (key: string, value: unknown) => {
    if (value !== undefined) {
      entries.push({ key, value: JSON.stringify(value), updatedAt });
    }
  };

  add(KEYS.lastWorkspaceId, update?.lastWorkspaceId);
  add(KEYS.lastDeveloperHubTab, update?.lastDeveloperHubTab);
}
