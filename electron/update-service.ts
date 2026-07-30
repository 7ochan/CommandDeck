import type { MessageBoxOptions, MessageBoxReturnValue } from 'electron';

export interface GitHubRelease {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  name?: string;
  body?: string;
}

export interface UpdateServiceDependencies {
  currentVersion?: string;
  repoOwner?: string;
  repoName?: string;
  fetchFn?: typeof fetch;
  openExternal?: (url: string) => Promise<void>;
  showMessageBox?: (
    options: MessageBoxOptions,
  ) => Promise<MessageBoxReturnValue>;
  getSettings?: () =>
    | Promise<{ general?: { checkForUpdatesAutomatically?: boolean } }>
    | { general?: { checkForUpdatesAutomatically?: boolean } };
  icon?: MessageBoxOptions['icon'];
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

export interface CheckForUpdatesOptions {
  manual?: boolean;
}

/**
 * Pure semver comparator.
 * Returns true if latestTag > currentVer according to semantic versioning rules.
 */
export function isNewerVersion(latestTag: string, currentVer: string): boolean {
  const cleanLatest = latestTag.replace(/^v/i, '').trim();
  const cleanCurrent = currentVer.replace(/^v/i, '').trim();

  const [latestCore] = cleanLatest.split('-');
  const [currentCore] = cleanCurrent.split('-');

  const latestParts = latestCore.split('.').map((p) => parseInt(p, 10) || 0);
  const currentParts = currentCore.split('.').map((p) => parseInt(p, 10) || 0);

  const length = Math.max(latestParts.length, currentParts.length);
  for (let i = 0; i < length; i++) {
    const l = latestParts[i] ?? 0;
    const c = currentParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }

  return false;
}

export class UpdateService {
  private readonly currentVersion: string;
  private readonly repoOwner: string;
  private readonly repoName: string;
  private readonly fetchFn: typeof fetch;
  private readonly openExternal?: (url: string) => Promise<void>;
  private readonly showMessageBox?: (
    options: MessageBoxOptions,
  ) => Promise<MessageBoxReturnValue>;
  private readonly getSettings?: () =>
    | Promise<{ general?: { checkForUpdatesAutomatically?: boolean } }>
    | { general?: { checkForUpdatesAutomatically?: boolean } };
  private readonly icon?: MessageBoxOptions['icon'];
  private readonly logger: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };

  private hasCheckedThisLaunch = false;

  constructor(deps: UpdateServiceDependencies = {}) {
    this.currentVersion = deps.currentVersion ?? '0.0.0';
    this.repoOwner = deps.repoOwner ?? '7ochan';
    this.repoName = deps.repoName ?? 'CommandDeck';
    this.fetchFn = deps.fetchFn ?? globalThis.fetch;
    this.openExternal = deps.openExternal;
    this.showMessageBox = deps.showMessageBox;
    this.getSettings = deps.getSettings;
    this.icon = deps.icon;
    this.logger = deps.logger ?? console;
  }

  /** Reset launch check guard (primarily for unit testing) */
  public resetLaunchGuard(): void {
    this.hasCheckedThisLaunch = false;
  }

  public async checkForUpdates(
    options: CheckForUpdatesOptions = {},
  ): Promise<void> {
    const manual = options.manual ?? false;

    // For automatic check: check launch guard & autoCheck setting
    if (!manual) {
      if (this.hasCheckedThisLaunch) {
        return;
      }

      if (this.getSettings) {
        try {
          const settings = await this.getSettings();
          if (settings?.general?.checkForUpdatesAutomatically === false) {
            return; // Setting is disabled: do not perform any update check
          }
        } catch {
          // If fetching settings fails, continue with default (enabled)
        }
      }
    }

    if (!manual) {
      this.hasCheckedThisLaunch = true;
    }

    let releaseUrl = `https://github.com/${this.repoOwner}/${this.repoName}/releases`;
    let latestVersionTag: string | null = null;

    try {
      const apiUrl = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
      const response = await this.fetchFn(apiUrl, {
        headers: {
          'User-Agent': `CommandDeck/${this.currentVersion}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        if (manual) {
          await this.showCheckFailedDialog(`HTTP Error ${response.status}`);
        }
        return;
      }

      const data = (await response.json()) as GitHubRelease;
      if (!data || typeof data !== 'object' || !data.tag_name) {
        if (manual) {
          await this.showCheckFailedDialog(
            'Invalid response format from GitHub.',
          );
        }
        return;
      }

      // Ignore draft and prerelease releases
      if (data.draft || data.prerelease) {
        if (manual) {
          await this.showUpToDateDialog();
        }
        return;
      }

      latestVersionTag = data.tag_name;
      if (data.html_url) {
        releaseUrl = data.html_url;
      }
    } catch (err) {
      if (manual) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.showCheckFailedDialog(msg);
      }
      return;
    }

    if (!latestVersionTag) {
      return;
    }

    const latestVersionStr = latestVersionTag.replace(/^v/i, '');
    const isNew = isNewerVersion(latestVersionStr, this.currentVersion);

    if (isNew) {
      if (this.showMessageBox) {
        const curVer = this.currentVersion.startsWith('v')
          ? this.currentVersion
          : `v${this.currentVersion}`;
        const newVer = latestVersionStr.startsWith('v')
          ? latestVersionStr
          : `v${latestVersionStr}`;

        const result = await this.showMessageBox({
          type: 'info',
          title: 'Update Available',
          message: 'A new version of CommandDeck is available.',
          detail: `Current Version:\n${curVer}\n\nLatest Version:\n${newVer}\n\nWould you like to view the release notes?`,
          buttons: ['View Release', 'Later'],
          defaultId: 0,
          cancelId: 1,
          ...(this.icon ? { icon: this.icon } : {}),
        });

        if (result.response === 0 && this.openExternal) {
          await this.openExternal(releaseUrl);
        }
      }
    } else if (manual) {
      await this.showUpToDateDialog();
    }
  }

  private async showUpToDateDialog(): Promise<void> {
    if (this.showMessageBox) {
      await this.showMessageBox({
        type: 'info',
        title: 'CommandDeck is Up to Date',
        message: 'No update available.',
        detail: `You are running the latest version of CommandDeck (v${this.currentVersion}).`,
        buttons: ['OK'],
      });
    }
  }

  private async showCheckFailedDialog(detail: string): Promise<void> {
    if (this.showMessageBox) {
      await this.showMessageBox({
        type: 'error',
        title: 'Update Check Failed',
        message: 'Unable to check for updates.',
        detail,
        buttons: ['OK'],
      });
    }
  }
}
