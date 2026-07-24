import { desc } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable(
  'workspaces',
  {
    workspaceId: text('workspace_id').primaryKey().notNull(),
    name: text('name').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('workspaces_name_idx').on(table.name)],
);

export const workspaceTerminalState = sqliteTable('workspace_terminal_state', {
  workspaceId: text('workspace_id')
    .primaryKey()
    .notNull()
    .references(() => workspaces.workspaceId, { onDelete: 'cascade' }),
  cwd: text('cwd').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const commandHistory = sqliteTable(
  'command_history',
  {
    commandId: text('command_id').primaryKey().notNull(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.workspaceId, { onDelete: 'cascade' }),
    command: text('command').notNull(),
    cwd: text('cwd').notNull(),
    exitCode: integer('exit_code').notNull(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at').notNull(),
    durationMs: integer('duration_ms').notNull(),
    completionReason: text('completion_reason', {
      enum: ['shell', 'session-exit'],
    }).notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('command_history_newest_first_idx').on(
      table.workspaceId,
      desc(table.endedAt),
      desc(table.createdAt),
      desc(table.startedAt),
    ),
  ],
);

export const commandDefinitions = sqliteTable(
  'command_definitions',
  {
    definitionId: text('definition_id').primaryKey().notNull(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.workspaceId, { onDelete: 'cascade' }),
    sourceHistoryId: text('source_history_id').references(
      () => commandHistory.commandId,
      { onDelete: 'set null' },
    ),
    command: text('command').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('command_definitions_workspace_idx').on(table.workspaceId),
    uniqueIndex('command_definitions_source_history_idx').on(
      table.sourceHistoryId,
    ),
  ],
);

export const commandDeckItems = sqliteTable(
  'command_deck_items',
  {
    deckItemId: text('deck_item_id').primaryKey().notNull(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.workspaceId, { onDelete: 'cascade' }),
    definitionId: text('definition_id')
      .notNull()
      .references(() => commandDefinitions.definitionId, {
        onDelete: 'cascade',
      }),
    displayName: text('display_name').notNull(),
    description: text('description'),
    position: integer('position').notNull(),
    addedAt: integer('added_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('command_deck_items_definition_idx').on(table.definitionId),
    index('command_deck_items_position_idx').on(
      table.workspaceId,
      table.position,
      table.addedAt,
    ),
  ],
);
