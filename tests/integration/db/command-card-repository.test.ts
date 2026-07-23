import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { CommandEventBus } from '../../../src/server/commands/command-events.js';
import { CommandService } from '../../../src/server/commands/command-service.js';
import {
  openCommandDeckDatabase,
  type CommandDeckDatabase,
} from '../../../src/server/db/client.js';
import { SqliteCommandCardRepository } from '../../../src/server/db/repositories/command-card-repository.js';
import type {
  CommandCard,
  CommandCompletedPayload,
} from '../../../src/shared/types/command.js';

const openDatabases: CommandDeckDatabase[] = [];
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const database of openDatabases.splice(0)) {
    database.close();
  }

  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('command card persistence', () => {
  it('initializes a database and applies its first migration automatically', () => {
    const { database, databasePath } = createTemporaryDatabase();

    expect(existsSync(databasePath)).toBe(true);
    expect(database.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(database.sqlite.pragma('journal_mode', { simple: true })).toBe(
      'wal',
    );
    expect(
      database.sqlite
        .prepare('SELECT name FROM schema_migrations ORDER BY id')
        .pluck()
        .all(),
    ).toEqual(['command_cards']);
  });

  it('subscribes to completed events and ignores duplicate command IDs', () => {
    const { database } = createTemporaryDatabase();
    const repository = new SqliteCommandCardRepository(database.orm);
    const commandEvents = new CommandEventBus();
    const commandService = new CommandService(
      repository,
      commandEvents,
      () => 2_000,
    );
    const completed = completedCommand({ commandId: 'command-1' });

    commandEvents.publish({
      type: 'command.started',
      payload: {
        commandId: completed.commandId,
        command: completed.command,
        cwd: completed.cwd,
        startedAt: completed.startedAt,
      },
    });
    commandEvents.publish({ type: 'command.completed', payload: completed });
    commandEvents.publish({ type: 'command.completed', payload: completed });

    expect(commandService.listCommandCards()).toEqual([
      { ...completed, createdAt: 2_000 },
    ]);
    commandService.close();
  });

  it('returns newest cards first and survives reopening the database', () => {
    const { database, databasePath } = createTemporaryDatabase();
    const repository = new SqliteCommandCardRepository(database.orm);
    const older = persistedCommand({
      commandId: 'older',
      startedAt: 1_000,
      endedAt: 1_100,
      createdAt: 1_200,
    });
    const newer = persistedCommand({
      commandId: 'newer',
      startedAt: 2_000,
      endedAt: 2_100,
      createdAt: 2_200,
    });

    expect(repository.insert(older)).toBe(true);
    expect(repository.insert(newer)).toBe(true);
    expect(repository.insert(newer)).toBe(false);
    expect(repository.listNewestFirst()).toEqual([newer, older]);

    database.close();
    openDatabases.splice(openDatabases.indexOf(database), 1);

    const reopened = openCommandDeckDatabase(databasePath);
    openDatabases.push(reopened);
    const reopenedRepository = new SqliteCommandCardRepository(reopened.orm);

    expect(reopenedRepository.listNewestFirst()).toEqual([newer, older]);
  });
});

function createTemporaryDatabase(): {
  database: CommandDeckDatabase;
  databasePath: string;
} {
  const directory = mkdtempSync(join(tmpdir(), 'commanddeck-db-test-'));
  const databasePath = join(directory, 'commanddeck.db');
  const database = openCommandDeckDatabase(databasePath);
  temporaryDirectories.push(directory);
  openDatabases.push(database);
  return { database, databasePath };
}

function completedCommand(
  overrides: Partial<CommandCompletedPayload> = {},
): CommandCompletedPayload {
  return {
    commandId: 'command-id',
    command: 'printf hello',
    cwd: '/tmp/project',
    exitCode: 0,
    startedAt: 1_000,
    endedAt: 1_100,
    durationMs: 100,
    completionReason: 'shell',
    ...overrides,
  };
}

function persistedCommand(overrides: Partial<CommandCard> = {}): CommandCard {
  return {
    ...completedCommand(overrides),
    createdAt: 1_200,
    ...overrides,
  };
}
