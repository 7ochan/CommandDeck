import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_SESSION_INACTIVITY_MS,
  getWorkingDirectoryContext,
  groupHistoryIntoActivitySessions,
  hasSignificantWorkingDirectoryChange,
} from '../../../src/features/timeline/activity-sessions.js';
import type { CommandHistoryEntry } from '../../../src/shared/types/command.js';

describe('Workspace Timeline Activity Sessions', () => {
  it('groups chronologically across nearby commands in one directory context', () => {
    const first = entry('first', {
      cwd: '/Users/dev/project',
      startedAt: 1_000,
      endedAt: 2_000,
    });
    const second = entry('second', {
      cwd: '/Users/dev/project/src',
      startedAt: 3_000,
      endedAt: 5_000,
    });
    const third = entry('third', {
      cwd: '/Users/dev/project/tests',
      startedAt: 6_000,
      endedAt: 9_000,
    });

    const sessions = groupHistoryIntoActivitySessions([third, first, second]);

    expect(sessions).toEqual([
      {
        sessionId: 'activity-first',
        startedAt: 1_000,
        endedAt: 9_000,
        durationMs: 8_000,
        commandCount: 3,
        events: [first, second, third],
      },
    ]);
  });

  it('starts sessions after more than 15 minutes or a project-context change', () => {
    const first = entry('first', {
      cwd: '/Users/dev/project',
      startedAt: 0,
      endedAt: 1_000,
    });
    const atBoundary = entry('boundary', {
      cwd: '/Users/dev/project/src',
      startedAt: 1_000 + ACTIVITY_SESSION_INACTIVITY_MS,
      endedAt: 1_000 + ACTIVITY_SESSION_INACTIVITY_MS + 100,
    });
    const afterBoundary = entry('inactive', {
      cwd: '/Users/dev/project',
      startedAt: atBoundary.endedAt + ACTIVITY_SESSION_INACTIVITY_MS + 1,
      endedAt: atBoundary.endedAt + ACTIVITY_SESSION_INACTIVITY_MS + 101,
    });
    const otherProject = entry('other-project', {
      cwd: '/Users/dev/other-project',
      startedAt: afterBoundary.endedAt + 1,
      endedAt: afterBoundary.endedAt + 2,
    });

    expect(
      groupHistoryIntoActivitySessions([
        first,
        atBoundary,
        afterBoundary,
        otherProject,
      ]).map(({ events }) => events.map(({ commandId }) => commandId)),
    ).toEqual([['first', 'boundary'], ['inactive'], ['other-project']]);
  });

  it('normalizes common directory contexts without mutating input', () => {
    const entries = [entry('second', { startedAt: 2 }), entry('first')];
    const originalOrder = entries.map(({ commandId }) => commandId);

    groupHistoryIntoActivitySessions(entries);

    expect(entries.map(({ commandId }) => commandId)).toEqual(originalOrder);
    expect(getWorkingDirectoryContext('/Users/dev/project/src')).toBe(
      '/Users/dev/project',
    );
    expect(getWorkingDirectoryContext('C:\\Users\\dev\\project\\src')).toBe(
      'C:/Users/dev/project',
    );
    expect(
      hasSignificantWorkingDirectoryChange(
        '/Users/dev/project/src',
        '/Users/dev/project/tests',
      ),
    ).toBe(false);
    expect(
      hasSignificantWorkingDirectoryChange(
        '/Users/dev/project',
        '/Users/dev/another-project',
      ),
    ).toBe(true);
  });

  it('groups thousands of entries without changing their History records', () => {
    const entries = Array.from({ length: 5_000 }, (_, index) =>
      entry(`command-${index}`, {
        startedAt: index * 10,
        endedAt: index * 10 + 5,
      }),
    );

    const sessions = groupHistoryIntoActivitySessions(entries);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.commandCount).toBe(5_000);
    expect(sessions[0]?.events[0]).toBe(entries[0]);
    expect(sessions[0]?.events.at(-1)).toBe(entries.at(-1));
  });
});

function entry(
  commandId: string,
  overrides: Partial<CommandHistoryEntry> = {},
): CommandHistoryEntry {
  return {
    commandId,
    workspaceId: 'workspace-one',
    command: `printf ${commandId}`,
    cwd: '/Users/dev/project',
    exitCode: 0,
    startedAt: 1,
    endedAt: 2,
    durationMs: 1,
    completionReason: 'shell',
    createdAt: 3,
    ...overrides,
  };
}
