import { asc, count, eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type {
  Workspace,
  WorkspaceSummary,
} from '../../../shared/types/workspace.js';
import { commandDeckItems, commandHistory, workspaces } from '../schema.js';
import type * as schema from '../schema.js';

export interface WorkspaceRepository {
  listSummaries(): WorkspaceSummary[];
  findById(workspaceId: string): Workspace | null;
  findByName(name: string): Workspace | null;
  insert(workspace: Workspace): WorkspaceSummary;
  rename(
    workspaceId: string,
    name: string,
    updatedAt: number,
  ): WorkspaceSummary | null;
  count(): number;
  delete(workspaceId: string): boolean;
}

export class SqliteWorkspaceRepository implements WorkspaceRepository {
  constructor(
    private readonly database: BetterSQLite3Database<typeof schema>,
  ) {}

  listSummaries(): WorkspaceSummary[] {
    const workspaceRows = this.database
      .select()
      .from(workspaces)
      .orderBy(asc(workspaces.createdAt), asc(workspaces.name))
      .all();
    const historyCounts = new Map(
      this.database
        .select({
          workspaceId: commandHistory.workspaceId,
          value: count(),
        })
        .from(commandHistory)
        .groupBy(commandHistory.workspaceId)
        .all()
        .map(({ value, workspaceId }) => [workspaceId, value]),
    );
    const deckCounts = new Map(
      this.database
        .select({
          workspaceId: commandDeckItems.workspaceId,
          value: count(),
        })
        .from(commandDeckItems)
        .groupBy(commandDeckItems.workspaceId)
        .all()
        .map(({ value, workspaceId }) => [workspaceId, value]),
    );

    return workspaceRows.map((workspace) => ({
      ...workspace,
      historyCount: historyCounts.get(workspace.workspaceId) ?? 0,
      deckCount: deckCounts.get(workspace.workspaceId) ?? 0,
    }));
  }

  findById(workspaceId: string): Workspace | null {
    return (
      this.database
        .select()
        .from(workspaces)
        .where(eq(workspaces.workspaceId, workspaceId))
        .get() ?? null
    );
  }

  findByName(name: string): Workspace | null {
    return (
      this.database
        .select()
        .from(workspaces)
        .where(sql`lower(${workspaces.name}) = lower(${name})`)
        .get() ?? null
    );
  }

  insert(workspace: Workspace): WorkspaceSummary {
    this.database.insert(workspaces).values(workspace).run();
    return { ...workspace, historyCount: 0, deckCount: 0 };
  }

  rename(
    workspaceId: string,
    name: string,
    updatedAt: number,
  ): WorkspaceSummary | null {
    const result = this.database
      .update(workspaces)
      .set({ name, updatedAt })
      .where(eq(workspaces.workspaceId, workspaceId))
      .run();

    if (result.changes !== 1) {
      return null;
    }

    return (
      this.listSummaries().find(
        (workspace) => workspace.workspaceId === workspaceId,
      ) ?? null
    );
  }

  count(): number {
    return (
      this.database
        .select({ count: sql<number>`count(*)` })
        .from(workspaces)
        .get()?.count ?? 0
    );
  }

  delete(workspaceId: string): boolean {
    const result = this.database
      .delete(workspaces)
      .where(eq(workspaces.workspaceId, workspaceId))
      .run();
    return result.changes === 1;
  }
}
