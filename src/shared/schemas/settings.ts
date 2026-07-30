import { z } from 'zod';

import {
  AI_PROVIDERS,
  APPLICATION_THEMES,
  DECK_SCOPES,
  DEVELOPER_HUB_TAB_IDS,
  DIR_COLORS,
  TERMINAL_FONT_SIZE_RANGE,
  TERMINAL_CURSOR_STYLES,
  TERMINAL_SCROLLBACK_RANGE,
  type AppSettings,
  type AppSettingsState,
} from '../types/settings';

export const terminalFontSizeSchema = z
  .number()
  .int()
  .min(TERMINAL_FONT_SIZE_RANGE.min)
  .max(TERMINAL_FONT_SIZE_RANGE.max);
export const terminalScrollbackSizeSchema = z
  .number()
  .int()
  .min(TERMINAL_SCROLLBACK_RANGE.min)
  .max(TERMINAL_SCROLLBACK_RANGE.max);
export const applicationThemeSchema = z.enum(APPLICATION_THEMES);
export const terminalCursorStyleSchema = z.enum(TERMINAL_CURSOR_STYLES);
export const developerHubTabIdSchema = z.enum(DEVELOPER_HUB_TAB_IDS);
export const deckScopeSchema = z.enum(DECK_SCOPES);
export const dirColorSchema = z.enum(DIR_COLORS);

export const aiProviderSchema = z.enum(AI_PROVIDERS);

const generalSettingsSchema = z.object({
  restorePreviousWorkspace: z.boolean(),
  confirmBeforeDeletingWorkspace: z.boolean(),
  autoFocusTerminalAfterSwitching: z.boolean(),
  showLeftSidebar: z.boolean().default(true),
  showRightSidebar: z.boolean().default(true),
  hoverToRevealSidebars: z.boolean().default(true),
  checkForUpdatesAutomatically: z.boolean().default(true),
});
const terminalSettingsSchema = z.object({
  fontSize: terminalFontSizeSchema,
  cursorStyle: terminalCursorStyleSchema,
  cursorBlink: z.boolean(),
  scrollbackSize: terminalScrollbackSizeSchema,
  dirColor: dirColorSchema.default('cyan'),
});
const appearanceSettingsSchema = z.object({ theme: applicationThemeSchema });
const developerHubSettingsSchema = z.object({
  rememberLastSelectedTab: z.boolean(),
  showHistoryTab: z.boolean().default(true),
  deckScope: deckScopeSchema.default('workspace'),
});
import { DEFAULT_GEMINI_MODEL, SUPPORTED_AI_MODEL_IDS } from '../ai-models';

export const aiModelSchema = z
  .enum(SUPPORTED_AI_MODEL_IDS)
  .catch(DEFAULT_GEMINI_MODEL);

const aiProviderStatusItemSchema = z.object({
  connected: z.boolean(),
  lastVerifiedAt: z.number().optional(),
  error: z.string().optional(),
});

export const aiProviderStatusSchema = z
  .record(z.string(), aiProviderStatusItemSchema)
  .default({});

export const aiProviderModelsSchema = z
  .record(z.string(), z.string())
  .default({ gemini: 'gemini-2.0-flash', openai: 'gpt-4o-mini' });

const aiSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: aiProviderSchema.default('gemini'),
  model: aiModelSchema,
  hasApiKey: z.boolean().default(false),
  providerStatus: aiProviderStatusSchema,
  providerModels: aiProviderModelsSchema,
});
const keybindingsSchema = z.record(z.string(), z.string());

export const appSettingsSchema: z.ZodType<AppSettings> = z.object({
  general: generalSettingsSchema,
  terminal: terminalSettingsSchema,
  appearance: appearanceSettingsSchema,
  developerHub: developerHubSettingsSchema,
  ai: aiSettingsSchema,
  keybindings: keybindingsSchema,
});

export const appSettingsUpdateSchema = z
  .object({
    general: generalSettingsSchema.partial().optional(),
    terminal: terminalSettingsSchema.partial().optional(),
    appearance: appearanceSettingsSchema.partial().optional(),
    developerHub: developerHubSettingsSchema.partial().optional(),
    ai: aiSettingsSchema.partial().optional(),
    keybindings: keybindingsSchema.optional(),
  })
  .strict();

const settingsStateObjectSchema = z.object({
  lastWorkspaceId: z.string().min(1).max(200).nullable(),
  lastDeveloperHubTab: developerHubTabIdSchema.nullable(),
});

export const appSettingsStateSchema: z.ZodType<AppSettingsState> =
  settingsStateObjectSchema;

export const appSettingsStateUpdateSchema = settingsStateObjectSchema.partial();

export const settingsSnapshotSchema = z.object({
  settings: appSettingsSchema,
  state: appSettingsStateSchema,
});

export const updateSettingsRequestSchema = z
  .object({
    settings: appSettingsUpdateSchema.optional(),
    state: appSettingsStateUpdateSchema.optional(),
  })
  .strict()
  .refine((value) => value.settings !== undefined || value.state !== undefined);
