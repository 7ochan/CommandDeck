const ACTIVE_WORKSPACE_KEY = 'commanddeck:active-workspace';

type WorkspaceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function loadActiveWorkspaceId(
  storage?: WorkspaceStorage,
): string | null {
  try {
    return resolveStorage(storage)?.getItem(ACTIVE_WORKSPACE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveActiveWorkspaceId(
  workspaceId: string,
  storage?: WorkspaceStorage,
): void {
  try {
    resolveStorage(storage)?.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
  } catch {
    // The default Workspace remains available when storage is unavailable.
  }
}

function resolveStorage(storage?: WorkspaceStorage): WorkspaceStorage | null {
  if (storage) {
    return storage;
  }

  return typeof window === 'undefined' ? null : window.localStorage;
}
