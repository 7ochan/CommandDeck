import { and, desc, eq, ne, or, sql, type SQL } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type {
  CommandHistoryEntry,
  CommandHistoryQuery,
  CommandHistoryStatus,
} from '../../../shared/types/command.js';
import { commandHistory } from '../schema.js';
import type * as schema from '../schema.js';

export interface CommandHistoryRepository {
  insert(entry: CommandHistoryEntry): boolean;
  listNewestFirst(query?: CommandHistoryQuery): CommandHistoryEntry[];
  findById(commandId: string): CommandHistoryEntry | null;
}

export class SqliteCommandHistoryRepository implements CommandHistoryRepository {
  constructor(
    private readonly database: BetterSQLite3Database<typeof schema>,
  ) {}

  insert(entry: CommandHistoryEntry): boolean {
    const result = this.database
      .insert(commandHistory)
      .values(entry)
      .onConflictDoNothing({ target: commandHistory.commandId })
      .run();

    return result.changes === 1;
  }

  listNewestFirst(query?: CommandHistoryQuery): CommandHistoryEntry[] {
    const conditions = query ? buildQueryConditions(query) : [];
    const selection = this.database.select().from(commandHistory);
    const filteredSelection =
      conditions.length > 0 ? selection.where(and(...conditions)) : selection;

    return filteredSelection
      .orderBy(
        desc(commandHistory.endedAt),
        desc(commandHistory.createdAt),
        desc(commandHistory.startedAt),
      )
      .all();
  }

  findById(commandId: string): CommandHistoryEntry | null {
    return (
      this.database
        .select()
        .from(commandHistory)
        .where(eq(commandHistory.commandId, commandId))
        .get() ?? null
    );
  }
}

function buildQueryConditions(query: CommandHistoryQuery): SQL[] {
  const conditions: SQL[] = [];
  const searchTerm = query.searchTerm.trim();

  if (searchTerm) {
    conditions.push(sql`(
      instr(lower(${commandHistory.command}), lower(${searchTerm})) > 0
      OR instr(lower(${commandHistory.cwd}), lower(${searchTerm})) > 0
    )`);
  }

  const statuses = [...new Set(query.statuses)];

  if (statuses.length > 0 && statuses.length < 3) {
    conditions.push(or(...statuses.map(buildStatusCondition))!);
  }

  return conditions;
}

function buildStatusCondition(status: CommandHistoryStatus): SQL {
  if (status === 'interrupted') {
    return or(
      eq(commandHistory.completionReason, 'session-exit'),
      eq(commandHistory.exitCode, 130),
    )!;
  }

  if (status === 'success') {
    return and(
      eq(commandHistory.completionReason, 'shell'),
      eq(commandHistory.exitCode, 0),
    )!;
  }

  return and(
    eq(commandHistory.completionReason, 'shell'),
    ne(commandHistory.exitCode, 0),
    ne(commandHistory.exitCode, 130),
  )!;
}
