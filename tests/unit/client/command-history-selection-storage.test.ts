import { describe, expect, it } from 'vitest';

import {
  loadSelectedHistoryEntryId,
  resolveRestoredHistoryEntryId,
  saveSelectedHistoryEntryId,
} from '../../../src/features/command-history/selection-storage.js';

describe('Command History selection persistence', () => {
  it('restores and clears the session-scoped selected entry ID', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    saveSelectedHistoryEntryId('command-2', storage);
    expect(loadSelectedHistoryEntryId(storage)).toBe('command-2');
    expect(
      resolveRestoredHistoryEntryId(
        loadSelectedHistoryEntryId(storage),
        new Set(['command-1', 'command-2']),
      ),
    ).toBe('command-2');
    expect(
      resolveRestoredHistoryEntryId(
        loadSelectedHistoryEntryId(storage),
        new Set(['command-1']),
      ),
    ).toBeNull();

    saveSelectedHistoryEntryId(null, storage);
    expect(loadSelectedHistoryEntryId(storage)).toBeNull();
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

    expect(loadSelectedHistoryEntryId(storage)).toBeNull();
    expect(() =>
      saveSelectedHistoryEntryId('command-1', storage),
    ).not.toThrow();
  });
});
