'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import { KeyboardShortcutsSection } from '@/features/keybindings/components/keyboard-shortcuts-section';
import { mergeAppSettings } from '@/features/settings/settings-state';
import { setAIProviderApiKey, testAIConnection } from '@/features/ai/api';
import type {
  AppSettings,
  AppSettingsUpdate,
  ApplicationTheme,
  AIProviderId,
  DeckScope,
  DirColor,
  TerminalCursorStyle,
} from '@/shared/types';
import {
  DIR_COLOR_PALETTES,
  applyAccentTheme,
} from '@/features/terminal/terminal-presentation';
import {
  GEMINI_MODELS,
  OPENAI_MODELS,
  getDefaultModelForProvider,
} from '@/shared/ai-models';
import { DEFAULT_APP_SETTINGS } from '@/shared/types';

const SECTIONS = [
  {
    id: 'general',
    label: 'General',
    icon: 'workspace',
    description: 'Workspace startup, focus, and safety.',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: 'terminal',
    description: 'Text, cursor, and scrollback presentation.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: 'appearance',
    description: 'Choose how CommandDeck looks on this device.',
  },
  {
    id: 'developerHub',
    label: 'Developer Hub',
    icon: 'deck',
    description: 'Control how the tool panel restores its context.',
  },
  {
    id: 'ai',
    label: 'AI Assistant',
    icon: 'sparkles',
    description:
      'Configure Gemini API keys and AI commit assistant preferences.',
  },
  {
    id: 'keybindings',
    label: 'Keyboard Shortcuts',
    icon: 'keyboard',
    description: 'Customize application keybindings and action shortcuts.',
  },
] as const satisfies ReadonlyArray<{
  id: keyof AppSettings;
  label: string;
  icon: IconName;
  description: string;
}>;

type SettingsSection = (typeof SECTIONS)[number]['id'];

type SettingsDialogProps = {
  isOpen: boolean;
  settings: AppSettings;
  isLoading: boolean;
  persistenceError: string | null;
  initialSection?: SettingsSection;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
};

