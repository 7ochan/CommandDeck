import { describe, expect, it } from 'vitest';

import {
  consumePendingDeveloperHubTab,
  requestDeveloperHubTab,
} from '../../../src/components/layout/developer-hub-navigation.js';

describe('Developer Hub navigation handoff', () => {
  it('stores and consumes a requested tab once', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    requestDeveloperHubTab('history', storage);
    expect(consumePendingDeveloperHubTab(storage)).toBe('history');
    expect(consumePendingDeveloperHubTab(storage)).toBeNull();
  });

  it('ignores unknown tab values', () => {
    const storage = {
      getItem: () => 'analytics',
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    expect(consumePendingDeveloperHubTab(storage)).toBeNull();
  });
});
