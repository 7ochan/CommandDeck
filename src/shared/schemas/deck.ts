import { z } from 'zod';

import { validateCommandTemplate } from '../command-template/index.ts';
import type { CommandDeckItem } from '../types/deck';
import { workspaceIdSchema } from './workspace';

export const commandDeckItemSchema: z.ZodType<CommandDeckItem> = z.object({
  deckItemId: z.string().min(1),
  workspaceId: workspaceIdSchema,
  definitionId: z.string().min(1),
  sourceHistoryId: z.string().min(1).nullable(),
  displayName: z.string().min(1),
  command: z.string().min(1),
  description: z.string().nullable(),
  position: z.number().int().nonnegative(),
  addedAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const commandDeckResponseSchema = z.object({
  items: z.array(commandDeckItemSchema),
});

export const addCommandDeckItemSchema = z.object({
  workspaceId: workspaceIdSchema,
  historyId: z.string().min(1).max(200).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  command: z.string().min(1).max(10_000).optional(),
  description: z.string().trim().max(1_000).nullable().optional(),
}).refine(
  (data) => Boolean(data.historyId) || Boolean(data.command && data.command.trim().length > 0),
  { message: 'Either historyId or command is required.' },
);

const nonBlankCommandSchema = z
  .string()
  .min(1)
  .max(10_000)
  .refine((value) => value.trim().length > 0, 'Command cannot be blank.')
  .superRefine((value, context) => {
    for (const error of validateCommandTemplate(value).errors) {
      context.addIssue({ code: 'custom', message: error.message });
    }
  });

export const updateCommandDeckItemSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    command: nonBlankCommandSchema.optional(),
    description: z.string().trim().max(1_000).nullable().optional(),
  })
  .refine((update) => Object.keys(update).length > 0, {
    message: 'At least one Deck item field is required.',
  });
