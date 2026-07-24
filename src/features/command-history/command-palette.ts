'use client';

import { useMemo } from 'react';

import { useRegisterCommandPaletteActions } from '@/features/command-palette/command-palette-provider';
import type { CommandPaletteAction } from '@/features/command-palette/types';

import type { CommandHistoryEntry } from './types';

type HistoryPaletteRegistration = {
  entries: CommandHistoryEntry[];
  onOpen: (commandId: string) => void;
};

export function useRegisterHistoryPaletteActions({
  entries,
  onOpen,
}: HistoryPaletteRegistration): void {
  const actions = useMemo<CommandPaletteAction[]>(
    () =>
      entries.map((entry) => ({
        id: entry.commandId,
        label: entry.command,
        description: entry.cwd,
        group: 'History',
        icon: '↺',
        tone: 'green',
        keywords: ['command history', entry.cwd],
        priority: 30,
        execute: () => onOpen(entry.commandId),
      })),
    [entries, onOpen],
  );

  useRegisterCommandPaletteActions('command-history', actions);
}
