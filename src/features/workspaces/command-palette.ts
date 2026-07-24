'use client';

import { useMemo } from 'react';

import { useRegisterCommandPaletteActions } from '@/features/command-palette/command-palette-provider';
import type { CommandPaletteAction } from '@/features/command-palette/types';
import type { WorkspaceSummary } from '@/shared/types';

type WorkspacePaletteRegistration = {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  onSelect: (workspaceId: string) => void;
};

export function useRegisterWorkspacePaletteActions({
  workspaces,
  activeWorkspaceId,
  onSelect,
}: WorkspacePaletteRegistration): void {
  const actions = useMemo<CommandPaletteAction[]>(
    () =>
      workspaces.map((workspace) => {
        const isActive = workspace.workspaceId === activeWorkspaceId;

        return {
          id: workspace.workspaceId,
          label: `${isActive ? 'Open' : 'Switch'} Workspace: ${workspace.name}`,
          description: isActive
            ? 'Currently active Workspace'
            : `${workspace.historyCount} History · ${workspace.deckCount} Deck`,
          group: 'Workspaces',
          icon: '//',
          tone: 'violet',
          keywords: [workspace.name, 'open workspace', 'switch workspace'],
          priority: isActive ? 85 : 80,
          execute: () => onSelect(workspace.workspaceId),
        };
      }),
    [activeWorkspaceId, onSelect, workspaces],
  );

  useRegisterCommandPaletteActions('workspaces', actions);
}
