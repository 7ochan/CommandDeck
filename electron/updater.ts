import { app, dialog, shell, BrowserWindow } from 'electron';
import { UpdateService } from './update-service.js';

let updateServiceInstance: UpdateService | null = null;

export function initAutoUpdater(
  appUrl: string,
  getMainWindow: () => BrowserWindow | null,
): UpdateService {
  updateServiceInstance = new UpdateService({
    currentVersion: app.getVersion(),
    repoOwner: '7ochan',
    repoName: 'CommandDeck',
    fetchFn: globalThis.fetch,
    openExternal: (url: string) => shell.openExternal(url),
    showMessageBox: (options) => {
      const win = getMainWindow();
      return dialog.showMessageBox(
        win ?? (undefined as unknown as BrowserWindow),
        options,
      );
    },
    getSettings: async () => {
      try {
        const res = await fetch(`${appUrl}/api/settings`);
        if (res.ok) {
          const data = (await res.json()) as {
            settings?: { general?: { checkForUpdatesAutomatically?: boolean } };
          };
          return data.settings ?? {};
        }
      } catch {
        // Server not ready or network error
      }
      return {};
    },
  });
  return updateServiceInstance;
}

export async function checkForUpdates(manual = false): Promise<void> {
  if (updateServiceInstance) {
    await updateServiceInstance.checkForUpdates({ manual });
  }
}
