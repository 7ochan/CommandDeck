import { describe, expect, it } from 'vitest';

import {
  getHistoryNavigationDirection,
  getNavigatedHistoryEntryId,
  hasNewLeadingHistoryEntry,
  isNearHistoryListTop,
  shouldClearHistorySelection,
  shouldRerunSelectedHistoryEntry,
} from '../../../src/features/command-history/history-list-behavior.js';
import type { CommandHistoryEntry } from '../../../src/shared/types/command.js';

describe('Command History interaction behavior', () => {
  it('reruns with Enter only when the focused entry is selected', () => {
    expect(shouldRerunSelectedHistoryEntry('Enter', true)).toBe(true);
    expect(shouldRerunSelectedHistoryEntry('Enter', false)).toBe(false);
    expect(shouldRerunSelectedHistoryEntry(' ', true)).toBe(false);
  });

  it('clears selection only for Escape', () => {
    expect(shouldClearHistorySelection('Escape')).toBe(true);
    expect(shouldClearHistorySelection('Enter')).toBe(false);
  });

  it('maps keyboard navigation and keeps movement within History', () => {
    const entries = [entry('one'), entry('two'), entry('three')];

    expect(getHistoryNavigationDirection('ArrowDown')).toBe('next');
    expect(getHistoryNavigationDirection('ArrowUp')).toBe('previous');
    expect(getHistoryNavigationDirection('Home')).toBe('first');
    expect(getHistoryNavigationDirection('End')).toBe('last');
    expect(getHistoryNavigationDirection('Tab')).toBeNull();
    expect(getNavigatedHistoryEntryId(entries, 'two', 'next')).toBe('three');
    expect(getNavigatedHistoryEntryId(entries, 'one', 'previous')).toBe('one');
    expect(getNavigatedHistoryEntryId(entries, 'two', 'first')).toBe('one');
  });

  it('autoscrolls only for a new leading History entry near the top', () => {
    const previousIds = new Set(['older']);

    expect(
      hasNewLeadingHistoryEntry(previousIds, [entry('new'), entry('older')]),
    ).toBe(true);
    expect(hasNewLeadingHistoryEntry(previousIds, [entry('older')])).toBe(
      false,
    );
    expect(isNearHistoryListTop(80)).toBe(true);
    expect(isNearHistoryListTop(81)).toBe(false);
  });
});

function entry(commandId: string): CommandHistoryEntry {
  return {
    commandId,
    workspaceId: 'workspace-one',
    command: `printf ${commandId}`,
    cwd: '/tmp',
    exitCode: 0,
    startedAt: 1,
    endedAt: 2,
    durationMs: 1,
    completionReason: 'shell',
    createdAt: 3,
  };
}
