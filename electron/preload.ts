/**
 * Electron preload script for CommandDeck.
 *
 * Runs in a sandboxed context with contextIsolation enabled.
 * nodeIntegration is disabled in the renderer.
 *
 * Exposes a narrow, typed API surface to the renderer via contextBridge.
 * All IPC goes through this file — the renderer never touches ipcRenderer
 * directly.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');

// ─── IPC channel names (must match main.ts) ───────────────────────────────────

const IPC = {
  OPEN_SETTINGS: 'commanddeck:open-settings',
  NEW_WORKSPACE: 'commanddeck:new-workspace',
  OPEN_WORKSPACE_FOLDER: 'commanddeck:open-workspace-folder',
  REVEAL_APP_DATA: 'commanddeck:reveal-app-data',
  REVEAL_DATABASE: 'commanddeck:reveal-database',
  REVEAL_LOGS: 'commanddeck:reveal-logs',
  CHECK_FOR_UPDATES: 'commanddeck:check-for-updates',
} as const;

type IpcChannel = (typeof IPC)[keyof typeof IPC];

// ─── API exposed to the renderer ──────────────────────────────────────────────

contextBridge.exposeInMainWorld('commandDeckDesktop', {
  // ── Identity ────────────────────────────────────────────────────────────
  /** True when the app is running inside Electron. */
  isDesktop: true as const,
  /** The Electron version string. */
  electronVersion: process.versions.electron,
  /** The operating system platform identifier. */
  platform: process.platform,

  // ── Native actions (Renderer → Main) ────────────────────────────────────
  /** Opens a native folder picker for selecting a workspace directory. */
  openWorkspaceFolder: (): Promise<void> =>
    ipcRenderer.invoke(IPC.OPEN_WORKSPACE_FOLDER),

  /** Reveals the application data directory in Finder / Explorer. */
  revealAppData: (): Promise<void> => ipcRenderer.invoke(IPC.REVEAL_APP_DATA),

  /** Reveals the database file in Finder / Explorer. */
  revealDatabase: (): Promise<void> => ipcRenderer.invoke(IPC.REVEAL_DATABASE),

  /** Reveals the application logs folder in Finder / Explorer. */
  revealLogs: (): Promise<void> => ipcRenderer.invoke(IPC.REVEAL_LOGS),

  /** Checks GitHub Releases for application updates. */
  checkForUpdates: (): Promise<void> =>
    ipcRenderer.invoke(IPC.CHECK_FOR_UPDATES),

  // ── Event subscriptions (Main → Renderer) ────────────────────────────────
  /**
   * Registers a callback to be invoked when the main process requests that
   * the Settings dialog be opened (e.g. via the application menu or Cmd+,).
   * Returns an unsubscribe function.
   */
  onOpenSettings: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.OPEN_SETTINGS, handler);
    return () => ipcRenderer.off(IPC.OPEN_SETTINGS, handler);
  },

  /**
   * Registers a callback to be invoked when the main process requests that
   * a new workspace be created (e.g. via File → New Workspace).
   * Returns an unsubscribe function.
   */
  onNewWorkspace: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.NEW_WORKSPACE, handler);
    return () => ipcRenderer.off(IPC.NEW_WORKSPACE, handler);
  },
});

// ─── TypeScript ambient declaration (for renderer type safety) ────────────────
// This block is not evaluated at runtime — it only provides types.
// The actual type definition lives in electron/renderer.d.ts.

// Validate at compile time that all IPC channels are strings
const _ipcChannelCheck: IpcChannel = IPC.OPEN_SETTINGS;
void _ipcChannelCheck;
