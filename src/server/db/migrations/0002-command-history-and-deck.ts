export const createCommandHistoryAndDeckMigration = {
  id: 2,
  name: 'command_history_and_deck',
  sql: `
    ALTER TABLE command_cards RENAME TO command_history;

    DROP INDEX command_cards_newest_first_idx;

    CREATE INDEX command_history_newest_first_idx
      ON command_history (ended_at DESC, created_at DESC, started_at DESC);

    CREATE TABLE command_definitions (
      definition_id TEXT PRIMARY KEY NOT NULL,
      source_history_id TEXT,
      command TEXT NOT NULL CHECK (length(trim(command)) > 0),
      created_at INTEGER NOT NULL CHECK (created_at >= 0),
      updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
      FOREIGN KEY (source_history_id) REFERENCES command_history(command_id)
        ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX command_definitions_source_history_idx
      ON command_definitions (source_history_id)
      WHERE source_history_id IS NOT NULL;

    CREATE TABLE command_deck_items (
      deck_item_id TEXT PRIMARY KEY NOT NULL,
      definition_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
      description TEXT,
      position INTEGER NOT NULL CHECK (position >= 0),
      added_at INTEGER NOT NULL CHECK (added_at >= 0),
      updated_at INTEGER NOT NULL CHECK (updated_at >= added_at),
      FOREIGN KEY (definition_id) REFERENCES command_definitions(definition_id)
        ON DELETE CASCADE
    );

    CREATE INDEX command_deck_items_position_idx
      ON command_deck_items (position ASC, added_at ASC);
  `,
} as const;
