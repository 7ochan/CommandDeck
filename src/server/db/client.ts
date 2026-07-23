import { mkdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import {
  drizzle,
  type BetterSQLite3Database,
} from 'drizzle-orm/better-sqlite3';

import { runMigrations } from './migrations/index.js';
import * as schema from './schema.js';

const DATABASE_FILENAME = 'commanddeck.db';

export type CommandDeckDatabase = {
  orm: BetterSQLite3Database<typeof schema>;
  sqlite: Database.Database;
  path: string;
  close: () => void;
};

export function openCommandDeckDatabase(
  databasePath = resolveDatabasePath(),
): CommandDeckDatabase {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const sqlite = new Database(databasePath, { timeout: 5_000 });

  try {
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');
    runMigrations(sqlite);

    return {
      orm: drizzle({ client: sqlite, schema }),
      sqlite,
      path: databasePath,
      close: () => {
        if (sqlite.open) {
          sqlite.close();
        }
      },
    };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

export function resolveDatabasePath(): string {
  const configuredDirectory = process.env.COMMANDDECK_DATA_DIR;

  if (configuredDirectory) {
    const directory = isAbsolute(configuredDirectory)
      ? configuredDirectory
      : resolve(configuredDirectory);
    return join(directory, DATABASE_FILENAME);
  }

  return join(defaultDataDirectory(), DATABASE_FILENAME);
}

function defaultDataDirectory(): string {
  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'CommandDeck');
  }

  if (platform() === 'win32') {
    return join(
      process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
      'CommandDeck',
    );
  }

  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'),
    'commanddeck',
  );
}
