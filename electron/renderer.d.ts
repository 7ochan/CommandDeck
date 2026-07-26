/**
 * Ambient type declarations for the Electron renderer context.
 *
 * When running inside Electron, `window.commandDeckDesktop` is injected by
 * the preload script via contextBridge. These declarations give the renderer
 * TypeScript type safety for that API without importing anything from Electron
 * (which is unavailable in the sandboxed renderer).
 *
 * When running in a browser (npm run dev), `window.commandDeckDesktop` is
 * undefined and the app falls back to its default web behaviour.
 */

export {};

declare global {
  interface Window {
    commandDeckDesktop?: CommandDeckDesktopAPI;
  }

  interface CommandDeckDesktopAPI {
    // ── Identity ──────────────────────────────────────────────────────────
    readonly isDesktop: true;
    readonly electronVersion: string;
    readonly platform: NodeJS.Platform;

    // ── Native actions (Renderer → Main) ──────────────────────────────────
    openWorkspaceFolder(): Promise<void>;
    revealAppData(): Promise<void>;
    revealDatabase(): Promise<void>;
    revealLogs(): Promise<void>;

    // ── Event subscriptions (Main → Renderer) ─────────────────────────────
    /**
     * Subscribe to the "open settings" event from the native menu.
     * @returns Unsubscribe function — call it in a cleanup effect.
     */
    onOpenSettings(callback: () => void): () => void;

    /**
     * Subscribe to the "new workspace" event from the native menu.
     * @returns Unsubscribe function — call it in a cleanup effect.
     */
    onNewWorkspace(callback: () => void): () => void;
  }
}
