import { desc } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const commandCards = sqliteTable(
  'command_cards',
  {
    commandId: text('command_id').primaryKey().notNull(),
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
    index('command_cards_newest_first_idx').on(
      desc(table.endedAt),
      desc(table.createdAt),
      desc(table.startedAt),
    ),
  ],
);
