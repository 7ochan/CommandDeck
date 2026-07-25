import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  openCommandDeckDatabase,
  type CommandDeckDatabase,
} from '../../../src/server/db/client.js';
import { SqliteSettingsRepository } from '../../../src/server/db/repositories/settings-repository.js';
import { SettingsService } from '../../../src/server/settings/settings-service.js';

const databases: CommandDeckDatabase[] = [];
const directories: string[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Settings persistence', () => {
  it('stores typed leaf settings and durable UI context across restarts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'commanddeck-settings-'));
    directories.push(directory);
    const databasePath = join(directory, 'commanddeck.db');
    let database = openDatabase(databasePath);
    const settings = new SettingsService(
      new SqliteSettingsRepository(database.orm),
      () => 100,
    );

    expect(settings.getSnapshot()).toEqual(
      expect.objectContaining({
        settings: expect.objectContaining({
          appearance: { theme: 'dark' },
          terminal: expect.objectContaining({ fontSize: 14 }),
        }),
      }),
    );

    settings.update(
      {
        appearance: { theme: 'light' },
        terminal: {
          fontSize: 18,
          cursorStyle: 'underline',
          scrollbackSize: 20_000,
        },
        developerHub: { rememberLastSelectedTab: true },
      },
      {
        lastWorkspaceId: 'workspace-one',
        lastDeveloperHubTab: 'history',
      },
    );

    database.close();
    databases.splice(databases.indexOf(database), 1);
    database = openDatabase(databasePath);
    const restored = new SettingsService(
      new SqliteSettingsRepository(database.orm),
    ).getSnapshot();

    expect(restored).toMatchObject({
      settings: {
        appearance: { theme: 'light' },
        terminal: {
          fontSize: 18,
          cursorStyle: 'underline',
          cursorBlink: true,
          scrollbackSize: 20_000,
        },
        developerHub: { rememberLastSelectedTab: true },
      },
      state: {
        lastWorkspaceId: 'workspace-one',
        lastDeveloperHubTab: 'history',
      },
    });
    expect(
      database.sqlite.prepare('SELECT count(*) FROM settings').pluck().get(),
    ).toBe(7);
  });

  it('falls back per field when a stored value is corrupt', () => {
    const directory = mkdtempSync(join(tmpdir(), 'commanddeck-settings-'));
    directories.push(directory);
    const database = openDatabase(join(directory, 'commanddeck.db'));
    database.sqlite
      .prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
      .run('terminal.fontSize', '"huge"', 1);

    const snapshot = new SettingsService(
      new SqliteSettingsRepository(database.orm),
    ).getSnapshot();

    expect(snapshot.settings.terminal.fontSize).toBe(14);
  });
});

function openDatabase(path: string): CommandDeckDatabase {
  const database = openCommandDeckDatabase(path);
  databases.push(database);
  return database;
}
