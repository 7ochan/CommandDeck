import type { CommandHistoryEntry } from './types.ts';

export const HISTORY_LIST_NEAR_TOP_PX = 80;

export type HistoryNavigationDirection = 'first' | 'last' | 'next' | 'previous';

export function shouldRerunSelectedHistoryEntry(
  key: string,
  isSelected: boolean,
): boolean {
  return key === 'Enter' && isSelected;
}

export function shouldClearHistorySelection(key: string): boolean {
  return key === 'Escape';
}

export function getHistoryNavigationDirection(
  key: string,
): HistoryNavigationDirection | null {
  if (key === 'ArrowDown') {
    return 'next';
  }

  if (key === 'ArrowUp') {
    return 'previous';
  }

  if (key === 'Home') {
    return 'first';
  }

  if (key === 'End') {
    return 'last';
  }

  return null;
}

export function isNearHistoryListTop(
  scrollTop: number,
  threshold = HISTORY_LIST_NEAR_TOP_PX,
): boolean {
  return scrollTop <= threshold;
}

export function hasNewLeadingHistoryEntry(
  previousEntryIds: ReadonlySet<string>,
  entries: readonly CommandHistoryEntry[],
): boolean {
  const leadingEntry = entries[0];
  return Boolean(leadingEntry && !previousEntryIds.has(leadingEntry.commandId));
}

export function getNavigatedHistoryEntryId(
  entries: readonly CommandHistoryEntry[],
  currentId: string,
  direction: HistoryNavigationDirection,
): string | null {
  const currentIndex = entries.findIndex(
    ({ commandId }) => commandId === currentId,
  );

  if (currentIndex === -1 || entries.length === 0) {
    return null;
  }

  const targetIndex =
    direction === 'first'
      ? 0
      : direction === 'last'
        ? entries.length - 1
        : direction === 'next'
          ? Math.min(currentIndex + 1, entries.length - 1)
          : Math.max(currentIndex - 1, 0);

  return entries[targetIndex]?.commandId ?? null;
}
