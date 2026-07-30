import type { WorkspaceSummary } from '../types/workspace.ts';

export type WorkspacesResponse = {
  workspaces: WorkspaceSummary[];
};

export type CreateWorkspaceRequest = {
  name: string;
};

export type RenameWorkspaceRequest = {
  name: string;
};
