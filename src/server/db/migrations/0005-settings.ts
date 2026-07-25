export const createSettingsMigration = {
  id: 5,
  name: 'settings',
  sql: `
    CREATE TABLE settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL CHECK (updated_at >= 0)
    );
  `,
} as const;
