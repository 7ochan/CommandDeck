'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import type {
  AppSettings,
  AppSettingsUpdate,
  ApplicationTheme,
  TerminalCursorStyle,
} from '@/shared/types';

const SECTIONS = [
  { id: 'general', label: 'General', icon: 'workspace' },
  { id: 'terminal', label: 'Terminal', icon: 'terminal' },
  { id: 'appearance', label: 'Appearance', icon: 'appearance' },
  { id: 'developerHub', label: 'Developer Hub', icon: 'deck' },
] as const satisfies ReadonlyArray<{
  id: keyof AppSettings;
  label: string;
  icon: IconName;
}>;

type SettingsSection = (typeof SECTIONS)[number]['id'];

type SettingsDialogProps = {
  isOpen: boolean;
  settings: AppSettings;
  isLoading: boolean;
  persistenceError: string | null;
  onUpdate: (update: AppSettingsUpdate) => void;
  onClose: () => void;
};

export function SettingsDialog({
  isOpen,
  settings,
  isLoading,
  persistenceError,
  onUpdate,
  onClose,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [activeSection, setActiveSection] =
    useState<SettingsSection>('general');

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="cd-dialog w-[min(48rem,calc(100vw-1.5rem))] p-0"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={() => {
        if (isOpen) onClose();
      }}
    >
      <div className="flex min-h-[31rem] flex-col sm:flex-row">
        <aside className="shrink-0 border-b border-[var(--border-soft)] bg-[var(--canvas-raised)] p-3 sm:w-48 sm:border-r sm:border-b-0">
          <div className="flex items-center justify-between gap-3 px-1 py-1 sm:block">
            <div>
              <span className="cd-eyebrow">CommandDeck</span>
              <h2
                id={titleId}
                className="mt-1 text-[15px] font-semibold text-[var(--text-primary)]"
              >
                Settings
              </h2>
            </div>
            <button
              type="button"
              className="cd-icon-button sm:hidden"
              aria-label="Close Settings"
              onClick={onClose}
            >
              <Icon name="x" size={15} />
            </button>
          </div>

          <nav
            className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-1"
            aria-label="Settings sections"
          >
            {SECTIONS.map((section) => {
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-9 items-center gap-2 rounded-lg border px-2.5 text-left text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'cd-segment-active'
                      : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]'
                  }`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <Icon name={section.icon} size={14} />
                  <span className="truncate">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="hidden h-14 shrink-0 items-center justify-between border-b border-[var(--border-soft)] px-5 sm:flex">
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                {SECTIONS.find(({ id }) => id === activeSection)?.label}
              </h3>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                Changes apply automatically
              </p>
            </div>
            <button
              type="button"
              className="cd-icon-button"
              aria-label="Close Settings"
              onClick={onClose}
            >
              <Icon name="x" size={15} />
            </button>
          </header>

          <div className="cd-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <fieldset
              disabled={isLoading}
              className="m-0 min-w-0 border-0 p-0 disabled:opacity-60"
            >
              {activeSection === 'general' && (
                <SettingsGroup
                  title="Workspace behavior"
                  description="Control how CommandDeck restores and protects your working context."
                >
                  <ToggleSetting
                    label="Restore previous workspace on startup"
                    description="Open the workspace that was active when CommandDeck last closed."
                    checked={settings.general.restorePreviousWorkspace}
                    onChange={(restorePreviousWorkspace) =>
                      onUpdate({ general: { restorePreviousWorkspace } })
                    }
                  />
                  <ToggleSetting
                    label="Confirm before deleting workspace"
                    description="Ask before permanently removing its History and Deck items."
                    checked={settings.general.confirmBeforeDeletingWorkspace}
                    onChange={(confirmBeforeDeletingWorkspace) =>
                      onUpdate({ general: { confirmBeforeDeletingWorkspace } })
                    }
                  />
                  <ToggleSetting
                    label="Auto-focus terminal after switching"
                    description="Move keyboard focus to the terminal when changing workspaces."
                    checked={settings.general.autoFocusTerminalAfterSwitching}
                    onChange={(autoFocusTerminalAfterSwitching) =>
                      onUpdate({ general: { autoFocusTerminalAfterSwitching } })
                    }
                  />
                </SettingsGroup>
              )}

              {activeSection === 'terminal' && (
                <SettingsGroup
                  title="Terminal presentation"
                  description="These options update every open terminal immediately."
                >
                  <SelectSetting
                    label="Font size"
                    description="Terminal text size in pixels."
                    value={String(settings.terminal.fontSize)}
                    onChange={(value) =>
                      onUpdate({ terminal: { fontSize: Number(value) } })
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
                    value={settings.terminal.cursorStyle}
                    onChange={(cursorStyle) =>
                      onUpdate({
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
                    checked={settings.terminal.cursorBlink}
                    onChange={(cursorBlink) =>
                      onUpdate({ terminal: { cursorBlink } })
                    }
                  />
                  <SelectSetting
                    label="Scrollback size"
                    description="Maximum lines retained in each terminal buffer."
                    value={String(settings.terminal.scrollbackSize)}
                    onChange={(value) =>
                      onUpdate({ terminal: { scrollbackSize: Number(value) } })
                    }
                  >
                    {[1_000, 2_500, 5_000, 10_000, 20_000, 50_000, 100_000].map(
                      (size) => (
                        <option key={size} value={size}>
                          {size.toLocaleString()} lines
                        </option>
                      ),
                    )}
                  </SelectSetting>
                </SettingsGroup>
              )}

              {activeSection === 'appearance' && (
                <SettingsGroup
                  title="Interface theme"
                  description="System follows your operating system appearance automatically."
                >
                  <div className="grid grid-cols-3 gap-2 p-3">
                    {(['dark', 'light', 'system'] as const).map((theme) => (
                      <ThemeOption
                        key={theme}
                        theme={theme}
                        selected={settings.appearance.theme === theme}
                        onSelect={() => onUpdate({ appearance: { theme } })}
                      />
                    ))}
                  </div>
                </SettingsGroup>
              )}

              {activeSection === 'developerHub' && (
                <SettingsGroup
                  title="Developer Hub"
                  description="Keep the side panel predictable between working sessions."
                >
                  <ToggleSetting
                    label="Remember last selected tab"
                    description="Restore Deck or History the next time CommandDeck opens."
                    checked={settings.developerHub.rememberLastSelectedTab}
                    onChange={(rememberLastSelectedTab) =>
                      onUpdate({ developerHub: { rememberLastSelectedTab } })
                    }
                  />
                </SettingsGroup>
              )}
            </fieldset>
          </div>

          <footer className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-t border-[var(--border-soft)] px-5 py-2.5">
            <p
              className={`text-[10px] ${persistenceError ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}
              role={persistenceError ? 'alert' : 'status'}
            >
              {persistenceError ??
                (isLoading ? 'Loading saved settings…' : 'Saved automatically')}
            </p>
            <button type="button" className="cd-button" onClick={onClose}>
              Done
            </button>
          </footer>
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
    <section>
      <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">
        {title}
      </h4>
      <p className="mt-1 text-[11px] leading-4.5 text-[var(--text-muted)]">
        {description}
      </p>
      <div className="mt-4 divide-y divide-[var(--border-soft)] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--canvas-raised)]">
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
    <label className="flex cursor-pointer items-center gap-4 p-3.5 hover:bg-[var(--surface-1)]">
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-[var(--text-primary)]">
          {label}
        </span>
        <span className="mt-1 block text-[10px] leading-4 text-[var(--text-muted)]">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="relative h-5 w-9 shrink-0 rounded-full border border-[var(--border-strong)] bg-[var(--surface-3)] shadow-[var(--shadow-pressed)] transition-colors peer-checked:border-[var(--accent-border)] peer-checked:bg-[var(--accent-soft)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)] after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:rounded-full after:bg-[var(--text-muted)] after:shadow-sm after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-[var(--accent)]" />
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
    <label className="flex items-center gap-4 p-3.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-[var(--text-primary)]">
          {label}
        </span>
        <span className="mt-1 block text-[10px] leading-4 text-[var(--text-muted)]">
          {description}
        </span>
      </span>
      <select
        value={value}
        className="cd-input h-9 w-36 shrink-0 px-2.5 text-[11px]"
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
      className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-[10px] border text-[11px] font-medium transition-[border-color,background-color,box-shadow] ${
        selected
          ? 'cd-segment-active border-[var(--accent-border)]'
          : 'border-[var(--border-soft)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
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
