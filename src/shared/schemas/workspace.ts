import { z } from 'zod';

import type { WorkspaceSummary } from '../types/workspace.ts';

export const workspaceIdSchema = z.string().min(1).max(200);
export const workspaceNameSchema = z.string().trim().min(1).max(80);

export const workspaceSummarySchema: z.ZodType<WorkspaceSummary> = z.object({
  workspaceId: workspaceIdSchema,
  name: workspaceNameSchema,
  historyCount: z.number().int().nonnegative(),
  deckCount: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const workspacesResponseSchema = z.object({
  workspaces: z.array(workspaceSummarySchema).min(1),
});

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
});

export const renameWorkspaceSchema = z.object({
  name: workspaceNameSchema,
});
