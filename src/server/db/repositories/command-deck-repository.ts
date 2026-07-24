import { and, asc, eq, max } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type {
  CommandDeckItem,
  CommandDeckItemUpdate,
} from '../../../shared/types/deck.js';
import { commandDeckItems, commandDefinitions } from '../schema.js';
import type * as schema from '../schema.js';

export type NewCommandDeckItem = {
  deckItemId: string;
  definitionId: string;
  workspaceId: string;
  sourceHistoryId: string;
  displayName: string;
  command: string;
  createdAt: number;
};

export interface CommandDeckRepository {
  list(workspaceId: string): CommandDeckItem[];
  findById(workspaceId: string, deckItemId: string): CommandDeckItem | null;
  findBySourceHistoryId(
    workspaceId: string,
    historyId: string,
  ): CommandDeckItem | null;
  create(item: NewCommandDeckItem): CommandDeckItem;
  update(
    workspaceId: string,
    deckItemId: string,
    update: CommandDeckItemUpdate,
    updatedAt: number,
  ): CommandDeckItem | null;
  delete(workspaceId: string, deckItemId: string): boolean;
}

const deckItemSelection = {
  deckItemId: commandDeckItems.deckItemId,
  workspaceId: commandDeckItems.workspaceId,
  definitionId: commandDefinitions.definitionId,
  sourceHistoryId: commandDefinitions.sourceHistoryId,
  displayName: commandDeckItems.displayName,
  command: commandDefinitions.command,
  description: commandDeckItems.description,
  position: commandDeckItems.position,
  addedAt: commandDeckItems.addedAt,
  updatedAt: commandDeckItems.updatedAt,
};

export class SqliteCommandDeckRepository implements CommandDeckRepository {
  constructor(
    private readonly database: BetterSQLite3Database<typeof schema>,
  ) {}

  list(workspaceId: string): CommandDeckItem[] {
    return this.database
      .select(deckItemSelection)
      .from(commandDeckItems)
      .innerJoin(
        commandDefinitions,
        eq(commandDeckItems.definitionId, commandDefinitions.definitionId),
      )
      .where(eq(commandDeckItems.workspaceId, workspaceId))
      .orderBy(asc(commandDeckItems.position), asc(commandDeckItems.addedAt))
      .all();
  }

  findById(workspaceId: string, deckItemId: string): CommandDeckItem | null {
    return (
      this.database
        .select(deckItemSelection)
        .from(commandDeckItems)
        .innerJoin(
          commandDefinitions,
          eq(commandDeckItems.definitionId, commandDefinitions.definitionId),
        )
        .where(
          and(
            eq(commandDeckItems.workspaceId, workspaceId),
            eq(commandDeckItems.deckItemId, deckItemId),
          ),
        )
        .get() ?? null
    );
  }

  findBySourceHistoryId(
    workspaceId: string,
    historyId: string,
  ): CommandDeckItem | null {
    return (
      this.database
        .select(deckItemSelection)
        .from(commandDeckItems)
        .innerJoin(
          commandDefinitions,
          eq(commandDeckItems.definitionId, commandDefinitions.definitionId),
        )
        .where(
          and(
            eq(commandDeckItems.workspaceId, workspaceId),
            eq(commandDefinitions.sourceHistoryId, historyId),
          ),
        )
        .get() ?? null
    );
  }

  create(item: NewCommandDeckItem): CommandDeckItem {
    this.database.transaction((transaction) => {
      const currentMaximum = transaction
        .select({ value: max(commandDeckItems.position) })
        .from(commandDeckItems)
        .where(eq(commandDeckItems.workspaceId, item.workspaceId))
        .get()?.value;
      const position = (currentMaximum ?? -1) + 1;

      transaction
        .insert(commandDefinitions)
        .values({
          definitionId: item.definitionId,
          workspaceId: item.workspaceId,
          sourceHistoryId: item.sourceHistoryId,
          command: item.command,
          createdAt: item.createdAt,
          updatedAt: item.createdAt,
        })
        .run();
      transaction
        .insert(commandDeckItems)
        .values({
          deckItemId: item.deckItemId,
          workspaceId: item.workspaceId,
          definitionId: item.definitionId,
          displayName: item.displayName,
          description: null,
          position,
          addedAt: item.createdAt,
          updatedAt: item.createdAt,
        })
        .run();
    });

    const created = this.findById(item.workspaceId, item.deckItemId);

    if (!created) {
      throw new Error('Created Deck item could not be read.');
    }

    return created;
  }

  update(
    workspaceId: string,
    deckItemId: string,
    update: CommandDeckItemUpdate,
    updatedAt: number,
  ): CommandDeckItem | null {
    const existing = this.findById(workspaceId, deckItemId);

    if (!existing) {
      return null;
    }

    this.database.transaction((transaction) => {
      if (update.command !== undefined) {
        transaction
          .update(commandDefinitions)
          .set({ command: update.command, updatedAt })
          .where(eq(commandDefinitions.definitionId, existing.definitionId))
          .run();
      }

      transaction
        .update(commandDeckItems)
        .set({
          ...(update.displayName !== undefined
            ? { displayName: update.displayName }
            : {}),
          ...(update.description !== undefined
            ? { description: update.description }
            : {}),
          updatedAt,
        })
        .where(
          and(
            eq(commandDeckItems.workspaceId, workspaceId),
            eq(commandDeckItems.deckItemId, deckItemId),
          ),
        )
        .run();
    });

    return this.findById(workspaceId, deckItemId);
  }

  delete(workspaceId: string, deckItemId: string): boolean {
    const existing = this.findById(workspaceId, deckItemId);

    if (!existing) {
      return false;
    }

    this.database.transaction((transaction) => {
      transaction
        .delete(commandDeckItems)
        .where(
          and(
            eq(commandDeckItems.workspaceId, workspaceId),
            eq(commandDeckItems.deckItemId, deckItemId),
          ),
        )
        .run();
      transaction
        .delete(commandDefinitions)
        .where(eq(commandDefinitions.definitionId, existing.definitionId))
        .run();
    });

    return true;
  }
}
