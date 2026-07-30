'use client';

import { useMemo, useState } from 'react';

import { useRegisterCommandPaletteActions } from '@/features/command-palette/command-palette-provider';
import type { CommandPaletteAction } from '@/features/command-palette/types';
import { parseCommandTemplate } from '@/shared/command-template';

import type { CommandDeckItem } from '../types.ts';
import { ExecuteCommandTemplateDialog } from './execute-command-template-dialog.tsx';

type CommandDeckPaletteSourceProps = {
  items: CommandDeckItem[];
  onRun: (command: string) => boolean;
};

export function CommandDeckPaletteSource({
  items,
  onRun,
}: CommandDeckPaletteSourceProps) {
  const [selectedTemplate, setSelectedTemplate] =
    useState<CommandDeckItem | null>(null);
  const indexedItems = useMemo(
    () =>
      items.map((item) => ({
        item,
        parsed: parseCommandTemplate(item.command),
      })),
    [items],
  );
  const actions = useMemo<CommandPaletteAction[]>(
    () =>
      indexedItems.map(({ item, parsed }) => {
        const isTemplate = parsed.placeholders.length > 0;

        return {
          id: item.deckItemId,
          label: item.displayName,
          description: item.command,
          group: isTemplate ? 'Templates' : 'Deck',
          icon: isTemplate ? '{}' : '▶',
          tone: 'cyan',
          keywords: [
            item.displayName,
            item.command,
            item.description ?? '',
            ...(isTemplate
              ? ['command template', 'command templates', 'variables']
              : ['command deck', 'run deck item']),
            ...parsed.placeholders.flatMap(({ name, label, token }) => [
              name,
              label,
              token,
            ]),
          ],
          priority: isTemplate ? 65 : 70,
          disabled: !parsed.isValid,
          execute: () => {
            if (!parsed.isValid) {
              return;
            }

            if (isTemplate) {
              setSelectedTemplate(item);
            } else {
              onRun(item.command);
            }
          },
        };
      }),
    [indexedItems, onRun],
  );

  useRegisterCommandPaletteActions('command-deck', actions);

  return selectedTemplate ? (
    <ExecuteCommandTemplateDialog
      displayName={selectedTemplate.displayName}
      template={selectedTemplate.command}
      isOpen
      onCancel={() => setSelectedTemplate(null)}
      onExecute={onRun}
    />
  ) : null;
}
