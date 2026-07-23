import { describe, expect, it } from 'vitest';

import {
  loadSelectedCommandCardId,
  resolveRestoredCommandCardId,
  saveSelectedCommandCardId,
} from '../../../src/features/command-cards/selection-storage.js';

describe('Command Card selection persistence', () => {
  it('restores and clears the session-scoped selected card ID', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    saveSelectedCommandCardId('command-2', storage);
    expect(loadSelectedCommandCardId(storage)).toBe('command-2');
    expect(
      resolveRestoredCommandCardId(
        loadSelectedCommandCardId(storage),
        new Set(['command-1', 'command-2']),
      ),
    ).toBe('command-2');
    expect(
      resolveRestoredCommandCardId(
        loadSelectedCommandCardId(storage),
        new Set(['command-1']),
      ),
    ).toBeNull();

    saveSelectedCommandCardId(null, storage);
    expect(loadSelectedCommandCardId(storage)).toBeNull();
  });

  it('degrades safely when browser storage is unavailable', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };

    expect(loadSelectedCommandCardId(storage)).toBeNull();
    expect(() => saveSelectedCommandCardId('command-1', storage)).not.toThrow();
  });
});
