import { randomUUID } from 'node:crypto';

import type {
  Workspace,
  WorkspaceSummary,
} from '../../shared/types/workspace.js';
import type { WorkspaceRepository } from '../db/repositories/workspace-repository.js';

export type CreateWorkspaceResult =
  | { outcome: 'created'; workspace: WorkspaceSummary }
  | { outcome: 'name-exists' };

export type RenameWorkspaceResult =
  | { outcome: 'renamed'; workspace: WorkspaceSummary }
  | { outcome: 'name-exists' }
  | { outcome: 'not-found' };

export type DeleteWorkspaceResult =
  | { outcome: 'deleted' }
  | { outcome: 'final-workspace' }
  | { outcome: 'not-found' };

export class WorkspaceService {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly createId: () => string = randomUUID,
    private readonly clock: () => number = Date.now,
  ) {}

  listWorkspaces(): WorkspaceSummary[] {
    return this.repository.listSummaries();
  }

  initialWorkspaceId(): string {
    const workspace = this.repository.listSummaries()[0];

    if (!workspace) {
      throw new Error('At least one Workspace is required.');
    }

    return workspace.workspaceId;
  }

  workspaceExists(workspaceId: string): boolean {
    return this.repository.findById(workspaceId) !== null;
  }

  createWorkspace(name: string): CreateWorkspaceResult {
    if (this.repository.findByName(name)) {
      return { outcome: 'name-exists' };
    }

    const now = this.clock();
    const workspace: Workspace = {
      workspaceId: this.createId(),
      name,
      createdAt: now,
      updatedAt: now,
    };

    return {
      outcome: 'created',
      workspace: this.repository.insert(workspace),
    };
  }

  renameWorkspace(workspaceId: string, name: string): RenameWorkspaceResult {
    const namedWorkspace = this.repository.findByName(name);

    if (namedWorkspace && namedWorkspace.workspaceId !== workspaceId) {
      return { outcome: 'name-exists' };
    }

    const workspace = this.repository.rename(workspaceId, name, this.clock());
    return workspace
      ? { outcome: 'renamed', workspace }
      : { outcome: 'not-found' };
  }

  deleteWorkspace(workspaceId: string): DeleteWorkspaceResult {
    if (!this.repository.findById(workspaceId)) {
      return { outcome: 'not-found' };
    }

    if (this.repository.count() <= 1) {
      return { outcome: 'final-workspace' };
    }

    return this.repository.delete(workspaceId)
      ? { outcome: 'deleted' }
      : { outcome: 'not-found' };
  }
}