export function SettingsDialog({
  isOpen,
  settings,
  isLoading,
  persistenceError,
  initialSection,
  onSave,
  onClose,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [draftSettings, setDraftSettings] = useState(settings);
  const [selectedSection, setSelectedSection] =
    useState<SettingsSection | null>(null);
  const activeSection =
    selectedSection ?? (isOpen && initialSection ? initialSection : 'general');
  const activeSectionDetails = SECTIONS.find(({ id }) => id === activeSection);
  const hasChanges = !areSettingsEqual(draftSettings, settings);
  const isDefaultDraft = areSettingsEqual(draftSettings, DEFAULT_APP_SETTINGS);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      setDraftSettings(settings);
      setSelectedSection(null);
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen, settings]);

  const dirColor = draftSettings.terminal.dirColor;
  useEffect(() => {
    if (isOpen) {
      applyAccentTheme(dirColor);
    }
  }, [isOpen, dirColor]);

  const handleClose = () => {
    applyAccentTheme(settings.terminal.dirColor);
    onClose();
  };

  const updateDraft = (update: AppSettingsUpdate) => {
    setDraftSettings((current: AppSettings) =>
      mergeAppSettings(current, update),
    );
  };

  const save = () => {
    if (!hasChanges || isLoading) {
      return;
    }

    onSave(draftSettings);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="cd-dialog max-h-[calc(100dvh-2rem)] w-[min(52rem,calc(100vw-2rem))] overflow-clip rounded-lg p-0"
      aria-labelledby={titleId}
      onCancel={handleClose}
      onClose={() => {
        if (isOpen) handleClose();
      }}
      onScroll={(event) => {
        event.currentTarget.scrollTop = 0;
        event.currentTarget.scrollLeft = 0;
      }}
    >
      <div
        className="flex h-[min(36rem,calc(100dvh-2.5rem))] flex-col overflow-clip"
        onScroll={(event) => {
          event.currentTarget.scrollTop = 0;
          event.currentTarget.scrollLeft = 0;
        }}
      >
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-soft)] px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="cd-clay-tile cd-clay-tile--accent flex size-8 shrink-0 items-center justify-center rounded-sm">
              <Icon name="settings" size={15} />
            </span>
            <div>
              <h2
                id={titleId}
                className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-[var(--text-primary)]"
              >
                Settings
              </h2>
              <p className="text-[10px] leading-4 text-[var(--text-muted)]">
                CommandDeck preferences
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {hasChanges && !persistenceError && (
              <span
                className="hidden text-[9px] text-[var(--warning)] sm:block"
                role="status"
              >
                Unsaved changes
              </span>
            )}
            <button
              type="button"
              className="cd-icon-button cd-button--quiet size-8 shrink-0 text-[var(--text-muted)]"
              aria-label="Close Settings"
              title="Close Settings"
              onClick={onClose}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        </header>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-clip sm:flex-row"
          onScroll={(event) => {
            event.currentTarget.scrollTop = 0;
            event.currentTarget.scrollLeft = 0;
          }}
        >
          <aside className="shrink-0 overflow-y-auto border-b border-[var(--border-soft)] bg-[var(--canvas-raised)] px-3 py-2.5 sm:w-[13rem] sm:border-r sm:border-b-0 sm:p-3">
            <p className="cd-eyebrow hidden px-2.5 pt-1 pb-2 sm:block">
              Categories
            </p>

            <nav
              className="grid grid-cols-2 gap-1 sm:grid-cols-1"
              aria-label="Settings categories"
            >
              {SECTIONS.map((section) => {
                const isActive = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    className="cd-settings-nav-item flex h-9.5 min-w-0 items-center gap-2.5 rounded-sm px-2.5 text-left text-[11px] font-medium"
                    onClick={() => setSelectedSection(section.id)}
                  >
                    <Icon name={section.icon} size={14} />
                    <span className="truncate">{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-clip"
            onScroll={(event) => {
              event.currentTarget.scrollTop = 0;
              event.currentTarget.scrollLeft = 0;
            }}
          >
            <header className="shrink-0 border-b border-[var(--border-soft)] px-5 py-3.5 sm:px-6 sm:py-4">
              <h3 className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                {activeSectionDetails?.label}
              </h3>
              <p
                className={`mt-0.5 text-[10px] leading-4 ${persistenceError ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}
                role={
                  persistenceError ? 'alert' : isLoading ? 'status' : undefined
                }
              >
                {persistenceError ??
                  (isLoading
                    ? 'Loading saved settings…'
                    : activeSectionDetails?.description)}
              </p>
            </header>

            <div className="cd-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <fieldset
                disabled={isLoading}
                className="m-0 min-w-0 border-0 p-0 disabled:opacity-60"
              >
                {activeSection === 'general' && (
                  <div className="space-y-6">
                    <SettingsGroup
                      title="Workspace behavior"
                      description="Control how CommandDeck restores and protects your working context."
                    >
                      <ToggleSetting
                        label="Restore previous workspace on startup"
                        description="Open the workspace that was active when CommandDeck last closed."
                        checked={draftSettings.general.restorePreviousWorkspace}
                        onChange={(restorePreviousWorkspace) =>
                          updateDraft({ general: { restorePreviousWorkspace } })
                        }
                      />
                      <ToggleSetting
                        label="Confirm before deleting workspace"
                        description="Ask before permanently removing its History and Deck items."
                        checked={
                          draftSettings.general.confirmBeforeDeletingWorkspace
                        }
                        onChange={(confirmBeforeDeletingWorkspace) =>
                          updateDraft({
                            general: { confirmBeforeDeletingWorkspace },
                          })
                        }
                      />
                      <ToggleSetting
                        label="Auto-focus terminal after switching"
                        description="Move keyboard focus to the terminal when changing workspaces."
                        checked={
                          draftSettings.general.autoFocusTerminalAfterSwitching
                        }
                        onChange={(autoFocusTerminalAfterSwitching) =>
                          updateDraft({
                            general: { autoFocusTerminalAfterSwitching },
                          })
                        }
                      />
                    </SettingsGroup>

                    <SettingsGroup
                      title="Sidebar layout & hover peek"
                      description="Hide panels to maximize terminal screen space, or reveal them by hovering at screen edges."
                    >
                      <ToggleSetting
                        label="Show Left Sidebar (Workspaces)"
                        description="Display the workspace switcher tabs panel on the left."
                        checked={draftSettings.general.showLeftSidebar}
                        onChange={(showLeftSidebar) =>
                          updateDraft({ general: { showLeftSidebar } })
                        }
                      />
                      <ToggleSetting
                        label="Show Right Sidebar (Developer Hub)"
                        description="Display the Command Deck and History tool panel on the right."
                        checked={draftSettings.general.showRightSidebar}
                        onChange={(showRightSidebar) =>
                          updateDraft({ general: { showRightSidebar } })
                        }
                      />
                      <ToggleSetting
                        label="Enable Command History tab"
                        description="Show the History tab inside the right sidebar alongside the Command Deck."
                        checked={draftSettings.developerHub.showHistoryTab}
                        onChange={(showHistoryTab) =>
                          updateDraft({ developerHub: { showHistoryTab } })
                        }
                      />
                    </SettingsGroup>
                  </div>
                )}

                {activeSection === 'terminal' && (
                  <SettingsGroup
                    title="Terminal presentation"
                    description="These options update every open terminal immediately."
                  >
                    <SelectSetting
                      label="Directory name color (Dir Color Theme)"
                      description="Choose a unique theme color for directory names in shell output."
                      value={draftSettings.terminal.dirColor}
                      onChange={(value) =>
                        updateDraft({
                          terminal: { dirColor: value as DirColor },
                        })
                      }
                    >
                      {Object.entries(DIR_COLOR_PALETTES).map(([key, item]) => (
                        <option key={key} value={key}>
                          {item.name}
                        </option>
                      ))}
                    </SelectSetting>

                    <div className="py-2">
                      <p className="mb-2 text-[11px] font-medium text-[var(--text-secondary)]">
                        Directory Color Swatches
                      </p>
                      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                        {(Object.keys(DIR_COLOR_PALETTES) as DirColor[]).map(
                          (col) => {
                            const palette = DIR_COLOR_PALETTES[col];
                            const isSelected =
                              draftSettings.terminal.dirColor === col;
                            return (
                              <button
                                key={col}
                                type="button"
                                onClick={() =>
                                  updateDraft({
                                    terminal: { dirColor: col },
                                  })
                                }
                                className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all ${
                                  isSelected
                                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]'
                                    : 'border-[var(--border-soft)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)]'
                                }`}
                              >
                                <span
                                  className="size-4.5 rounded-full shadow-sm"
                                  style={{
                                    backgroundColor: palette.dark.main,
                                    boxShadow: `0 0 8px ${palette.dark.main}66`,
                                  }}
                                />
                                <span className="max-w-full truncate text-[9.5px] font-medium text-[var(--text-primary)] capitalize">
                                  {col}
                                </span>
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>

                    <SelectSetting
                      label="Font size"
                      description="Terminal text size in pixels."
                      value={String(draftSettings.terminal.fontSize)}
                      onChange={(value) =>
                        updateDraft({ terminal: { fontSize: Number(value) } })
                      }
                    >
                      {[10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24].map(
                        (size) => (
                          <option key={size} value={size}>
                            {size} px
                          </option>
                        ),
                      )}
                    </SelectSetting>
                    <SelectSetting
                      label="Cursor style"
                      description="Choose the terminal insertion marker."
                      value={draftSettings.terminal.cursorStyle}
                      onChange={(cursorStyle) =>
                        updateDraft({
                          terminal: {
                            cursorStyle: cursorStyle as TerminalCursorStyle,
                          },
                        })
                      }
                    >
                      <option value="block">Block</option>
                      <option value="underline">Underline</option>
                      <option value="bar">Bar</option>
                    </SelectSetting>
                    <ToggleSetting
                      label="Cursor blinking"
                      description="Animate the cursor while the terminal is focused."
                      checked={draftSettings.terminal.cursorBlink}
                      onChange={(cursorBlink) =>
                        updateDraft({ terminal: { cursorBlink } })
                      }
                    />
                    <SelectSetting
                      label="Scrollback size"
                      description="Maximum lines retained in each terminal buffer."
                      value={String(draftSettings.terminal.scrollbackSize)}
                      onChange={(value) =>
                        updateDraft({
                          terminal: { scrollbackSize: Number(value) },
                        })
                      }
                    >
                      {[
                        1_000, 2_500, 5_000, 10_000, 20_000, 50_000, 100_000,
                      ].map((size) => (
                        <option key={size} value={size}>
                          {size.toLocaleString()} lines
                        </option>
                      ))}
                    </SelectSetting>
                  </SettingsGroup>
                )}

                {activeSection === 'appearance' && (
                  <SettingsGroup
                    title="Interface theme"
                    description="System follows your operating system appearance automatically."
                  >
                    <div className="grid grid-cols-3 gap-2 py-3">
                      {(['dark', 'light', 'system'] as const).map((theme) => (
                        <ThemeOption
                          key={theme}
                          theme={theme}
                          selected={draftSettings.appearance.theme === theme}
                          onSelect={() =>
                            updateDraft({ appearance: { theme } })
                          }
                        />
                      ))}
                    </div>
                  </SettingsGroup>
                )}

                {activeSection === 'developerHub' && (
                  <SettingsGroup
                    title="Developer Hub & Command Deck"
                    description="Configure shortcut scope and panel persistence between sessions."
                  >
                    <SelectSetting
                      label="Saved Deck shortcuts scope"
                      description="Choose whether saved Deck shortcuts are available across all workspace tabs or isolated to the tab where created."
                      value={draftSettings.developerHub.deckScope}
                      onChange={(value) =>
                        updateDraft({
                          developerHub: { deckScope: value as DeckScope },
                        })
                      }
                    >
                      <option value="workspace">
                        Current tab only (Per Workspace)
                      </option>
                      <option value="global">
                        All tabs (Global across Workspaces)
                      </option>
                    </SelectSetting>
                    <ToggleSetting
                      label="Remember last selected tab"
                      description="Restore Deck or History the next time CommandDeck opens."
                      checked={
                        draftSettings.developerHub.rememberLastSelectedTab
                      }
                      onChange={(rememberLastSelectedTab) =>
                        updateDraft({
                          developerHub: { rememberLastSelectedTab },
                        })
                      }
                    />
                  </SettingsGroup>
                )}

                {activeSection === 'ai' && (
                  <AISettingsPanel
                    draftSettings={draftSettings}
                    updateDraft={updateDraft}
                  />
                )}

                {activeSection === 'keybindings' && (
                  <KeyboardShortcutsSection />
                )}
              </fieldset>
            </div>

            <footer className="flex shrink-0 flex-col items-stretch justify-between gap-2 border-t border-[var(--border-soft)] px-5 py-2.5 sm:min-h-13 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
              <button
                type="button"
                className="cd-button cd-button--quiet px-1.5 text-[var(--text-muted)]"
                disabled={isLoading || isDefaultDraft}
                onClick={() => setDraftSettings(DEFAULT_APP_SETTINGS)}
              >
                <Icon name="history" size={13} />
                Restore Defaults
              </button>

              <div className="flex items-center justify-end gap-2">
                <button type="button" className="cd-button" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="cd-button cd-button--primary"
                  disabled={isLoading || !hasChanges}
                  onClick={save}
                >
                  Save
                </button>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </dialog>
  );
}

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="max-w-[36rem]">
      <h4 className="text-[12px] leading-5 font-semibold text-[var(--text-primary)]">
        {title}
      </h4>
      <p className="mt-0.5 max-w-[32rem] text-[10px] leading-4 text-[var(--text-muted)]">
        {description}
      </p>
      <div className="mt-3 divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
        {children}
      </div>
    </section>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="cd-settings-row group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-6 rounded-md px-2.5 py-2.5 transition-colors hover:bg-[var(--surface-2)] sm:gap-8">
      <span className="max-w-[28rem] min-w-0">
        <span className="block text-[12.5px] leading-4 font-medium text-[var(--text-primary)]">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-4 text-[var(--text-muted)]">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span
        aria-hidden="true"
        className="relative h-[18px] w-[34px] shrink-0 rounded-full border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] transition-[background-color,border-color,box-shadow] duration-200 ease-in-out group-hover:border-[var(--border-strong)] peer-checked:border-[var(--accent-border)] peer-checked:bg-[var(--accent)] peer-checked:shadow-none peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--canvas-raised)] peer-disabled:opacity-50 after:absolute after:top-[1.5px] after:left-[1.5px] after:size-[13px] after:rounded-full after:bg-[var(--text-muted)] after:shadow-[0_1px_3px_rgba(0,0,0,0.3)] after:transition-all after:duration-200 after:ease-in-out peer-checked:after:translate-x-[16px] peer-checked:after:bg-white peer-checked:after:shadow-[0_1px_3px_rgba(0,0,0,0.4)] peer-active:after:w-[15px]"
      />
    </label>
  );
}

