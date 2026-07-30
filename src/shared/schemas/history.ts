import { z } from 'zod';

import type { CommandHistoryEntry } from '../types/command.ts';
import { workspaceIdSchema } from './workspace.ts';

export const commandCompletionReasonSchema = z.enum(['shell', 'session-exit']);

export const commandHistoryEntrySchema: z.ZodType<CommandHistoryEntry> = z
  .object({
    commandId: z.string().min(1),
    workspaceId: workspaceIdSchema,
    command: z.string().min(1),
    cwd: z.string(),
    exitCode: z.number().int(),
    startedAt: z.number().int().nonnegative(),
    endedAt: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    completionReason: commandCompletionReasonSchema,
    createdAt: z.number().int().nonnegative(),
  })
  .refine(({ endedAt, startedAt }) => endedAt >= startedAt, {
    message: 'Command end time cannot precede its start time.',
    path: ['endedAt'],
  });

export const commandHistoryResponseSchema = z.object({
  entries: z.array(commandHistoryEntrySchema),
  visibleCount: z.number().int().nonnegative(),
});

export const commandHistoryStatusSchema = z.enum([
  'success',
  'failed',
  'interrupted',
]);

export const commandHistoryQuerySchema = z.object({
  searchTerm: z.string().trim().max(200).default(''),
  statuses: z.array(commandHistoryStatusSchema).max(3).default([]),
});
