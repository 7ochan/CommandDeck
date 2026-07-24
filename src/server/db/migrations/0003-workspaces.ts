export const createWorkspacesMigration = {
  id: 3,
  name: 'workspaces',
  sql: `
    CREATE TABLE workspaces (
      workspace_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
        CHECK (length(trim(name)) BETWEEN 1 AND 80),
      created_at INTEGER NOT NULL CHECK (created_at >= 0),
      updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
    );

    INSERT INTO workspaces (workspace_id, name, created_at, updated_at)
    VALUES ('default-workspace', 'Default Workspace', 0, 0);

    ALTER TABLE command_deck_items
      RENAME TO command_deck_items_before_workspaces;
    ALTER TABLE command_definitions
      RENAME TO command_definitions_before_workspaces;
    ALTER TABLE command_history
      RENAME TO command_history_before_workspaces;

    DROP INDEX command_deck_items_position_idx;
    DROP INDEX command_definitions_source_history_idx;
    DROP INDEX command_history_newest_first_idx;

    CREATE TABLE command_history (
      command_id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL,
      command TEXT NOT NULL,
      cwd TEXT NOT NULL,
      exit_code INTEGER NOT NULL,
      started_at INTEGER NOT NULL CHECK (started_at >= 0),
      ended_at INTEGER NOT NULL CHECK (ended_at >= started_at),
      duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
      completion_reason TEXT NOT NULL CHECK (
        completion_reason IN ('shell', 'session-exit')
      ),
      created_at INTEGER NOT NULL CHECK (created_at >= 0),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id)
        ON DELETE CASCADE
    );

    CREATE INDEX command_history_newest_first_idx
      ON command_history (
        workspace_id, ended_at DESC, created_at DESC, started_at DESC
      );

    CREATE TABLE command_definitions (
      definition_id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL,
      source_history_id TEXT,
      command TEXT NOT NULL CHECK (length(trim(command)) > 0),
      created_at INTEGER NOT NULL CHECK (created_at >= 0),
      updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id)
        ON DELETE CASCADE,
      FOREIGN KEY (source_history_id) REFERENCES command_history(command_id)
        ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX command_definitions_source_history_idx
      ON command_definitions (source_history_id)
      WHERE source_history_id IS NOT NULL;

    CREATE INDEX command_definitions_workspace_idx
      ON command_definitions (workspace_id);

    CREATE TABLE command_deck_items (
      deck_item_id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL,
      definition_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
      description TEXT,
      position INTEGER NOT NULL CHECK (position >= 0),
      added_at INTEGER NOT NULL CHECK (added_at >= 0),
      updated_at INTEGER NOT NULL CHECK (updated_at >= added_at),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id)
        ON DELETE CASCADE,
      FOREIGN KEY (definition_id) REFERENCES command_definitions(definition_id)
        ON DELETE CASCADE
    );

    CREATE INDEX command_deck_items_position_idx
      ON command_deck_items (
        workspace_id, position ASC, added_at ASC
      );

    INSERT INTO command_history (
      command_id, workspace_id, command, cwd, exit_code, started_at,
      ended_at, duration_ms, completion_reason, created_at
    )
    SELECT
      command_id, 'default-workspace', command, cwd, exit_code, started_at,
      ended_at, duration_ms, completion_reason, created_at
    FROM command_history_before_workspaces;

    INSERT INTO command_definitions (
      definition_id, workspace_id, source_history_id, command,
      created_at, updated_at
    )
    SELECT
      definition_id, 'default-workspace', source_history_id, command,
      created_at, updated_at
    FROM command_definitions_before_workspaces;

    INSERT INTO command_deck_items (
      deck_item_id, workspace_id, definition_id, display_name,
      description, position, added_at, updated_at
    )
    SELECT
      deck_item_id, 'default-workspace', definition_id, display_name,
      description, position, added_at, updated_at
    FROM command_deck_items_before_workspaces;

    DROP TABLE command_deck_items_before_workspaces;
    DROP TABLE command_definitions_before_workspaces;
    DROP TABLE command_history_before_workspaces;
  `,
} as const;
