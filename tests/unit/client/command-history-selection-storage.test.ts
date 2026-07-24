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

    saveSelectedHistoryEntryId('workspace-one', 'command-2', storage);
    expect(loadSelectedHistoryEntryId('workspace-one', storage)).toBe(
      'command-2',
    );
    expect(
      resolveRestoredHistoryEntryId(
        loadSelectedHistoryEntryId('workspace-one', storage),
        new Set(['command-1', 'command-2']),
      ),
    ).toBe('command-2');
    expect(
      resolveRestoredHistoryEntryId(
        loadSelectedHistoryEntryId('workspace-one', storage),
        new Set(['command-1']),
      ),
    ).toBeNull();

    saveSelectedHistoryEntryId('workspace-one', null, storage);
    expect(loadSelectedHistoryEntryId('workspace-one', storage)).toBeNull();

    saveSelectedHistoryEntryId('workspace-two', 'command-3', storage);
    expect(loadSelectedHistoryEntryId('workspace-one', storage)).toBeNull();
    expect(loadSelectedHistoryEntryId('workspace-two', storage)).toBe(
      'command-3',
    );
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

    expect(loadSelectedHistoryEntryId('workspace-one', storage)).toBeNull();
    expect(() =>
      saveSelectedHistoryEntryId('workspace-one', 'command-1', storage),
    ).not.toThrow();
  });
});
