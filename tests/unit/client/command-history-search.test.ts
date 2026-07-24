import { describe, expect, it } from 'vitest';

import { getHighlightedTextSegments } from '../../../src/features/command-history/highlight.js';
import { buildCommandHistoryUrl } from '../../../src/features/command-history/query.js';
import {
  getCommandHistoryStatus,
  hasActiveCommandHistoryQuery,
  matchesCommandHistoryQuery,
} from '../../../src/shared/history-status.js';
import type { CommandHistoryEntry } from '../../../src/shared/types/command.js';

describe('Command History search behavior', () => {
  it('derives statuses including Ctrl+C and session exits', () => {
    expect(getCommandHistoryStatus(entry({ exitCode: 0 }))).toBe('success');
    expect(getCommandHistoryStatus(entry({ exitCode: 2 }))).toBe('failed');
    expect(getCommandHistoryStatus(entry({ exitCode: 130 }))).toBe(
      'interrupted',
    );
    expect(
      getCommandHistoryStatus(
        entry({ completionReason: 'session-exit', exitCode: 0 }),
      ),
    ).toBe('interrupted');
  });

  it('matches command or cwd together with selected statuses', () => {
    const command = entry({
      command: 'npm run Build',
      cwd: '/Users/dev/CommandDeck',
      exitCode: 1,
    });

    expect(
      matchesCommandHistoryQuery(command, {
        searchTerm: 'build',
        statuses: ['failed'],
      }),
    ).toBe(true);
    expect(
      matchesCommandHistoryQuery(command, {
        searchTerm: 'commanddeck',
        statuses: ['failed'],
      }),
    ).toBe(true);
    expect(
      matchesCommandHistoryQuery(command, {
        searchTerm: 'build',
        statuses: ['success'],
      }),
    ).toBe(false);
    expect(
      hasActiveCommandHistoryQuery({ searchTerm: '  ', statuses: [] }),
    ).toBe(false);
  });

  it('highlights every case-insensitive literal match', () => {
    expect(getHighlightedTextSegments('Git git GIT', 'git')).toEqual([
      { text: 'Git', isMatch: true },
      { text: ' ', isMatch: false },
      { text: 'git', isMatch: true },
      { text: ' ', isMatch: false },
      { text: 'GIT', isMatch: true },
    ]);
    expect(getHighlightedTextSegments('printf "a.*b"', 'a.*b')).toEqual([
      { text: 'printf "', isMatch: false },
      { text: 'a.*b', isMatch: true },
      { text: '"', isMatch: false },
    ]);
  });

  it('encodes the History query without empty parameters', () => {
    expect(
      buildCommandHistoryUrl('workspace-one', {
        searchTerm: '  ',
        statuses: [],
      }),
    ).toBe('/api/history?workspaceId=workspace-one');
    expect(
      buildCommandHistoryUrl('workspace-one', {
        searchTerm: 'npm test',
        statuses: ['failed', 'interrupted'],
      }),
    ).toBe(
      '/api/history?workspaceId=workspace-one&q=npm+test&status=failed&status=interrupted',
    );
  });
});

function entry(
  overrides: Partial<CommandHistoryEntry> = {},
): CommandHistoryEntry {
  return {
    commandId: 'command-id',
    workspaceId: 'workspace-one',
    command: 'printf hello',
    cwd: '/tmp/project',
    exitCode: 0,
    startedAt: 1,
    endedAt: 2,
    durationMs: 1,
    completionReason: 'shell',
    createdAt: 3,
    ...overrides,
  };
}
