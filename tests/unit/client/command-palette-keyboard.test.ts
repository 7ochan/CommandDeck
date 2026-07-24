import { describe, expect, it } from 'vitest';

import {
  getNavigatedCommandPaletteIndex,
  isCommandPaletteShortcut,
} from '../../../src/features/command-palette/keyboard.js';

describe('Command Palette keyboard interaction', () => {
  it('accepts Cmd+K and Ctrl+K without extra modifiers', () => {
    expect(shortcut({ metaKey: true })).toBe(true);
    expect(shortcut({ ctrlKey: true })).toBe(true);
    expect(shortcut({ ctrlKey: true, shiftKey: true })).toBe(false);
    expect(shortcut({ metaKey: true, altKey: true })).toBe(false);
  });

  it('wraps arrow navigation through results', () => {
    expect(getNavigatedCommandPaletteIndex(0, 3, 'ArrowDown')).toBe(1);
    expect(getNavigatedCommandPaletteIndex(2, 3, 'ArrowDown')).toBe(0);
    expect(getNavigatedCommandPaletteIndex(0, 3, 'ArrowUp')).toBe(2);
    expect(getNavigatedCommandPaletteIndex(0, 0, 'ArrowDown')).toBeNull();
    expect(getNavigatedCommandPaletteIndex(0, 3, 'Enter')).toBeNull();
  });
});

function shortcut(
  overrides: Partial<Parameters<typeof isCommandPaletteShortcut>[0]>,
): boolean {
  return isCommandPaletteShortcut({
    key: 'k',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  });
}
