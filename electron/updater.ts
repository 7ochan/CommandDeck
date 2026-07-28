/**
 * Auto-updater implementation for CommandDeck using electron-updater.
 *
 * Workflow:
 * - Startup Check: Background check on app launch after main window is ready.
 * - No Update: Silent, no dialogs or notifications.
 * - Update Available: Native dialog with current version, new version, release notes.
 * - Download: Downloaded in background, displays progress on taskbar/dock icon.
 * - Ready to Install: Native dialog asking user to Restart & Install or Later.
 * - Error Handling: Failures logged gracefully without blocking application launch.
 */

import { app, dialog, BrowserWindow } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';

let isDownloading = false;
let isDownloaded = false;
let downloadedInfo: UpdateInfo | null = null;
let isManualCheck = false;

let stopServerFn: (() => void) | null = null;
let getMainWindowFn: () => BrowserWindow | null = () =>
  BrowserWindow.getFocusedWindow();

/**
 * Initializes autoUpdater event listeners and callbacks.
 */
export function initAutoUpdater(
  onStopServer: () => void,
  getMainWindow: () => BrowserWindow | null,
): void {
  stopServerFn = onStopServer;
  getMainWindowFn = getMainWindow;

  // Never download or install automatically without user consent
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  // Logger
  autoUpdater.logger = {
    info(msg?: unknown) {
      console.log('[AutoUpdate]', msg);
    },
    warn(msg?: unknown) {
      console.warn('[AutoUpdate]', msg);
    },
    error(msg?: unknown) {
      console.error('[AutoUpdate]', msg);
    },
  };

  // Event: Update available
  autoUpdater.on('update-available', async (info: UpdateInfo) => {
    console.log(`[AutoUpdate] Update available: v${info.version}`);
    const currentVersion = app.getVersion();
    const newVersion = info.version;

    let releaseNotesText = '';
    if (info.releaseNotes) {
      if (typeof info.releaseNotes === 'string') {
        releaseNotesText = info.releaseNotes;
      } else if (Array.isArray(info.releaseNotes)) {
        releaseNotesText = info.releaseNotes
          .map((n) => (typeof n === 'string' ? n : n.note))
          .filter(Boolean)
          .join('\n');
      }
    }

    let detail = `Current version: v${currentVersion}\nNew version: v${newVersion}`;
    if (releaseNotesText.trim()) {
      const cleanNotes = releaseNotesText.replace(/<[^>]*>/g, '').trim();
      if (cleanNotes) {
        detail += `\n\nRelease Notes:\n${cleanNotes}`;
      }
    }

    const win = getMainWindowFn();
    const { response } = await dialog.showMessageBox(
      win ?? (undefined as unknown as BrowserWindow),
      {
        type: 'info',
        title: 'Update Available',
        message: `A new version of CommandDeck is available (v${newVersion}).`,
        detail,
        buttons: ['Download Update', 'Later'],
        defaultId: 0,
        cancelId: 1,
      },
    );

    if (response === 0) {
      isDownloading = true;
      console.log('[AutoUpdate] User started update download.');
      try {
        await autoUpdater.downloadUpdate();
      } catch (err) {
        console.error('[AutoUpdate] Download error:', err);
        isDownloading = false;
        const currentWin = getMainWindowFn();
        if (currentWin && !currentWin.isDestroyed()) {
          currentWin.setProgressBar(-1);
        }
      }
    }
  });

  // Event: Update not available
  autoUpdater.on('update-not-available', async () => {
    console.log('[AutoUpdate] No update available.');
    if (isManualCheck) {
      const win = getMainWindowFn();
      await dialog.showMessageBox(
        win ?? (undefined as unknown as BrowserWindow),
        {
          type: 'info',
          title: 'CommandDeck is Up to Date',
          message: 'No update available.',
          detail: `You are running the latest version of CommandDeck (v${app.getVersion()}).`,
          buttons: ['OK'],
        },
      );
    }
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`[AutoUpdate] Progress: ${Math.floor(progressObj.percent)}%`);
    const win = getMainWindowFn();
    if (win && !win.isDestroyed()) {
      win.setProgressBar(Math.min(1, Math.max(0, progressObj.percent / 100)));
    }
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', async (info: UpdateInfo) => {
    console.log(`[AutoUpdate] Update downloaded: v${info.version}`);
    isDownloading = false;
    isDownloaded = true;
    downloadedInfo = info;

    const win = getMainWindowFn();
    if (win && !win.isDestroyed()) {
      win.setProgressBar(-1);
    }

    const { response } = await dialog.showMessageBox(
      win ?? (undefined as unknown as BrowserWindow),
      {
        type: 'info',
        title: 'Update Ready to Install',
        message: 'A new version of CommandDeck has been downloaded.',
        detail: `Version ${info.version} is ready to be installed. Would you like to restart CommandDeck to apply the update?`,
        buttons: ['Restart & Install', 'Later'],
        defaultId: 0,
        cancelId: 1,
      },
    );

    if (response === 0) {
      console.log('[AutoUpdate] User consented to restart and install.');
      if (stopServerFn) stopServerFn();
      autoUpdater.quitAndInstall(false, true);
    }
  });

  // Event: Error
  autoUpdater.on('error', async (err: Error) => {
    console.error('[AutoUpdate] Error:', err);
    isDownloading = false;
    const win = getMainWindowFn();
    if (win && !win.isDestroyed()) {
      win.setProgressBar(-1);
    }

    if (isManualCheck) {
      await dialog.showMessageBox(
        win ?? (undefined as unknown as BrowserWindow),
        {
          type: 'error',
          title: 'Update Check Failed',
          message: 'Unable to check for updates.',
          detail:
            err?.message ||
            'Please check your internet connection and try again.',
          buttons: ['OK'],
        },
      );
    }
  });
}

