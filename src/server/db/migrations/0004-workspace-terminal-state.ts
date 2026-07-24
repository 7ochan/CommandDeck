export const createWorkspaceTerminalStateMigration = {
  id: 4,
  name: 'workspace_terminal_state',
  sql: `
    CREATE TABLE workspace_terminal_state (
      workspace_id TEXT PRIMARY KEY NOT NULL,
      cwd TEXT NOT NULL CHECK (length(cwd) > 0),
      updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id)
        ON DELETE CASCADE
    );
  `,
} as const;
