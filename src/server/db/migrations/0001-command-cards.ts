export const createLegacyCommandHistoryMigration = {
  id: 1,
  name: 'command_cards',
  sql: `
    CREATE TABLE command_cards (
      command_id TEXT PRIMARY KEY NOT NULL,
      command TEXT NOT NULL,
      cwd TEXT NOT NULL,
      exit_code INTEGER NOT NULL,
      started_at INTEGER NOT NULL CHECK (started_at >= 0),
      ended_at INTEGER NOT NULL CHECK (ended_at >= started_at),
      duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
      completion_reason TEXT NOT NULL CHECK (
        completion_reason IN ('shell', 'session-exit')
      ),
      created_at INTEGER NOT NULL CHECK (created_at >= 0)
    );

    CREATE INDEX command_cards_newest_first_idx
      ON command_cards (ended_at DESC, created_at DESC, started_at DESC);
  `,
} as const;
