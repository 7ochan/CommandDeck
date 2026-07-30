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

import { useSettings } from '@/features/settings/settings-provider';
import {
  DEFAULT_ACTIONS,
  formatShortcutDisplay,
  isMacPlatform,
  matchesShortcut,
  normalizeShortcutString,
} from './registry.ts';
import type {
  ActionDefinition,
  KeybindingMap,
  RegisteredAction,
  ShortcutConflict,
} from './types.ts';

type KeybindingsContextType = {
  actions: RegisteredAction[];
  keybindings: KeybindingMap;
  registerAction: (
    action: ActionDefinition,
    handler?: () => void,
  ) => () => void;
  setActionHandler: (actionId: string, handler: () => void) => () => void;
  executeAction: (actionId: string) => boolean;
  updateShortcut: (
    actionId: string,
    newShortcut: string,
    replaceConflict?: boolean,
  ) => { success: boolean; conflict?: ShortcutConflict };
  resetShortcut: (actionId: string) => void;
  resetAllShortcuts: () => void;
  formatShortcut: (shortcut: string) => string;
  recordingActionId: string | null;
  startRecording: (actionId: string) => void;
  stopRecording: () => void;
  recordedShortcut: string | null;
  conflictState: ShortcutConflict | null;
  clearConflictState: () => void;
  isMac: boolean;
};

const KeybindingsContext = createContext<KeybindingsContextType | null>(null);

