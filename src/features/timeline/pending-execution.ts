const PENDING_TIMELINE_EXECUTION_KEY = 'commanddeck:timeline-execution';

export type PendingTimelineExecution = {
  workspaceId: string;
  command: string;
};

type ExecutionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function queuePendingTimelineExecution(
  execution: PendingTimelineExecution,
  storage?: ExecutionStorage,
): void {
  resolveStorage(storage)?.setItem(
    PENDING_TIMELINE_EXECUTION_KEY,
    JSON.stringify(execution),
  );
}

export function loadPendingTimelineExecution(
  storage?: ExecutionStorage,
): PendingTimelineExecution | null {
  try {
    const value = resolveStorage(storage)?.getItem(
      PENDING_TIMELINE_EXECUTION_KEY,
    );

    if (!value) {
      return null;
    }

    const candidate: unknown = JSON.parse(value);

    return candidate &&
      typeof candidate === 'object' &&
      'workspaceId' in candidate &&
      typeof candidate.workspaceId === 'string' &&
      candidate.workspaceId.length > 0 &&
      'command' in candidate &&
      typeof candidate.command === 'string' &&
      candidate.command.trim().length > 0
      ? { workspaceId: candidate.workspaceId, command: candidate.command }
      : null;
  } catch {
    return null;
  }
}

export function clearPendingTimelineExecution(
  storage?: ExecutionStorage,
): void {
  try {
    resolveStorage(storage)?.removeItem(PENDING_TIMELINE_EXECUTION_KEY);
  } catch {
    // The handoff is optional when session storage is unavailable.
  }
}

function resolveStorage(storage?: ExecutionStorage): ExecutionStorage | null {
  if (storage) {
    return storage;
  }

  return typeof window === 'undefined' ? null : window.sessionStorage;
}
