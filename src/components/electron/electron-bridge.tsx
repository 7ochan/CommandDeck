'use client';

/**
 * ElectronBridge — wires native application menu actions into the React app.
 *
 * This component subscribes to IPC events published by the Electron main
 * process (via the preload's `window.commandDeckDesktop` API) and maps them
 * to existing React actions:
 *
 * - `commanddeck:open-settings`  → opens the Settings dialog
 * - `commanddeck:new-workspace`  → (future) triggers workspace creation
 *
 * It renders nothing. It exists only to register/unregister event handlers
 * as part of the React lifecycle.
 *
 * When running in a browser (npm run dev) `window.commandDeckDesktop` is
 * undefined and this component is a no-op.
 */

import { useEffect } from 'react';

import { useKeybindings } from '@/features/keybindings/keybindings-provider';

export function ElectronBridge() {
  const { executeAction } = useKeybindings();

  useEffect(() => {
    const api = window.commandDeckDesktop;
    if (!api) return;

    // Subscribe to IPC events triggered by the native application menu
    const unsubscribeSettings = api.onOpenSettings(() => {
      executeAction('app.openSettings');
    });

    const unsubscribeNewWorkspace = api.onNewWorkspace?.(() => {
      executeAction('workspace.new');
    });

    return () => {
      unsubscribeSettings();
      unsubscribeNewWorkspace?.();
    };
  }, [executeAction]);

  // Renders nothing — this is a side-effect-only component
  return null;
}
