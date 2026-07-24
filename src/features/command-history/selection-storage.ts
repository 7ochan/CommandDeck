const SELECTED_HISTORY_ENTRY_KEY = 'commanddeck:selected-history-entry';

type SelectionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function resolveRestoredHistoryEntryId(
  storedCommandId: string | null,
  availableCommandIds: ReadonlySet<string>,
): string | null {
  return storedCommandId && availableCommandIds.has(storedCommandId)
    ? storedCommandId
    : null;
}

export function loadSelectedHistoryEntryId(
  storage?: SelectionStorage,
): string | null {
  try {
    return resolveStorage(storage)?.getItem(SELECTED_HISTORY_ENTRY_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveSelectedHistoryEntryId(
  commandId: string | null,
  storage?: SelectionStorage,
): void {
  try {
    const resolvedStorage = resolveStorage(storage);

    if (!resolvedStorage) {
      return;
    }

    if (commandId) {
      resolvedStorage.setItem(SELECTED_HISTORY_ENTRY_KEY, commandId);
    } else {
      resolvedStorage.removeItem(SELECTED_HISTORY_ENTRY_KEY);
    }
  } catch {
    // Selection persistence is optional when browser storage is unavailable.
  }
}

function resolveStorage(storage?: SelectionStorage): SelectionStorage | null {
  if (storage) {
    return storage;
  }

  return typeof window === 'undefined' ? null : window.sessionStorage;
}
