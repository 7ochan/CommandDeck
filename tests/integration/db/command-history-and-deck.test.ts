import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { CommandDeckService } from '../../../src/server/commands/deck-service.js';
import { CommandEventBus } from '../../../src/server/commands/command-events.js';
import { CommandHistoryService } from '../../../src/server/commands/history-service.js';
import {
  openCommandDeckDatabase,
  type CommandDeckDatabase,
} from '../../../src/server/db/client.js';
import { createLegacyCommandHistoryMigration } from '../../../src/server/db/migrations/0001-command-cards.js';
import { SqliteCommandDeckRepository } from '../../../src/server/db/repositories/command-deck-repository.js';
import { SqliteCommandHistoryRepository } from '../../../src/server/db/repositories/command-history-repository.js';
import type {
  CommandCompletedPayload,
  CommandHistoryEntry,
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

describe('Command History and Command Deck persistence', () => {
  it('applies the legacy-preserving History and Deck migration automatically', () => {
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
    ).toEqual(['command_cards', 'command_history_and_deck']);
    expect(
      database.sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        )
        .pluck()
        .all(),
    ).toEqual(
      expect.arrayContaining([
        'command_deck_items',
        'command_definitions',
        'command_history',
      ]),
    );
  });

  it('renames an existing command_cards table without losing History', () => {
    const directory = createTemporaryDirectory();
    const databasePath = join(directory, 'legacy.db');
    const legacy = new Database(databasePath);
    legacy.exec(`
      CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL
      );
      ${createLegacyCommandHistoryMigration.sql}
      INSERT INTO schema_migrations (id, name, applied_at)
      VALUES (1, 'command_cards', 1);
    `);
    const entry = historyEntry({ commandId: 'legacy-command' });
    legacy
      .prepare(
        `INSERT INTO command_cards (
          command_id, command, cwd, exit_code, started_at, ended_at,
          duration_ms, completion_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.commandId,
        entry.command,
        entry.cwd,
        entry.exitCode,
        entry.startedAt,
        entry.endedAt,
        entry.durationMs,
        entry.completionReason,
        entry.createdAt,
      );
    legacy.close();

    const migrated = openCommandDeckDatabase(databasePath);
    openDatabases.push(migrated);

    expect(
      new SqliteCommandHistoryRepository(migrated.orm).findById(
        entry.commandId,
      ),
    ).toEqual(entry);
  });

  it('captures every completion in immutable newest-first History', () => {
    const { database } = createTemporaryDatabase();
    const repository = new SqliteCommandHistoryRepository(database.orm);
    const commandEvents = new CommandEventBus();
    const historyService = new CommandHistoryService(
      repository,
      commandEvents,
      () => 2_000,
    );
    const completed = completedCommand({ commandId: 'command-1' });

    commandEvents.publish({ type: 'command.completed', payload: completed });
    commandEvents.publish({ type: 'command.completed', payload: completed });

    expect(historyService.listHistory()).toEqual([
      { ...completed, createdAt: 2_000 },
    ]);
    historyService.close();
  });

  it('combines literal History search with status filters', () => {
    const { database } = createTemporaryDatabase();
    const repository = new SqliteCommandHistoryRepository(database.orm);
    const success = historyEntry({
      commandId: 'success',
      command: 'npm run Build',
      cwd: '/Users/dev/command-deck',
      exitCode: 0,
      endedAt: 4_000,
    });
    const failed = historyEntry({
      commandId: 'failed',
      command: 'npm test -- --coverage=100%',
      cwd: '/Users/dev/command-deck',
      exitCode: 1,
      endedAt: 3_000,
    });
    const interrupted = historyEntry({
      commandId: 'interrupted',
      command: 'npm run dev',
      cwd: '/Users/dev/dashboard',
      exitCode: 130,
      endedAt: 2_000,
    });

    for (const entry of [success, failed, interrupted]) {
      repository.insert(entry);
    }

    expect(
      repository.listNewestFirst({ searchTerm: 'BUILD', statuses: [] }),
    ).toEqual([success]);
    expect(
      repository.listNewestFirst({
        searchTerm: 'command-deck',
        statuses: ['failed'],
      }),
    ).toEqual([failed]);
    expect(
      repository.listNewestFirst({
        searchTerm: '',
        statuses: ['failed', 'interrupted'],
      }),
    ).toEqual([failed, interrupted]);
    expect(
      repository.listNewestFirst({ searchTerm: '100%', statuses: [] }),
    ).toEqual([failed]);
  });

  it('persists editable Deck data without modifying source History', () => {
    const { database, databasePath } = createTemporaryDatabase();
    const historyRepository = new SqliteCommandHistoryRepository(database.orm);
    const deckRepository = new SqliteCommandDeckRepository(database.orm);
    const source = historyEntry({
      commandId: 'source-history',
      command: 'npm test',
    });
    historyRepository.insert(source);
    const ids = ['deck-1', 'definition-1'];
    const deckService = new CommandDeckService(
      deckRepository,
      historyRepository,
      () => ids.shift() ?? 'unexpected-id',
      () => 5_000,
    );

    const added = deckService.addHistoryEntry(source.commandId);
    expect(added.outcome).toBe('created');
    expect(deckService.addHistoryEntry(source.commandId).outcome).toBe(
      'exists',
    );

    const updateResult = deckService.updateDeckItem('deck-1', {
      displayName: 'Tests with coverage',
      command: 'npm test -- --coverage',
      description: 'Run before pushing.',
    });
    expect(updateResult.outcome).toBe('updated');
    const updated =
      updateResult.outcome === 'updated' ? updateResult.item : null;
    expect(updated).toMatchObject({
      deckItemId: 'deck-1',
      definitionId: 'definition-1',
      sourceHistoryId: source.commandId,
      displayName: 'Tests with coverage',
      command: 'npm test -- --coverage',
      description: 'Run before pushing.',
    });
    expect(historyRepository.findById(source.commandId)).toEqual(source);

    database.close();
    openDatabases.splice(openDatabases.indexOf(database), 1);
    const reopened = openCommandDeckDatabase(databasePath);
    openDatabases.push(reopened);
    expect(new SqliteCommandDeckRepository(reopened.orm).list()).toEqual([
      updated,
    ]);
  });

  it('rejects malformed templates on Deck creation and editing', () => {
    const { database } = createTemporaryDatabase();
    const historyRepository = new SqliteCommandHistoryRepository(database.orm);
    const deckRepository = new SqliteCommandDeckRepository(database.orm);
    const invalidSource = historyEntry({
      commandId: 'invalid-template-source',
      command: 'git checkout {{ branch }}',
    });
    const validSource = historyEntry({
      commandId: 'valid-template-source',
      command: 'git checkout {{branch}}',
    });
    historyRepository.insert(invalidSource);
    historyRepository.insert(validSource);
    const ids = ['deck-template', 'definition-template'];
    const deckService = new CommandDeckService(
      deckRepository,
      historyRepository,
      () => ids.shift() ?? 'unexpected-id',
      () => 5_000,
    );

    expect(deckService.addHistoryEntry(invalidSource.commandId)).toEqual(
      expect.objectContaining({ outcome: 'invalid-template' }),
    );
    expect(deckService.addHistoryEntry(validSource.commandId).outcome).toBe(
      'created',
    );
    expect(
      deckService.updateDeckItem('deck-template', {
        command: 'git checkout {{branch',
      }),
    ).toEqual(expect.objectContaining({ outcome: 'invalid-template' }));
    expect(deckRepository.findById('deck-template')?.command).toBe(
      validSource.command,
    );
  });

  it('removes Deck-owned rows while retaining source History', () => {
    const { database } = createTemporaryDatabase();
    const historyRepository = new SqliteCommandHistoryRepository(database.orm);
    const deckRepository = new SqliteCommandDeckRepository(database.orm);
    const source = historyEntry({ commandId: 'keep-history' });
    historyRepository.insert(source);
    const deckService = new CommandDeckService(
      deckRepository,
      historyRepository,
      (() => {
        const ids = ['deck-remove', 'definition-remove'];
        return () => ids.shift() ?? 'unexpected-id';
      })(),
      () => 5_000,
    );
    deckService.addHistoryEntry(source.commandId);

    expect(deckService.removeDeckItem('deck-remove')).toBe(true);
    expect(deckRepository.list()).toEqual([]);
    expect(historyRepository.findById(source.commandId)).toEqual(source);
    expect(
      database.sqlite
        .prepare('SELECT count(*) FROM command_definitions')
        .pluck()
        .get(),
    ).toBe(0);
  });
});

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'commanddeck-db-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createTemporaryDatabase(): {
  database: CommandDeckDatabase;
  databasePath: string;
} {
  const directory = createTemporaryDirectory();
  const databasePath = join(directory, 'commanddeck.db');
  const database = openCommandDeckDatabase(databasePath);
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

function historyEntry(
  overrides: Partial<CommandHistoryEntry> = {},
): CommandHistoryEntry {
  return {
    ...completedCommand(overrides),
    createdAt: 1_200,
    ...overrides,
  };
}
