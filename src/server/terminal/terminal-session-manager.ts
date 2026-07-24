import { randomUUID } from 'node:crypto';

import type { CommandEventBus } from '../commands/command-events.js';
import { PtyAdapter } from './pty-adapter.js';
import { TerminalSession } from './terminal-session.js';
import { DEFAULT_WORKSPACE_ID } from '../../shared/types/workspace.js';
import type { WorkspaceTerminalStateService } from '../workspace-terminal-state/workspace-terminal-state-service.js';

type WorkspaceTerminalStateAccess = Pick<
  WorkspaceTerminalStateService,
  'getLaunchConfiguration' | 'updateState'
>;

const emptyWorkspaceTerminalState: WorkspaceTerminalStateAccess = {
  getLaunchConfiguration: () => ({}),
  updateState: () => false,
};

export class TerminalSessionManager {
  private readonly sessions = new Map<string, TerminalSession>();

  constructor(
    private readonly ptyAdapter = new PtyAdapter(),
    private readonly commandEvents?: CommandEventBus,
    private readonly initialWorkspaceId = DEFAULT_WORKSPACE_ID,
    private readonly workspaceTerminalState = emptyWorkspaceTerminalState,
  ) {}

  create(workspaceId = this.initialWorkspaceId): TerminalSession {
    const id = randomUUID();
    const session = new TerminalSession(
      id,
      this.ptyAdapter.spawnDefaultShell(
        this.workspaceTerminalState.getLaunchConfiguration(workspaceId),
      ),
      workspaceId,
    );

    this.sessions.set(id, session);
    const stopPublishingCommands = this.commandEvents
      ? session.onCommand((event) => this.commandEvents?.publish(event))
      : () => undefined;
    const stopPersistingCwd = session.onCwd((event) => {
      this.workspaceTerminalState.updateState(event.workspaceId, {
        cwd: event.cwd,
      });
    });
    session.onExit(() => {
      stopPublishingCommands();
      stopPersistingCwd();
      this.sessions.delete(id);
    });

    return session;
  }

  get(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  close(id: string): void {
    const session = this.sessions.get(id);

    if (!session) {
      return;
    }

    this.sessions.delete(id);
    session.close();
  }

  closeAll(): void {
    const activeSessions = [...this.sessions.values()];
    this.sessions.clear();

    for (const session of activeSessions) {
      session.close();
    }
  }
}
