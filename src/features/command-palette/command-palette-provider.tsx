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

import { useKeybindings } from '@/features/keybindings/keybindings-provider';
import { CommandPalette } from './components/command-palette';
import type {
  CommandPaletteAction,
  RegisteredCommandPaletteAction,
} from './types';

type RegisterActions = (
  sourceId: string,
  actions: readonly CommandPaletteAction[],
) => () => void;

const CommandPaletteRegistrationContext = createContext<RegisterActions | null>(
  null,
);
const CommandPaletteOpenContext = createContext<(() => void) | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const { setActionHandler } = useKeybindings();
  const registryRef = useRef(
    new Map<
      string,
      {
        token: symbol;
        actions: RegisteredCommandPaletteAction[];
      }
    >(),
  );
  const nextOrderRef = useRef(0);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [actions, setActions] = useState<RegisteredCommandPaletteAction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);

  const publishRegistry = useCallback(() => {
    setActions(
      [...registryRef.current.values()].flatMap(
        (registration) => registration.actions,
      ),
    );
  }, []);

  const registerActions = useCallback<RegisterActions>(
    (sourceId, sourceActions) => {
      const token = Symbol(sourceId);
      const registeredActions = sourceActions.map((action) => ({
        ...action,
        registryId: `${sourceId}:${action.id}`,
        order: nextOrderRef.current++,
      }));
      registryRef.current.set(sourceId, { token, actions: registeredActions });
      publishRegistry();

      return () => {
        if (registryRef.current.get(sourceId)?.token === token) {
          registryRef.current.delete(sourceId);
          publishRegistry();
        }
      };
    },
    [publishRegistry],
  );

  const openPalette = useCallback(() => {
    if (!isOpen && document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement;
    }

    setIsOpen(true);
    setFocusRequest((current) => current + 1);
  }, [isOpen]);

  const closePalette = useCallback(() => {
    setIsOpen(false);
    const previousFocus = previousFocusRef.current;

    requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      const paletteStillOwnsFocus =
        activeElement instanceof Element &&
        activeElement.closest('[data-command-palette="true"]') !== null;

      if (
        previousFocus?.isConnected &&
        (!activeElement ||
          activeElement === document.body ||
          paletteStillOwnsFocus)
      ) {
        previousFocus.focus({ preventScroll: true });
      }
    });
  }, []);

  useEffect(() => {
    return setActionHandler('app.openCommandPalette', openPalette);
  }, [openPalette, setActionHandler]);

  const registrationValue = useMemo(() => registerActions, [registerActions]);
  const openValue = useMemo(() => openPalette, [openPalette]);

  return (
    <CommandPaletteRegistrationContext.Provider value={registrationValue}>
      <CommandPaletteOpenContext.Provider value={openValue}>
        {children}
        <CommandPalette
          actions={actions}
          isOpen={isOpen}
          focusRequest={focusRequest}
          onRequestClose={closePalette}
        />
      </CommandPaletteOpenContext.Provider>
    </CommandPaletteRegistrationContext.Provider>
  );
}

export function useCommandPalette(): { openPalette: () => void } {
  const openPalette = useContext(CommandPaletteOpenContext);

  if (!openPalette) {
    throw new Error('useCommandPalette must be used inside its provider.');
  }

  return { openPalette };
}

export function useRegisterCommandPaletteActions(
  sourceId: string,
  actions: readonly CommandPaletteAction[],
): void {
  const registerActions = useContext(CommandPaletteRegistrationContext);

  if (!registerActions) {
    throw new Error(
      'useRegisterCommandPaletteActions must be used inside its provider.',
    );
  }

  useEffect(
    () => registerActions(sourceId, actions),
    [actions, registerActions, sourceId],
  );
}
