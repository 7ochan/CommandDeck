import { z } from 'zod';

import type { CommandCard } from '../types/command';

export const commandCompletionReasonSchema = z.enum(['shell', 'session-exit']);

export const commandCardSchema: z.ZodType<CommandCard> = z
  .object({
    commandId: z.string().min(1),
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

export const commandCardsResponseSchema = z.object({
  cards: z.array(commandCardSchema),
});
