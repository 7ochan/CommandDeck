import { desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { CommandCard } from '../../../shared/types/command.js';
import { commandCards } from '../schema.js';
import type * as schema from '../schema.js';

export interface CommandCardRepository {
  insert(card: CommandCard): boolean;
  listNewestFirst(): CommandCard[];
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

  listNewestFirst(): CommandCard[] {
    return this.database
      .select()
      .from(commandCards)
      .orderBy(
        desc(commandCards.endedAt),
        desc(commandCards.createdAt),
        desc(commandCards.startedAt),
      )
      .all();
  }
}