function SelectSetting({
  label,
  description,
  value,
  onChange,
  children,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="cd-settings-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-1 py-3.5 sm:gap-8">
      <span className="max-w-[28rem] min-w-0">
        <span className="block text-[12px] leading-4 font-medium text-[var(--text-primary)]">
          {label}
        </span>
        <span className="mt-0.5 block text-[10px] leading-4 text-[var(--text-muted)]">
          {description}
        </span>
      </span>
      <select
        value={value}
        className="cd-input h-8 w-36 shrink-0 px-2.5 text-[11px]"
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {children}
      </select>
    </label>
  );
}

function ThemeOption({
  theme,
  selected,
  onSelect,
}: {
  theme: ApplicationTheme;
  selected: boolean;
  onSelect: () => void;
}) {
  const label = theme[0]?.toUpperCase() + theme.slice(1);

  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`flex min-h-22 flex-col items-center justify-center gap-2 rounded-[9px] border text-[10px] font-medium transition-[border-color,background-color,color,box-shadow] ${
        selected
          ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--text-primary)] shadow-[inset_0_1px_0_rgb(255_255_255_/_4%)]'
          : 'border-transparent bg-[var(--surface-1)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]'
      }`}
      onClick={onSelect}
    >
      <span
        className={`flex size-10 items-center justify-center rounded-lg border ${
          theme === 'dark'
            ? 'border-[#38434f] bg-[#111820] text-[#dce2e7]'
            : theme === 'light'
              ? 'border-[#d2d8de] bg-[#f5f7f9] text-[#25313c]'
              : 'border-[var(--border)] bg-[linear-gradient(135deg,#111820_50%,#f5f7f9_50%)] text-[var(--accent)]'
        }`}
      >
        <Icon name={theme === 'system' ? 'system' : 'appearance'} size={17} />
      </span>
      {label}
    </button>
  );
}

