import type {
  WorkspaceTerminalStateRepository,
  WorkspaceTerminalStateUpdate,
} from '../db/repositories/workspace-terminal-state-repository.js';

export type WorkspaceTerminalLaunchConfiguration = {
  cwd?: string;
};

export class WorkspaceTerminalStateService {
  constructor(
    private readonly repository: WorkspaceTerminalStateRepository,
    private readonly clock: () => number = Date.now,
  ) {}

  getLaunchConfiguration(
    workspaceId: string,
  ): WorkspaceTerminalLaunchConfiguration {
    const state = this.repository.findByWorkspaceId(workspaceId);
    return state ? { cwd: state.cwd } : {};
  }

  updateState(
    workspaceId: string,
    update: WorkspaceTerminalStateUpdate,
  ): boolean {
    if (update.cwd !== undefined && update.cwd.length === 0) {
      return false;
    }

    return this.repository.update(workspaceId, update, this.clock()).changed;
  }
}
