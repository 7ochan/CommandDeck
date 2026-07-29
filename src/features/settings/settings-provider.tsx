'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_APP_SETTINGS_STATE,
  type AppSettings,
  type AppSettingsState,
  type AppSettingsStateUpdate,
  type AppSettingsUpdate,
} from '@/shared/types';

import { KeybindingsProvider } from '@/features/keybindings/keybindings-provider';
import { loadSettings, saveSettings } from './api';
import { SettingsDialog } from './components/settings-dialog';
import { applyAccentTheme } from '@/features/terminal/terminal-presentation';
import {
  mergeAppSettings,
  resolveApplicationTheme,
  type ResolvedTheme,
} from './settings-state';

type SettingsContextValue = {
  settings: AppSettings;
  state: AppSettingsState;
  resolvedTheme: ResolvedTheme;
  isLoading: boolean;
  persistenceError: string | null;
  updateSettings: (update: AppSettingsUpdate) => void;
  updateState: (update: AppSettingsStateUpdate) => void;
  openSettings: (
    section?:
      | 'general'
      | 'terminal'
      | 'appearance'
      | 'developerHub'
      | 'ai'
      | 'keybindings',
  ) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [state, setState] = useState<AppSettingsState>(
    DEFAULT_APP_SETTINGS_STATE,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogSection, setDialogSection] = useState<
    | 'general'
    | 'terminal'
    | 'appearance'
    | 'developerHub'
    | 'ai'
    | 'keybindings'
    | undefined
  >(undefined);
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    const controller = new AbortController();

    void loadSettings(controller.signal)
      .then((snapshot) => {
        setSettings(snapshot.settings);
        setState(snapshot.state);
        setPersistenceError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setPersistenceError(errorMessage(error, 'Unable to load Settings.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setSystemPrefersDark(mediaQuery.matches);
    updateSystemTheme();
    mediaQuery.addEventListener('change', updateSystemTheme);
    return () => mediaQuery.removeEventListener('change', updateSystemTheme);
  }, []);

  const resolvedTheme = resolveApplicationTheme(
    settings.appearance.theme,
    systemPrefersDark,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    applyAccentTheme(settings.terminal.dirColor);
  }, [resolvedTheme, settings.terminal.dirColor]);

  const queueSave = useCallback(
    (
      settingsUpdate: AppSettingsUpdate | undefined,
      stateUpdate: AppSettingsStateUpdate | undefined,
    ) => {
      setPersistenceError(null);
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() => saveSettings(settingsUpdate, stateUpdate))
        .then(() => undefined)
        .catch((error: unknown) => {
          setPersistenceError(errorMessage(error, 'Unable to save Settings.'));
        });
    },
    [],
  );

  const updateSettings = useCallback(
    (update: AppSettingsUpdate) => {
      setSettings((current) => mergeAppSettings(current, update));
      queueSave(update, undefined);
    },
    [queueSave],
  );

  const updateState = useCallback(
    (update: AppSettingsStateUpdate) => {
      setState((current) => ({ ...current, ...update }));
      queueSave(undefined, update);
    },
    [queueSave],
  );
  const openSettings = useCallback(
    (
      section?:
        | 'general'
        | 'terminal'
        | 'appearance'
        | 'developerHub'
        | 'ai'
        | 'keybindings',
    ) => {
      setDialogSection(section);
      setIsDialogOpen(true);
    },
    [],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      state,
      resolvedTheme,
      isLoading,
      persistenceError,
      updateSettings,
      updateState,
      openSettings,
    }),
    [
      isLoading,
      openSettings,
      persistenceError,
      resolvedTheme,
      settings,
      state,
      updateSettings,
      updateState,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      <KeybindingsProvider>
        {children}
        <SettingsDialog
          isOpen={isDialogOpen}
          settings={settings}
          isLoading={isLoading}
          persistenceError={persistenceError}
          initialSection={dialogSection}
          onSave={updateSettings}
          onClose={() => setIsDialogOpen(false)}
        />
      </KeybindingsProvider>
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error('useSettings must be used inside SettingsProvider.');
  }

  return context;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