function areSettingsEqual(left: AppSettings, right: AppSettings): boolean {
  return (
    left.general.restorePreviousWorkspace ===
      right.general.restorePreviousWorkspace &&
    left.general.confirmBeforeDeletingWorkspace ===
      right.general.confirmBeforeDeletingWorkspace &&
    left.general.autoFocusTerminalAfterSwitching ===
      right.general.autoFocusTerminalAfterSwitching &&
    left.general.showLeftSidebar === right.general.showLeftSidebar &&
    left.general.showRightSidebar === right.general.showRightSidebar &&
    left.general.hoverToRevealSidebars ===
      right.general.hoverToRevealSidebars &&
    left.terminal.fontSize === right.terminal.fontSize &&
    left.terminal.cursorStyle === right.terminal.cursorStyle &&
    left.terminal.cursorBlink === right.terminal.cursorBlink &&
    left.terminal.scrollbackSize === right.terminal.scrollbackSize &&
    left.terminal.dirColor === right.terminal.dirColor &&
    left.appearance.theme === right.appearance.theme &&
    left.developerHub.rememberLastSelectedTab ===
      right.developerHub.rememberLastSelectedTab &&
    left.developerHub.showHistoryTab === right.developerHub.showHistoryTab &&
    left.developerHub.deckScope === right.developerHub.deckScope &&
    left.ai?.enabled === right.ai?.enabled &&
    left.ai?.provider === right.ai?.provider &&
    left.ai?.model === right.ai?.model &&
    left.ai?.hasApiKey === right.ai?.hasApiKey &&
    JSON.stringify(left.keybindings ?? {}) ===
      JSON.stringify(right.keybindings ?? {})
  );
}