/**
 * Checks for updates.
 * @param manual Set to true if manually invoked by the user
 */
export async function checkForUpdates(manual = false): Promise<void> {
  const win = getMainWindowFn();

  if (isDownloaded && downloadedInfo) {
    if (manual) {
      const { response } = await dialog.showMessageBox(
        win ?? (undefined as unknown as BrowserWindow),
        {
          type: 'info',
          title: 'Update Ready to Install',
          message: 'A new version of CommandDeck has been downloaded.',
          detail: `Version ${downloadedInfo.version} is ready to be installed. Restart CommandDeck to apply the update.`,
          buttons: ['Restart & Install', 'Later'],
          defaultId: 0,
          cancelId: 1,
        },
      );

      if (response === 0) {
        if (stopServerFn) stopServerFn();
        autoUpdater.quitAndInstall(false, true);
      }
    }
    return;
  }

  if (isDownloading) {
    if (manual && win) {
      await dialog.showMessageBox(win, {
        type: 'info',
        title: 'Update in Progress',
        message: 'CommandDeck is currently downloading an update.',
        detail:
          'The update will be ready to install once the download completes.',
        buttons: ['OK'],
      });
    }
    return;
  }

  if (!app.isPackaged) {
    console.log('[AutoUpdate] Unpackaged/dev mode — skipping update check.');
    if (manual && win) {
      await dialog.showMessageBox(win, {
        type: 'info',
        title: 'Check for Updates',
        message: 'Automatic updates are disabled in development mode.',
        detail: `Current version: v${app.getVersion()}`,
        buttons: ['OK'],
      });
    }
    return;
  }

  isManualCheck = manual;

  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    console.error('[AutoUpdate] Exception during checkForUpdates:', err);
    if (manual && win) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: 'Update Check Failed',
        message: 'Unable to check for updates.',
        detail: err instanceof Error ? err.message : String(err),
        buttons: ['OK'],
      });
    }
  }
}
