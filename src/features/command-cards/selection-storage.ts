const SELECTED_COMMAND_CARD_KEY = 'commanddeck:selected-command-card';

type SelectionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function resolveRestoredCommandCardId(
  storedCommandId: string | null,
  availableCommandIds: ReadonlySet<string>,
): string | null {
  return storedCommandId && availableCommandIds.has(storedCommandId)
    ? storedCommandId
    : null;
}

export function loadSelectedCommandCardId(
  storage?: SelectionStorage,
): string | null {
  try {
    return resolveStorage(storage)?.getItem(SELECTED_COMMAND_CARD_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveSelectedCommandCardId(
  commandId: string | null,
  storage?: SelectionStorage,
): void {
  try {
    const resolvedStorage = resolveStorage(storage);

    if (!resolvedStorage) {
      return;
    }

    if (commandId) {
      resolvedStorage.setItem(SELECTED_COMMAND_CARD_KEY, commandId);
    } else {
      resolvedStorage.removeItem(SELECTED_COMMAND_CARD_KEY);
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
