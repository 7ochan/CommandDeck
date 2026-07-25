import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { settings } from '../schema.js';
import type * as schema from '../schema.js';

export type StoredSetting = {
  key: string;
  value: string;
  updatedAt: number;
};

export interface SettingsRepository {
  findAll(): StoredSetting[];
  upsert(entries: StoredSetting[]): void;
}

export class SqliteSettingsRepository implements SettingsRepository {
  constructor(
    private readonly database: BetterSQLite3Database<typeof schema>,
  ) {}

  findAll(): StoredSetting[] {
    return this.database.select().from(settings).all();
  }

  upsert(entries: StoredSetting[]): void {
    this.database.transaction((transaction) => {
      for (const entry of entries) {
        transaction
          .insert(settings)
          .values(entry)
          .onConflictDoUpdate({
            target: settings.key,
            set: { value: entry.value, updatedAt: entry.updatedAt },
          })
          .run();
      }
    });
  }
}
