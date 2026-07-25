import { describe, expect, it } from 'vitest';

import {
  mergeAppSettings,
  resolveApplicationTheme,
} from '../../../src/features/settings/settings-state.js';
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/types/settings.js';

describe('Settings client state', () => {
  it('merges nested updates without resetting unrelated preferences', () => {
    const updated = mergeAppSettings(DEFAULT_APP_SETTINGS, {
      terminal: { fontSize: 18 },
    });

    expect(updated.terminal.fontSize).toBe(18);
    expect(updated.terminal.cursorStyle).toBe('bar');
    expect(updated.general).toEqual(DEFAULT_APP_SETTINGS.general);
  });

  it('resolves system appearance while preserving explicit themes', () => {
    expect(resolveApplicationTheme('system', true)).toBe('dark');
    expect(resolveApplicationTheme('system', false)).toBe('light');
    expect(resolveApplicationTheme('light', true)).toBe('light');
  });
});
