import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ACTIONS,
  eventToShortcutString,
  formatShortcutDisplay,
  normalizeShortcutString,
  toElectronAccelerator,
} from '../../../src/features/keybindings/registry';

describe('Keybindings Registry & Formatting', () => {
  it('includes all standard required action categories and default shortcuts', () => {
    const categories = new Set(DEFAULT_ACTIONS.map((a) => a.category));
    expect(categories).toContain('Application');
    expect(categories).toContain('Workspace');
    expect(categories).toContain('Terminal');
    expect(categories).toContain('Developer Hub');
    expect(categories).toContain('Navigation');

    const ids = new Set(DEFAULT_ACTIONS.map((a) => a.id));
    expect(ids).toContain('app.openSettings');
    expect(ids).toContain('app.openCommandPalette');
    expect(ids).toContain('app.toggleSidebar');
    expect(ids).toContain('workspace.new');
    expect(ids).toContain('terminal.focus');
    expect(ids).toContain('developerHub.searchCommands');
    expect(ids).toContain('navigation.goBack');
  });

  it('formats shortcuts in platform-aware display formats', () => {
    // macOS display formatting
    expect(formatShortcutDisplay('Mod+K', true)).toBe('⌘K');
    expect(formatShortcutDisplay('Mod+Shift+P', true)).toBe('⌘⇧P');
    expect(formatShortcutDisplay('Alt+Mod+I', true)).toBe('⌘⌥I');

    // Windows/Linux display formatting
    expect(formatShortcutDisplay('Mod+K', false)).toBe('Ctrl+K');
    expect(formatShortcutDisplay('Mod+Shift+P', false)).toBe('Ctrl+Shift+P');
    expect(formatShortcutDisplay('Alt+Shift+P', false)).toBe('Alt+Shift+P');
  });

  it('converts canonical shortcuts to Electron native accelerators', () => {
    expect(toElectronAccelerator('Mod+K')).toBe('CmdOrCtrl+K');
    expect(toElectronAccelerator('Mod+Shift+N')).toBe('CmdOrCtrl+Shift+N');
    expect(toElectronAccelerator('Alt+Left')).toBe('Alt+Left');
  });

  it('parses browser KeyboardEvents to canonical shortcut strings', () => {
    const macEvent = {
      key: 'k',
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent;
    expect(eventToShortcutString(macEvent, true)).toBe('Mod+K');

    const winEvent = {
      key: 'p',
      metaKey: false,
      ctrlKey: true,
      altKey: false,
      shiftKey: true,
    } as KeyboardEvent;
    expect(eventToShortcutString(winEvent, false)).toBe('Mod+Shift+P');
  });

  it('normalizes case and modifier order', () => {
    expect(normalizeShortcutString('shift+mod+p')).toBe('Mod+Shift+P');
    expect(normalizeShortcutString('cmd+k')).toBe('Mod+K');
  });
});
