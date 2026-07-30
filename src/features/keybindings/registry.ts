import type { ActionDefinition } from './types.ts';

export const DEFAULT_ACTIONS: ReadonlyArray<ActionDefinition> = [
  // Application
  {
    id: 'app.openSettings',
    displayName: 'Open Settings',
    category: 'Application',
    description: 'Configure CommandDeck preferences',
    defaultShortcut: 'Mod+,',
  },
  {
    id: 'app.openCommandPalette',
    displayName: 'Open Command Palette',
    category: 'Application',
    description: 'Quick access to commands and navigation',
    defaultShortcut: 'Mod+K',
  },
  {
    id: 'app.toggleSidebar',
    displayName: 'Toggle Sidebar',
    category: 'Application',
    description: 'Show or hide the Developer Hub sidebar',
    defaultShortcut: 'Mod+B',
  },
  {
    id: 'app.toggleHistory',
    displayName: 'Toggle History',
    category: 'Application',
    description: 'Open the Command History panel',
    defaultShortcut: 'Mod+H',
  },
  {
    id: 'app.toggleDeck',
    displayName: 'Toggle Deck',
    category: 'Application',
    description: 'Open the Command Deck panel',
    defaultShortcut: 'Mod+D',
  },

  // Workspace
  {
    id: 'workspace.new',
    displayName: 'New Workspace',
    category: 'Workspace',
    description: 'Create a new visual terminal workspace',
    defaultShortcut: 'Mod+Shift+N',
  },
  {
    id: 'workspace.close',
    displayName: 'Close Workspace',
    category: 'Workspace',
    description: 'Close the currently active workspace',
    defaultShortcut: 'Mod+W',
  },
  {
    id: 'workspace.rename',
    displayName: 'Rename Workspace',
    category: 'Workspace',
    description: 'Rename the active workspace',
    defaultShortcut: 'Mod+Shift+R',
  },
  {
    id: 'workspace.next',
    displayName: 'Next Workspace',
    category: 'Workspace',
    description: 'Switch to the next workspace',
    defaultShortcut: 'Ctrl+Tab',
  },
  {
    id: 'workspace.previous',
    displayName: 'Previous Workspace',
    category: 'Workspace',
    description: 'Switch to the previous workspace',
    defaultShortcut: 'Ctrl+Shift+Tab',
  },

  // Terminal
  {
    id: 'terminal.focus',
    displayName: 'Focus Terminal',
    category: 'Terminal',
    description: 'Move focus to the active terminal',
    defaultShortcut: 'Mod+`',
  },
  {
    id: 'terminal.clear',
    displayName: 'Clear Terminal',
    category: 'Terminal',
    description: 'Clear the active terminal buffer',
    defaultShortcut: 'Ctrl+L',
  },
  {
    id: 'terminal.split',
    displayName: 'Split Terminal (future-ready)',
    category: 'Terminal',
    description: 'Split the active terminal pane',
    defaultShortcut: 'Mod+\\',
  },
  {
    id: 'terminal.copy',
    displayName: 'Copy',
    category: 'Terminal',
    description: 'Copy text selection from terminal',
    defaultShortcut: 'Mod+C',
  },
  {
    id: 'terminal.paste',
    displayName: 'Paste',
    category: 'Terminal',
    description: 'Paste text into terminal',
    defaultShortcut: 'Mod+V',
  },

  // Developer Hub
  {
    id: 'developerHub.searchCommands',
    displayName: 'Search Commands',
    category: 'Developer Hub',
    description: 'Search saved commands in the Developer Hub',
    defaultShortcut: 'Mod+F',
  },
  {
    id: 'developerHub.searchTemplates',
    displayName: 'Search Templates',
    category: 'Developer Hub',
    description: 'Search command templates',
    defaultShortcut: 'Mod+Shift+F',
  },
  {
    id: 'developerHub.runSelectedTemplate',
    displayName: 'Run Selected Template',
    category: 'Developer Hub',
    description: 'Run the highlighted command template',
    defaultShortcut: 'Mod+Enter',
  },

  // Navigation
  {
    id: 'navigation.goBack',
    displayName: 'Go Back',
    category: 'Navigation',
    description: 'Navigate to the previous view',
    defaultShortcut: 'Alt+Left',
  },
  {
    id: 'navigation.goForward',
    displayName: 'Go Forward',
    category: 'Navigation',
    description: 'Navigate to the next view',
    defaultShortcut: 'Alt+Right',
  },
];

export function isMacPlatform(): boolean {
  if (typeof window !== 'undefined' && window.navigator?.platform) {
    return /mac/i.test(window.navigator.platform);
  }
  if (typeof process !== 'undefined' && process.platform) {
    return process.platform === 'darwin';
  }
  return false;
}

/**
 * Normalizes a shortcut string into a standard canonical form.
 * e.g., 'cmd+shift+p' -> 'Mod+Shift+P'
 */