export function KeybindingsProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const keybindings = useMemo(
    () => settings.keybindings ?? {},
    [settings.keybindings],
  );

  const [customActions, setCustomActions] = useState<
    Map<string, ActionDefinition>
  >(new Map());
  const handlersRef = useRef<Map<string, () => void>>(new Map());
  const [recordingActionId, setRecordingActionId] = useState<string | null>(
    null,
  );
  const [recordedShortcut, setRecordedShortcut] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<ShortcutConflict | null>(
    null,
  );

  const [isMac] = useState(() => isMacPlatform());

  // Compute full list of registered actions
  const actions = useMemo<RegisteredAction[]>(() => {
    const actionMap = new Map<string, ActionDefinition>();
    for (const action of DEFAULT_ACTIONS) {
      actionMap.set(action.id, action);
    }
    for (const [id, action] of customActions.entries()) {
      actionMap.set(id, action);
    }

    return Array.from(actionMap.values()).map((action) => {
      const custom = keybindings[action.id];
      const currentShortcut =
        custom !== undefined ? custom : action.defaultShortcut;
      const isCustomized =
        custom !== undefined &&
        normalizeShortcutString(custom) !==
          normalizeShortcutString(action.defaultShortcut);

      return {
        ...action,
        currentShortcut,
        isCustomized,
      };
    });
  }, [customActions, keybindings]);

  const registerAction = useCallback(
    (action: ActionDefinition, handler?: () => void) => {
      setCustomActions((prev) => {
        const next = new Map(prev);
        next.set(action.id, action);
        return next;
      });

      if (handler) {
        handlersRef.current.set(action.id, handler);
      }

      return () => {
        setCustomActions((prev) => {
          const next = new Map(prev);
          next.delete(action.id);
          return next;
        });
        if (handler) {
          handlersRef.current.delete(action.id);
        }
      };
    },
    [],
  );

  const setActionHandler = useCallback(
    (actionId: string, handler: () => void) => {
      handlersRef.current.set(actionId, handler);
      return () => {
        if (handlersRef.current.get(actionId) === handler) {
          handlersRef.current.delete(actionId);
        }
      };
    },
    [],
  );

  const executeAction = useCallback((actionId: string): boolean => {
    const handler = handlersRef.current.get(actionId);
    if (handler) {
      handler();
      return true;
    }
    return false;
  }, []);

  const updateShortcut = useCallback(
    (
      actionId: string,
      newShortcutInput: string,
      replaceConflict = false,
    ): { success: boolean; conflict?: ShortcutConflict } => {
      const newShortcut = normalizeShortcutString(newShortcutInput);
      const targetAction = actions.find((a) => a.id === actionId);

      if (!targetAction) {
        return { success: false };
      }

      // Check conflict
      const conflictingAction = actions.find(
        (a) =>
          a.id !== actionId &&
          a.currentShortcut &&
          normalizeShortcutString(a.currentShortcut) === newShortcut,
      );

      if (conflictingAction && !replaceConflict) {
        const conflict: ShortcutConflict = {
          conflictingActionId: conflictingAction.id,
          conflictingActionName: conflictingAction.displayName,
          shortcut: newShortcut,
          pendingActionId: actionId,
          pendingShortcut: newShortcut,
        };
        setConflictState(conflict);
        return { success: false, conflict };
      }

      const nextKeybindings = { ...keybindings };

      if (conflictingAction && replaceConflict) {
        // Unbind shortcut from conflicting action
        nextKeybindings[conflictingAction.id] = '';
      }

      nextKeybindings[actionId] = newShortcut;
      updateSettings({ keybindings: nextKeybindings });
      setConflictState(null);
      return { success: true };
    },
    [actions, keybindings, updateSettings],
  );

  const resetShortcut = useCallback(
    (actionId: string) => {
      const nextKeybindings = { ...keybindings };
      delete nextKeybindings[actionId];
      updateSettings({ keybindings: nextKeybindings });
    },
    [keybindings, updateSettings],
  );

  const resetAllShortcuts = useCallback(() => {
    updateSettings({ keybindings: {} });
    setConflictState(null);
  }, [updateSettings]);

  const formatShortcut = useCallback(
    (shortcut: string) => formatShortcutDisplay(shortcut, isMac),
    [isMac],
  );

  const startRecording = useCallback((actionId: string) => {
    setRecordingActionId(actionId);
    setRecordedShortcut(null);
    setConflictState(null);
  }, []);

  const stopRecording = useCallback(() => {
    setRecordingActionId(null);
    setRecordedShortcut(null);
  }, []);

  const clearConflictState = useCallback(() => {
    setConflictState(null);
  }, []);

  // Shortcut Engine: global keydown listener
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      // 1. Ignore if recording mode is active
      if (recordingActionId !== null) {
        return;
      }

      // 2. Ignore repeated keydown events
      if (event.repeat) {
        return;
      }

      // Check active element context
      const target = event.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('.xterm') !== null ||
          target.closest('[contenteditable="true"]') !== null);

      // Find matching action
      for (const action of actions) {
        if (!action.currentShortcut) continue;

        if (matchesShortcut(event, action.currentShortcut, isMac)) {
          const hasModifier = event.metaKey || event.ctrlKey || event.altKey;

          // If focused inside an input/terminal:
          // Ignore shortcuts without modifiers unless explicitly allowed in inputs/terminal
          if (
            isInput &&
            !hasModifier &&
            !action.allowInInputs &&
            !action.allowInTerminal
          ) {
            continue;
          }

          const handler = handlersRef.current.get(action.id);
          if (handler) {
            event.preventDefault();
            event.stopPropagation();
            handler();
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [actions, isMac, recordingActionId]);

  const value = useMemo<KeybindingsContextType>(
    () => ({
      actions,
      keybindings,
      registerAction,
      setActionHandler,
      executeAction,
      updateShortcut,
      resetShortcut,
      resetAllShortcuts,
      formatShortcut,
      recordingActionId,
      startRecording,
      stopRecording,
      recordedShortcut,
      conflictState,
      clearConflictState,
      isMac,
    }),
    [
      actions,
      clearConflictState,
      conflictState,
      executeAction,
      formatShortcut,
      isMac,
      keybindings,
      recordedShortcut,
      recordingActionId,
      registerAction,
      resetAllShortcuts,
      resetShortcut,
      setActionHandler,
      startRecording,
      stopRecording,
      updateShortcut,
    ],
  );

  return (
    <KeybindingsContext.Provider value={value}>
      {children}
    </KeybindingsContext.Provider>
  );
}

export function useKeybindings(): KeybindingsContextType {
  const context = useContext(KeybindingsContext);
  if (!context) {
    throw new Error('useKeybindings must be used inside a KeybindingsProvider');
  }
  return context;
}
