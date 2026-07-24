import { describe, expect, it } from 'vitest';

import { getHighlightedTextSegments } from '../../../src/features/command-cards/highlight.js';
import { buildCommandCardsUrl } from '../../../src/features/command-cards/query.js';
import {
  getCommandCardStatus,
  hasActiveCommandCardQuery,
  matchesCommandCardQuery,
} from '../../../src/shared/command-card-status.js';
import type { CommandCard } from '../../../src/shared/types/command.js';

describe('Command Card search behavior', () => {
  it('derives mutually exclusive statuses including Ctrl+C and session exits', () => {
    expect(getCommandCardStatus(card({ exitCode: 0 }))).toBe('success');
    expect(getCommandCardStatus(card({ exitCode: 2 }))).toBe('failed');
    expect(getCommandCardStatus(card({ exitCode: 130 }))).toBe('interrupted');
    expect(
      getCommandCardStatus(
        card({ completionReason: 'session-exit', exitCode: 0 }),
      ),
    ).toBe('interrupted');
  });

  it('matches command or cwd together with selected statuses', () => {
    const command = card({
      command: 'npm run Build',
      cwd: '/Users/dev/CommandDeck',
      exitCode: 1,
    });

    expect(
      matchesCommandCardQuery(command, {
        searchTerm: 'build',
        statuses: ['failed'],
      }),
    ).toBe(true);
    expect(
      matchesCommandCardQuery(command, {
        searchTerm: 'commanddeck',
        statuses: ['failed'],
      }),
    ).toBe(true);
    expect(
      matchesCommandCardQuery(command, {
        searchTerm: 'build',
        statuses: ['success'],
      }),
    ).toBe(false);
    expect(hasActiveCommandCardQuery({ searchTerm: '  ', statuses: [] })).toBe(
      false,
    );
  });

  it('highlights every case-insensitive literal match without treating symbols as regex', () => {
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

  it('encodes the extensible HTTP query without empty parameters', () => {
    expect(buildCommandCardsUrl({ searchTerm: '  ', statuses: [] })).toBe(
      '/api/commands',
    );
    expect(
      buildCommandCardsUrl({
        searchTerm: 'npm test',
        statuses: ['failed', 'interrupted'],
      }),
    ).toBe('/api/commands?q=npm+test&status=failed&status=interrupted');
  });
});

function card(overrides: Partial<CommandCard> = {}): CommandCard {
  return {
    commandId: 'command-id',
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
