import type Database from 'better-sqlite3';

import { createLegacyCommandHistoryMigration } from './0001-command-cards.js';
import { createCommandHistoryAndDeckMigration } from './0002-command-history-and-deck.js';
import { createWorkspacesMigration } from './0003-workspaces.js';
import { createWorkspaceTerminalStateMigration } from './0004-workspace-terminal-state.js';

const migrations = [
  createLegacyCommandHistoryMigration,
  createCommandHistoryAndDeckMigration,
  createWorkspacesMigration,
  createWorkspaceTerminalStateMigration,
] as const;

export function runMigrations(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    );
  `);

  const hasMigration = sqlite
    .prepare('SELECT 1 FROM schema_migrations WHERE id = ?')
    .pluck();
  const recordMigration = sqlite.prepare(`
    INSERT INTO schema_migrations (id, name, applied_at)
    VALUES (?, ?, ?)
  `);

  const applyPendingMigrations = sqlite.transaction(() => {
    for (const migration of migrations) {
      if (hasMigration.get(migration.id) === 1) {
        continue;
      }

      sqlite.exec(migration.sql);
      recordMigration.run(migration.id, migration.name, Date.now());
    }
  });

  applyPendingMigrations();
}
