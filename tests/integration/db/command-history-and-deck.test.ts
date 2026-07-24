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
import { createCommandHistoryAndDeckMigration } from '../../../src/server/db/migrations/0002-command-history-and-deck.js';
import { SqliteCommandDeckRepository } from '../../../src/server/db/repositories/command-deck-repository.js';
import { SqliteCommandHistoryRepository } from '../../../src/server/db/repositories/command-history-repository.js';
import { SqliteWorkspaceRepository } from '../../../src/server/db/repositories/workspace-repository.js';
import { SqliteWorkspaceTerminalStateRepository } from '../../../src/server/db/repositories/workspace-terminal-state-repository.js';
import { WorkspaceService } from '../../../src/server/workspaces/workspace-service.js';
import { WorkspaceTerminalStateService } from '../../../src/server/workspace-terminal-state/workspace-terminal-state-service.js';
import type {
  CommandCompletedPayload,
  CommandHistoryEntry,
} from '../../../src/shared/types/command.js';
import { DEFAULT_WORKSPACE_ID } from '../../../src/shared/types/workspace.js';

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
    ).toEqual([
      'command_cards',
      'command_history_and_deck',
      'workspaces',
      'workspace_terminal_state',
    ]);
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
        'workspaces',
        'workspace_terminal_state',
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
        DEFAULT_WORKSPACE_ID,
        entry.commandId,
      ),
    ).toEqual(entry);
  });

  it('moves existing History and Deck records into Default Workspace', () => {
    const directory = createTemporaryDirectory();
    const databasePath = join(directory, 'history-and-deck.db');
    const legacy = new Database(databasePath);
    legacy.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL
      );
      ${createLegacyCommandHistoryMigration.sql}
      ${createCommandHistoryAndDeckMigration.sql}
      INSERT INTO schema_migrations (id, name, applied_at)
      VALUES
        (1, 'command_cards', 1),
        (2, 'command_history_and_deck', 2);
      INSERT INTO command_history (
        command_id, command, cwd, exit_code, started_at, ended_at,
        duration_ms, completion_reason, created_at
      ) VALUES (
        'existing-history', 'npm test', '/tmp/project', 0, 10, 20,
        10, 'shell', 30
      );
      INSERT INTO command_definitions (
        definition_id, source_history_id, command, created_at, updated_at
      ) VALUES (
        'existing-definition', 'existing-history', 'npm test', 40, 40
      );
      INSERT INTO command_deck_items (
        deck_item_id, definition_id, display_name, description,
        position, added_at, updated_at
      ) VALUES (
        'existing-deck', 'existing-definition', 'Tests', NULL, 0, 40, 40
      );
    `);
    legacy.close();

    const migrated = openCommandDeckDatabase(databasePath);
    openDatabases.push(migrated);
    const historyRepository = new SqliteCommandHistoryRepository(migrated.orm);
    const deckRepository = new SqliteCommandDeckRepository(migrated.orm);

    expect(
      historyRepository.findById(DEFAULT_WORKSPACE_ID, 'existing-history'),
    ).toEqual(
      expect.objectContaining({
        commandId: 'existing-history',
        workspaceId: DEFAULT_WORKSPACE_ID,
      }),
    );
    expect(deckRepository.list(DEFAULT_WORKSPACE_ID)).toEqual([
      expect.objectContaining({
        deckItemId: 'existing-deck',
        workspaceId: DEFAULT_WORKSPACE_ID,
        sourceHistoryId: 'existing-history',
      }),
    ]);
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

    expect(historyService.listHistory(DEFAULT_WORKSPACE_ID)).toEqual([
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
      repository.listNewestFirst(DEFAULT_WORKSPACE_ID, {
        searchTerm: 'BUILD',
        statuses: [],
      }),
    ).toEqual([success]);
    expect(
      repository.listNewestFirst(DEFAULT_WORKSPACE_ID, {
        searchTerm: 'command-deck',
        statuses: ['failed'],
      }),
    ).toEqual([failed]);
    expect(
      repository.listNewestFirst(DEFAULT_WORKSPACE_ID, {
        searchTerm: '',
        statuses: ['failed', 'interrupted'],
      }),
    ).toEqual([failed, interrupted]);
    expect(
      repository.listNewestFirst(DEFAULT_WORKSPACE_ID, {
        searchTerm: '100%',
        statuses: [],
      }),
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

    const added = deckService.addHistoryEntry(
      DEFAULT_WORKSPACE_ID,
      source.commandId,
    );
    expect(added.outcome).toBe('created');
    expect(
      deckService.addHistoryEntry(DEFAULT_WORKSPACE_ID, source.commandId)
        .outcome,
    ).toBe('exists');

    const updateResult = deckService.updateDeckItem(
      DEFAULT_WORKSPACE_ID,
      'deck-1',
      {
        displayName: 'Tests with coverage',
        command: 'npm test -- --coverage',
        description: 'Run before pushing.',
      },
    );
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
    expect(
      historyRepository.findById(DEFAULT_WORKSPACE_ID, source.commandId),
    ).toEqual(source);

    database.close();
    openDatabases.splice(openDatabases.indexOf(database), 1);
    const reopened = openCommandDeckDatabase(databasePath);
    openDatabases.push(reopened);
    expect(
      new SqliteCommandDeckRepository(reopened.orm).list(DEFAULT_WORKSPACE_ID),
    ).toEqual([updated]);
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

    expect(
      deckService.addHistoryEntry(
        DEFAULT_WORKSPACE_ID,
        invalidSource.commandId,
      ),
    ).toEqual(expect.objectContaining({ outcome: 'invalid-template' }));
    expect(
      deckService.addHistoryEntry(DEFAULT_WORKSPACE_ID, validSource.commandId)
        .outcome,
    ).toBe('created');
    expect(
      deckService.updateDeckItem(DEFAULT_WORKSPACE_ID, 'deck-template', {
        command: 'git checkout {{branch',
      }),
    ).toEqual(expect.objectContaining({ outcome: 'invalid-template' }));
    expect(
      deckRepository.findById(DEFAULT_WORKSPACE_ID, 'deck-template')?.command,
    ).toBe(validSource.command);
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
    deckService.addHistoryEntry(DEFAULT_WORKSPACE_ID, source.commandId);

    expect(
      deckService.removeDeckItem(DEFAULT_WORKSPACE_ID, 'deck-remove'),
    ).toBe(true);
    expect(deckRepository.list(DEFAULT_WORKSPACE_ID)).toEqual([]);
    expect(
      historyRepository.findById(DEFAULT_WORKSPACE_ID, source.commandId),
    ).toEqual(source);
    expect(
      database.sqlite
        .prepare('SELECT count(*) FROM command_definitions')
        .pluck()
        .get(),
    ).toBe(0);
  });

  it('isolates History and Deck data while Workspaces persist and manage safely', () => {
    const { database, databasePath } = createTemporaryDatabase();
    const workspaceRepository = new SqliteWorkspaceRepository(database.orm);
    const workspaceService = new WorkspaceService(
      workspaceRepository,
      () => 'workspace-two',
      () => 10_000,
    );
    const historyRepository = new SqliteCommandHistoryRepository(database.orm);
    const deckRepository = new SqliteCommandDeckRepository(database.orm);
    const deckIds = ['deck-two', 'definition-two'];
    const deckService = new CommandDeckService(
      deckRepository,
      historyRepository,
      () => deckIds.shift() ?? 'unexpected-id',
      () => 11_000,
    );

    expect(workspaceService.listWorkspaces()).toEqual([
      expect.objectContaining({
        workspaceId: DEFAULT_WORKSPACE_ID,
        name: 'Default Workspace',
        historyCount: 0,
        deckCount: 0,
      }),
    ]);
    expect(workspaceService.createWorkspace('Services')).toEqual(
      expect.objectContaining({
        outcome: 'created',
        workspace: expect.objectContaining({ workspaceId: 'workspace-two' }),
      }),
    );

    const workspaceEntry = historyEntry({
      commandId: 'workspace-two-command',
      workspaceId: 'workspace-two',
      command: 'npm run services',
    });
    historyRepository.insert(workspaceEntry);

    expect(historyRepository.listNewestFirst(DEFAULT_WORKSPACE_ID)).toEqual([]);
    expect(historyRepository.listNewestFirst('workspace-two')).toEqual([
      workspaceEntry,
    ]);
    expect(
      deckService.addHistoryEntry(
        DEFAULT_WORKSPACE_ID,
        workspaceEntry.commandId,
      ).outcome,
    ).toBe('history-not-found');
    expect(
      deckService.addHistoryEntry('workspace-two', workspaceEntry.commandId)
        .outcome,
    ).toBe('created');
    expect(deckRepository.list(DEFAULT_WORKSPACE_ID)).toEqual([]);
    expect(deckRepository.list('workspace-two')).toHaveLength(1);
    expect(workspaceService.listWorkspaces()).toEqual([
      expect.objectContaining({
        workspaceId: DEFAULT_WORKSPACE_ID,
        historyCount: 0,
        deckCount: 0,
      }),
      expect.objectContaining({
        workspaceId: 'workspace-two',
        historyCount: 1,
        deckCount: 1,
      }),
    ]);

    expect(
      workspaceService.renameWorkspace('workspace-two', 'Backend Services'),
    ).toEqual(
      expect.objectContaining({
        outcome: 'renamed',
        workspace: expect.objectContaining({ name: 'Backend Services' }),
      }),
    );

    database.close();
    openDatabases.splice(openDatabases.indexOf(database), 1);
    const reopened = openCommandDeckDatabase(databasePath);
    openDatabases.push(reopened);
    const reopenedWorkspaceService = new WorkspaceService(
      new SqliteWorkspaceRepository(reopened.orm),
    );

    expect(reopenedWorkspaceService.listWorkspaces()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workspaceId: 'workspace-two',
          name: 'Backend Services',
          historyCount: 1,
          deckCount: 1,
        }),
      ]),
    );
    expect(
      reopenedWorkspaceService.deleteWorkspace(DEFAULT_WORKSPACE_ID),
    ).toEqual({ outcome: 'deleted' });
    expect(reopenedWorkspaceService.deleteWorkspace('workspace-two')).toEqual({
      outcome: 'final-workspace',
    });
  });

  it('persists independent Workspace terminal state without rewriting unchanged cwd values', () => {
    const { database, databasePath } = createTemporaryDatabase();
    const workspaceRepository = new SqliteWorkspaceRepository(database.orm);
    const workspaceService = new WorkspaceService(
      workspaceRepository,
      () => 'workspace-two',
      () => 50,
    );
    workspaceService.createWorkspace('Services');
    const terminalStateRepository = new SqliteWorkspaceTerminalStateRepository(
      database.orm,
    );
    const timestamps = [100, 200, 300];
    const terminalStateService = new WorkspaceTerminalStateService(
      terminalStateRepository,
      () => timestamps.shift() ?? 999,
    );

    expect(
      terminalStateService.updateState(DEFAULT_WORKSPACE_ID, {
        cwd: '/tmp/default-project',
      }),
    ).toBe(true);
    expect(
      terminalStateService.updateState(DEFAULT_WORKSPACE_ID, {
        cwd: '/tmp/default-project',
      }),
    ).toBe(false);
    expect(
      terminalStateRepository.findByWorkspaceId(DEFAULT_WORKSPACE_ID),
    ).toEqual({
      workspaceId: DEFAULT_WORKSPACE_ID,
      cwd: '/tmp/default-project',
      updatedAt: 100,
    });
    expect(
      terminalStateService.updateState('workspace-two', {
        cwd: '/tmp/services-project',
      }),
    ).toBe(true);
    expect(
      terminalStateService.getLaunchConfiguration(DEFAULT_WORKSPACE_ID),
    ).toEqual({ cwd: '/tmp/default-project' });
    expect(
      terminalStateService.getLaunchConfiguration('workspace-two'),
    ).toEqual({ cwd: '/tmp/services-project' });

    database.close();
    openDatabases.splice(openDatabases.indexOf(database), 1);
    const reopened = openCommandDeckDatabase(databasePath);
    openDatabases.push(reopened);
    const reopenedRepository = new SqliteWorkspaceTerminalStateRepository(
      reopened.orm,
    );

    expect(reopenedRepository.findByWorkspaceId('workspace-two')).toEqual({
      workspaceId: 'workspace-two',
      cwd: '/tmp/services-project',
      updatedAt: 300,
    });
    new WorkspaceService(
      new SqliteWorkspaceRepository(reopened.orm),
    ).deleteWorkspace('workspace-two');
    expect(reopenedRepository.findByWorkspaceId('workspace-two')).toBeNull();
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
    workspaceId: DEFAULT_WORKSPACE_ID,
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
