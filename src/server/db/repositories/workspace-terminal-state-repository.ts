import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { workspaceTerminalState } from '../schema.js';
import type * as schema from '../schema.js';

export type WorkspaceTerminalState = {
  workspaceId: string;
  cwd: string;
  updatedAt: number;
};

export type WorkspaceTerminalStateUpdate = {
  cwd?: string;
};

export type WorkspaceTerminalStateUpdateResult = {
  changed: boolean;
  state: WorkspaceTerminalState | null;
};

export interface WorkspaceTerminalStateRepository {
  findByWorkspaceId(workspaceId: string): WorkspaceTerminalState | null;
  update(
    workspaceId: string,
    update: WorkspaceTerminalStateUpdate,
    updatedAt: number,
  ): WorkspaceTerminalStateUpdateResult;
}

export class SqliteWorkspaceTerminalStateRepository implements WorkspaceTerminalStateRepository {
  constructor(
    private readonly database: BetterSQLite3Database<typeof schema>,
  ) {}

  findByWorkspaceId(workspaceId: string): WorkspaceTerminalState | null {
    return (
      this.database
        .select()
        .from(workspaceTerminalState)
        .where(eq(workspaceTerminalState.workspaceId, workspaceId))
        .get() ?? null
    );
  }

  update(
    workspaceId: string,
    update: WorkspaceTerminalStateUpdate,
    updatedAt: number,
  ): WorkspaceTerminalStateUpdateResult {
    const current = this.findByWorkspaceId(workspaceId);

    if (update.cwd === undefined || update.cwd === current?.cwd) {
      return { changed: false, state: current };
    }

    const state: WorkspaceTerminalState = {
      workspaceId,
      cwd: update.cwd,
      updatedAt,
    };

    if (current) {
      this.database
        .update(workspaceTerminalState)
        .set({ cwd: state.cwd, updatedAt: state.updatedAt })
        .where(eq(workspaceTerminalState.workspaceId, workspaceId))
        .run();
    } else {
      this.database.insert(workspaceTerminalState).values(state).run();
    }

    return { changed: true, state };
  }
}