export function normalizeShortcutString(shortcut: string): string {
  if (!shortcut || !shortcut.trim()) return '';

  const parts = shortcut.split('+').map((p) => p.trim());
  let hasMod = false;
  let hasCtrl = false;
  let hasAlt = false;
  let hasShift = false;
  let keyPart = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (
      lower === 'mod' ||
      lower === 'cmd' ||
      lower === 'command' ||
      lower === 'meta' ||
      lower === '⌘'
    ) {
      hasMod = true;
    } else if (lower === 'ctrl' || lower === 'control') {
      hasCtrl = true;
    } else if (lower === 'alt' || lower === 'option' || lower === '⌥') {
      hasAlt = true;
    } else if (lower === 'shift' || lower === '⇧') {
      hasShift = true;
    } else if (part) {
      keyPart = part;
    }
  }

  const resultParts: string[] = [];
  if (hasMod) resultParts.push('Mod');
  if (hasCtrl) resultParts.push('Ctrl');
  if (hasAlt) resultParts.push('Alt');
  if (hasShift) resultParts.push('Shift');
  if (keyPart) {
    // Capitalize single letter keys
    if (keyPart.length === 1) {
      resultParts.push(keyPart.toUpperCase());
    } else {
      // Normalize common key names
      const keyLower = keyPart.toLowerCase();
      if (keyLower === 'arrowup' || keyLower === 'up') resultParts.push('Up');
      else if (keyLower === 'arrowdown' || keyLower === 'down')
        resultParts.push('Down');
      else if (keyLower === 'arrowleft' || keyLower === 'left')
        resultParts.push('Left');
      else if (keyLower === 'arrowright' || keyLower === 'right')
        resultParts.push('Right');
      else if (keyLower === 'escape' || keyLower === 'esc')
        resultParts.push('Esc');
      else if (keyLower === 'enter' || keyLower === 'return')
        resultParts.push('Enter');
      else if (keyLower === 'space') resultParts.push('Space');
      else if (keyLower === 'tab') resultParts.push('Tab');
      else if (keyLower === 'backspace') resultParts.push('Backspace');
      else resultParts.push(keyPart.charAt(0).toUpperCase() + keyPart.slice(1));
    }
  }

  return resultParts.join('+');
}

/**
 * Convert canonical shortcut string into platform-aware display representation.
 * macOS: ⌘K, ⌘⇧P, ⌥⌘I, Ctrl+Tab
 * Windows/Linux: Ctrl+K, Ctrl+Shift+P, Alt+Shift+P
 */
export function formatShortcutDisplay(
  shortcut: string,
  isMac = isMacPlatform(),
): string {
  const normalized = normalizeShortcutString(shortcut);
  if (!normalized) return '';

  if (!isMac) {
    // Windows/Linux format
    return normalized.replace(/Mod/g, 'Ctrl');
  }

  // macOS format: symbols for modifiers
  const parts = normalized.split('+');
  let result = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === 'Mod') result += '⌘';
    else if (part === 'Ctrl') result += 'Ctrl+';
    else if (part === 'Alt') result += '⌥';
    else if (part === 'Shift') result += '⇧';
    else {
      // If previous parts were macOS symbols, concatenate directly (e.g. ⌘⇧P), otherwise with +
      let formattedKey = part;
      if (part === 'Up') formattedKey = '↑';
      else if (part === 'Down') formattedKey = '↓';
      else if (part === 'Left') formattedKey = '←';
      else if (part === 'Right') formattedKey = '→';
      else if (part === 'Esc') formattedKey = 'Esc';
      else if (part === 'Enter') formattedKey = '↵';

      if (
        result.endsWith('⌘') ||
        result.endsWith('⌥') ||
        result.endsWith('⇧')
      ) {
        result += formattedKey;
      } else {
        result += (result ? '+' : '') + formattedKey;
      }
    }
  }

  return result;
}

/**
 * Converts a canonical shortcut string into an Electron native accelerator string.
 * e.g., 'Mod+Shift+N' -> 'CmdOrCtrl+Shift+N'
 */
export function toElectronAccelerator(shortcut: string): string {
  const normalized = normalizeShortcutString(shortcut);
  if (!normalized) return '';
  return normalized.replace(/\bMod\b/g, 'CmdOrCtrl');
}

/**
 * Converts a browser KeyboardEvent into a canonical shortcut string.
 * Returns null if only modifier keys were pressed.
 */
export function eventToShortcutString(
  event: KeyboardEvent,
  isMac = isMacPlatform(),
): string | null {
  const key = event.key;

  // Ignore bare modifier key presses
  if (['Control', 'Meta', 'Shift', 'Alt', 'AltGraph'].includes(key)) {
    return null;
  }

  const parts: string[] = [];

  // Determine Mod vs Ctrl vs Meta
  if (isMac) {
    if (event.metaKey) parts.push('Mod');
    if (event.ctrlKey) parts.push('Ctrl');
  } else {
    if (event.ctrlKey) parts.push('Mod');
    if (event.metaKey) parts.push('Meta');
  }

  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  let keyName = key;
  if (key === ' ') keyName = 'Space';
  else if (key === 'ArrowUp') keyName = 'Up';
  else if (key === 'ArrowDown') keyName = 'Down';
  else if (key === 'ArrowLeft') keyName = 'Left';
  else if (key === 'ArrowRight') keyName = 'Right';
  else if (key === 'Escape') keyName = 'Esc';
  else if (key === 'Enter') keyName = 'Enter';
  else if (key.length === 1) keyName = key.toUpperCase();

  parts.push(keyName);
  return parts.join('+');
}

/**
 * Checks whether two canonical shortcut strings match.
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: string,
  isMac = isMacPlatform(),
): boolean {
  const eventShortcut = eventToShortcutString(event, isMac);
  if (!eventShortcut) return false;
  return (
    normalizeShortcutString(eventShortcut) === normalizeShortcutString(shortcut)
  );
}