function AISettingsPanel({
  draftSettings,
  updateDraft,
}: {
  draftSettings: AppSettings;
  updateDraft: (update: AppSettingsUpdate) => void;
}) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    type: 'idle' | 'testing' | 'success' | 'error';
    message?: string;
  }>({ type: 'idle' });

  const handleApiKeyChange = (val: string) => {
    setApiKeyInput(val);
    const hasApiKey = val.trim().length > 0;
    updateDraft({ ai: { hasApiKey } });
    void setAIProviderApiKey(draftSettings.ai.provider, val);
  };

  const handleTestConnection = async () => {
    setTestStatus({ type: 'testing' });
    try {
      const result = await testAIConnection(
        draftSettings.ai.provider,
        apiKeyInput || undefined,
      );
      if (result.success) {
        setTestStatus({ type: 'success', message: result.message });
      } else {
        setTestStatus({ type: 'error', message: result.message });
      }
    } catch (err) {
      setTestStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Connection test failed',
      });
    }
  };

  return (
    <SettingsGroup
      title="AI Provider & API Configuration"
      description="Configure Google Gemini API credentials for the AI Commit Assistant."
    >
      <ToggleSetting
        label="Enable AI Commit Assistant"
        description="Intelligently generate Conventional Commit messages and change summaries from git diffs."
        checked={draftSettings.ai.enabled}
        onChange={(enabled) => updateDraft({ ai: { enabled } })}
      />
      <SelectSetting
        label="AI Provider"
        description="Choose the AI service used for commit message generation."
        value={draftSettings.ai.provider}
        onChange={(val) => {
          const provider = val as AIProviderId;
          const defaultModel = getDefaultModelForProvider(provider);
          updateDraft({ ai: { provider, model: defaultModel } });
          setApiKeyInput('');
          setTestStatus({ type: 'idle' });
        }}
      >
        <option value="gemini">Google Gemini AI</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic" disabled>
          Anthropic Claude (Coming Soon)
        </option>
        <option value="ollama" disabled>
          Ollama Local (Coming Soon)
        </option>
      </SelectSetting>

      <SelectSetting
        label="AI Model"
        description={`Select the ${
          draftSettings.ai.provider === 'openai' ? 'OpenAI' : 'Google Gemini'
        } model for generating commit messages.`}
        value={draftSettings.ai.model}
        onChange={(val) => updateDraft({ ai: { model: val } })}
      >
        {(draftSettings.ai.provider === 'openai'
          ? OPENAI_MODELS
          : GEMINI_MODELS
        ).map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} {m.isRecommended ? '(Recommended)' : ''}
          </option>
        ))}
      </SelectSetting>

      <div className="cd-settings-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 rounded-md px-2.5 py-3 sm:gap-8">
        <span className="max-w-[24rem] min-w-0">
          <span className="block text-[12.5px] font-medium text-[var(--text-primary)]">
            {draftSettings.ai.provider === 'openai'
              ? 'OpenAI API Key'
              : 'Gemini API Key'}
          </span>
          <span className="mt-0.5 block text-[11px] leading-4 text-[var(--text-muted)]">
            Stored securely using local operating system credential storage.
          </span>
        </span>

        <div className="flex shrink-0 items-center gap-2">
          <div className="relative flex items-center">
            <input
              type={showApiKey ? 'text' : 'password'}
              placeholder={
                draftSettings.ai.hasApiKey
                  ? '••••••••••••••••'
                  : draftSettings.ai.provider === 'openai'
                    ? 'sk-...'
                    : 'Enter Gemini API Key'
              }
              value={apiKeyInput}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              className="cd-input h-8.5 w-52 px-2.5 pr-8 font-mono text-[11px]"
            />
            <button
              type="button"
              className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              title={showApiKey ? 'Hide API key' : 'Show API key'}
              onClick={() => setShowApiKey((v) => !v)}
            >
              <Icon name={showApiKey ? 'eye-off' : 'eye'} size={14} />
            </button>
          </div>

          <button
            type="button"
            className="cd-button h-8.5 text-[11px] whitespace-nowrap"
            disabled={testStatus.type === 'testing'}
            onClick={handleTestConnection}
          >
            {testStatus.type === 'testing' ? (
              <>
                <span className="animate-spin">
                  <Icon name="refresh" size={13} />
                </span>
                Testing…
              </>
            ) : (
              <>
                <Icon name="sparkles" size={13} />
                Test Connection
              </>
            )}
          </button>
        </div>
      </div>

      {testStatus.message && (
        <div
          className={`mx-2.5 my-2 rounded-md p-2.5 text-[11px] ${
            testStatus.type === 'success'
              ? 'border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
              : 'border border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]'
          }`}
        >
          {testStatus.message}
        </div>
      )}
    </SettingsGroup>
  );
}
