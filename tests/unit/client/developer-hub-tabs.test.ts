import { describe, expect, it } from 'vitest';

import {
  DEVELOPER_HUB_TABS,
  getDeveloperHubTabForKey,
} from '../../../src/components/layout/developer-hub-tabs.js';

describe('Developer Hub tabs', () => {
  it('registers only the implemented Deck and History panels', () => {
    expect(DEVELOPER_HUB_TABS).toEqual([
      { id: 'deck', label: 'Deck' },
      { id: 'history', label: 'History' },
    ]);
  });

  it('supports wrapping arrow-key navigation', () => {
    expect(getDeveloperHubTabForKey('deck', 'ArrowRight')).toBe('history');
    expect(getDeveloperHubTabForKey('history', 'ArrowRight')).toBe('deck');
    expect(getDeveloperHubTabForKey('deck', 'ArrowLeft')).toBe('history');
  });

  it('supports Home and End without consuming unrelated keys', () => {
    expect(getDeveloperHubTabForKey('history', 'Home')).toBe('deck');
    expect(getDeveloperHubTabForKey('deck', 'End')).toBe('history');
    expect(getDeveloperHubTabForKey('deck', 'Enter')).toBeNull();
  });
});
