import type { CommandHistoryEntry } from '@/shared/types';

export const ACTIVITY_SESSION_INACTIVITY_MS = 15 * 60 * 1_000;

export type ActivitySession = {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  commandCount: number;
  events: CommandHistoryEntry[];
};

export function groupHistoryIntoActivitySessions(
  entries: readonly CommandHistoryEntry[],
): ActivitySession[] {
  const chronologicalEntries = [...entries].sort(compareChronologically);
  const sessions: ActivitySession[] = [];
  let currentEvents: CommandHistoryEntry[] = [];

  for (const entry of chronologicalEntries) {
    const previousEntry = currentEvents.at(-1);
    const startsNewSession =
      previousEntry !== undefined &&
      (entry.startedAt - previousEntry.endedAt >
        ACTIVITY_SESSION_INACTIVITY_MS ||
        hasSignificantWorkingDirectoryChange(previousEntry.cwd, entry.cwd));

    if (startsNewSession) {
      sessions.push(createActivitySession(currentEvents));
      currentEvents = [];
    }

    currentEvents.push(entry);
  }

  if (currentEvents.length > 0) {
    sessions.push(createActivitySession(currentEvents));
  }

  return sessions;
}

export function hasSignificantWorkingDirectoryChange(
  previousCwd: string,
  nextCwd: string,
): boolean {
  const previous = normalizePath(previousCwd);
  const next = normalizePath(nextCwd);

  if (
    previous === next ||
    isAncestorPath(previous, next) ||
    isAncestorPath(next, previous)
  ) {
    return false;
  }

  return (
    getWorkingDirectoryContext(previous) !== getWorkingDirectoryContext(next)
  );
}

export function getWorkingDirectoryContext(cwd: string): string {
  const normalized = normalizePath(cwd);
  const { prefix, segments } = splitPath(normalized);

  if (segments.length === 0) {
    return prefix || normalized;
  }

  const firstSegment = segments[0]?.toLocaleLowerCase();
  const contextLength =
    firstSegment === 'users' || firstSegment === 'home'
      ? 3
      : firstSegment === 'private' && segments[1]?.toLocaleLowerCase() === 'tmp'
        ? 3
        : 2;

  return `${prefix}${segments.slice(0, contextLength).join('/')}`;
}

function createActivitySession(events: CommandHistoryEntry[]): ActivitySession {
  const firstEvent = events[0];
  const lastEvent = events.at(-1);

  if (!firstEvent || !lastEvent) {
    throw new Error('An Activity Session requires at least one History event.');
  }

  return {
    sessionId: `activity-${firstEvent.commandId}`,
    startedAt: firstEvent.startedAt,
    endedAt: lastEvent.endedAt,
    durationMs: Math.max(0, lastEvent.endedAt - firstEvent.startedAt),
    commandCount: events.length,
    events,
  };
}

function compareChronologically(
  left: CommandHistoryEntry,
  right: CommandHistoryEntry,
): number {
  return (
    left.startedAt - right.startedAt ||
    left.endedAt - right.endedAt ||
    left.commandId.localeCompare(right.commandId)
  );
}

function normalizePath(path: string): string {
  const normalized = path
    .trim()
    .replaceAll('\\', '/')
    .replace(/\/{2,}/g, '/');

  if (normalized === '/' || /^[A-Za-z]:\/$/.test(normalized)) {
    return normalized;
  }

  return normalized.replace(/\/$/, '');
}

function splitPath(path: string): { prefix: string; segments: string[] } {
  const drive = path.match(/^[A-Za-z]:\//)?.[0];
  const prefix = drive ?? (path.startsWith('/') ? '/' : '');
  const withoutPrefix = drive
    ? path.slice(drive.length)
    : path.startsWith('/')
      ? path.slice(1)
      : path;

  return {
    prefix,
    segments: withoutPrefix.split('/').filter(Boolean),
  };
}

function isAncestorPath(ancestor: string, candidate: string): boolean {
  if (ancestor === '/' || /^[A-Za-z]:\/$/.test(ancestor)) {
    return candidate.startsWith(ancestor);
  }

  return candidate.startsWith(`${ancestor}/`);
}
