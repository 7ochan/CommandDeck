import { and, desc, eq, ne, or, sql, type SQL } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type {
  CommandCard,
  CommandCardQuery,
  CommandCardStatus,
} from '../../../shared/types/command.js';
import { commandCards } from '../schema.js';
import type * as schema from '../schema.js';

export interface CommandCardRepository {
  insert(card: CommandCard): boolean;
  listNewestFirst(query?: CommandCardQuery): CommandCard[];
  deleteById(commandId: string): boolean;
}

export class SqliteCommandCardRepository implements CommandCardRepository {
  constructor(
    private readonly database: BetterSQLite3Database<typeof schema>,
  ) {}

  insert(card: CommandCard): boolean {
    const result = this.database
      .insert(commandCards)
      .values(card)
      .onConflictDoNothing({ target: commandCards.commandId })
      .run();

    return result.changes === 1;
  }

  listNewestFirst(query?: CommandCardQuery): CommandCard[] {
    const conditions = query ? buildQueryConditions(query) : [];
    const selection = this.database.select().from(commandCards);
    const filteredSelection =
      conditions.length > 0 ? selection.where(and(...conditions)) : selection;

    return filteredSelection
      .orderBy(
        desc(commandCards.endedAt),
        desc(commandCards.createdAt),
        desc(commandCards.startedAt),
      )
      .all();
  }

  deleteById(commandId: string): boolean {
    const result = this.database
      .delete(commandCards)
      .where(eq(commandCards.commandId, commandId))
      .run();

    return result.changes === 1;
  }
}

function buildQueryConditions(query: CommandCardQuery): SQL[] {
  const conditions: SQL[] = [];
  const searchTerm = query.searchTerm.trim();

  if (searchTerm) {
    conditions.push(sql`(
      instr(lower(${commandCards.command}), lower(${searchTerm})) > 0
      OR instr(lower(${commandCards.cwd}), lower(${searchTerm})) > 0
    )`);
  }

  const statuses = [...new Set(query.statuses)];

  if (statuses.length > 0 && statuses.length < 3) {
    conditions.push(or(...statuses.map(buildStatusCondition))!);
  }

  return conditions;
}

function buildStatusCondition(status: CommandCardStatus): SQL {
  if (status === 'interrupted') {
    return or(
      eq(commandCards.completionReason, 'session-exit'),
      eq(commandCards.exitCode, 130),
    )!;
  }

  if (status === 'success') {
    return and(
      eq(commandCards.completionReason, 'shell'),
      eq(commandCards.exitCode, 0),
    )!;
  }

  return and(
    eq(commandCards.completionReason, 'shell'),
    ne(commandCards.exitCode, 0),
    ne(commandCards.exitCode, 130),
  )!;
}
