export const DEFAULT_WORKSPACE_ID = 'default-workspace';
export const DEFAULT_WORKSPACE_NAME = 'Default Workspace';

export type Workspace = {
  workspaceId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type WorkspaceSummary = Workspace & {
  historyCount: number;
  deckCount: number;
};
