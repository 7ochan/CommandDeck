/**
 * Electron preload script for CommandDeck.
 *
 * Runs in a sandboxed context with contextIsolation enabled.
 * nodeIntegration is disabled in the renderer.
 *
 * This script is intentionally minimal for Phase 1 — Electron is used only
 * as a host for the existing web application. No native IPC bridges are
 * needed yet. Future native desktop feature integrations (file dialogs,
 * system notifications, etc.) would be wired through this file.
 */

import { contextBridge } from 'electron';

// Expose a minimal, safe API surface to the renderer.
// For Phase 1, we only expose a version identifier so the app can
// optionally detect it is running inside Electron.
contextBridge.exposeInMainWorld('commandDeckDesktop', {
  /** Returns true when the app is running inside Electron. */
  isDesktop: true,
  /** The Electron version string. */
  electronVersion: process.versions.electron,
  /** The app version from package.json (set by Electron at runtime). */
  platform: process.platform,
} as const);
