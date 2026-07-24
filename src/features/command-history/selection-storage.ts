const SELECTED_HISTORY_ENTRY_KEY_PREFIX = 'commanddeck:selected-history-entry:';

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
  workspaceId: string,
  storage?: SelectionStorage,
): string | null {
  try {
    return resolveStorage(storage)?.getItem(selectionKey(workspaceId)) ?? null;
  } catch {
    return null;
  }
}

export function saveSelectedHistoryEntryId(
  workspaceId: string,
  commandId: string | null,
  storage?: SelectionStorage,
): void {
  try {
    const resolvedStorage = resolveStorage(storage);

    if (!resolvedStorage) {
      return;
    }

    if (commandId) {
      resolvedStorage.setItem(selectionKey(workspaceId), commandId);
    } else {
      resolvedStorage.removeItem(selectionKey(workspaceId));
    }
  } catch {
    // Selection persistence is optional when browser storage is unavailable.
  }
}

function selectionKey(workspaceId: string): string {
  return `${SELECTED_HISTORY_ENTRY_KEY_PREFIX}${workspaceId}`;
}

function resolveStorage(storage?: SelectionStorage): SelectionStorage | null {
  if (storage) {
    return storage;
  }

  return typeof window === 'undefined' ? null : window.sessionStorage;
}
