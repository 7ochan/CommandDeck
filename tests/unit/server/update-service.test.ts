import { describe, expect, it, vi } from 'vitest';
import {
  isNewerVersion,
  UpdateService,
} from '../../../electron/update-service.js';

describe('isNewerVersion', () => {
  it('correctly compares semantic versions', () => {
    expect(isNewerVersion('0.1.6', '0.1.5')).toBe(true);
    expect(isNewerVersion('v0.1.6', '0.1.5')).toBe(true);
    expect(isNewerVersion('0.1.5', '0.1.5')).toBe(false);
    expect(isNewerVersion('0.1.4', '0.1.5')).toBe(false);
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true);
    expect(isNewerVersion('0.2.0', '0.1.9')).toBe(true);
  });
});

describe('UpdateService', () => {
  it('does not perform fetch request if autoCheck setting is disabled', async () => {
    const fetchFn = vi.fn();
    const showMessageBox = vi.fn();

    const service = new UpdateService({
      currentVersion: '0.1.5',
      fetchFn,
      showMessageBox,
      getSettings: () => ({
        general: { checkForUpdatesAutomatically: false },
      }),
    });

    await service.checkForUpdates({ manual: false });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(showMessageBox).not.toHaveBeenCalled();
  });

  it('silently skips update check if offline / network fetch throws', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('Network offline'));
    const showMessageBox = vi.fn();

    const service = new UpdateService({
      currentVersion: '0.1.5',
      fetchFn,
      showMessageBox,
      getSettings: () => ({
        general: { checkForUpdatesAutomatically: true },
      }),
    });

    await service.checkForUpdates({ manual: false });

    expect(fetchFn).toHaveBeenCalled();
    expect(showMessageBox).not.toHaveBeenCalled();
  });

  it('does not show dialog if current version equals latest version', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v0.1.5',
        html_url: 'https://github.com/7ochan/CommandDeck/releases/tag/v0.1.5',
        draft: false,
        prerelease: false,
      }),
    } as Response);
    const showMessageBox = vi.fn();

    const service = new UpdateService({
      currentVersion: '0.1.5',
      fetchFn,
      showMessageBox,
      getSettings: () => ({
        general: { checkForUpdatesAutomatically: true },
      }),
    });

    await service.checkForUpdates({ manual: false });

    expect(fetchFn).toHaveBeenCalled();
    expect(showMessageBox).not.toHaveBeenCalled();
  });

  it('ignores draft and prerelease releases during automatic check', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v0.1.6',
        html_url: 'https://github.com/7ochan/CommandDeck/releases/tag/v0.1.6',
        draft: true,
        prerelease: false,
      }),
    } as Response);
    const showMessageBox = vi.fn();

    const service = new UpdateService({
      currentVersion: '0.1.5',
      fetchFn,
      showMessageBox,
    });

    await service.checkForUpdates({ manual: false });

    expect(showMessageBox).not.toHaveBeenCalled();
  });

  it('shows Update Available dialog when current version < latest version', async () => {
    const releaseUrl =
      'https://github.com/7ochan/CommandDeck/releases/tag/v0.1.6';
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v0.1.6',
        html_url: releaseUrl,
        draft: false,
        prerelease: false,
      }),
    } as Response);
    const showMessageBox = vi.fn().mockResolvedValue({ response: 0 }); // Clicked "View Release"
    const openExternal = vi.fn().mockResolvedValue(undefined);

    const service = new UpdateService({
      currentVersion: '0.1.5',
      fetchFn,
      showMessageBox,
      openExternal,
      getSettings: () => ({
        general: { checkForUpdatesAutomatically: true },
      }),
    });

    await service.checkForUpdates({ manual: false });

    expect(showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        title: 'Update Available',
        buttons: ['View Release', 'Later'],
        detail: expect.stringContaining('CommandDeck 0.1.6 is available.'),
      }),
    );
    expect(openExternal).toHaveBeenCalledWith(releaseUrl);
  });

  it('only checks once per application launch during automatic check', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v0.1.5',
        html_url: '',
        draft: false,
        prerelease: false,
      }),
    } as Response);

    const service = new UpdateService({
      currentVersion: '0.1.5',
      fetchFn,
    });

    await service.checkForUpdates({ manual: false });
    await service.checkForUpdates({ manual: false });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
