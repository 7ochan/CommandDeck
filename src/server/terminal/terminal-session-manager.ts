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
  /** All live sessions by session ID. */
  private readonly sessions = new Map<string, TerminalSession>();

  /**
   * Maps workspace ID → session ID so each workspace owns exactly one
   * persistent PTY that survives workspace switches.
   */
  private readonly workspaceSessions = new Map<string, string>();

  constructor(
    private readonly ptyAdapter = new PtyAdapter(),
    private readonly commandEvents?: CommandEventBus,
    private readonly initialWorkspaceId = DEFAULT_WORKSPACE_ID,
    private readonly workspaceTerminalState = emptyWorkspaceTerminalState,
  ) {}

  /**
   * Returns the existing session for this workspace if one is alive,
   * otherwise spawns a new PTY and registers it.
   */
  getOrCreateForWorkspace(workspaceId = this.initialWorkspaceId): TerminalSession {
    const existingId = this.workspaceSessions.get(workspaceId);

    if (existingId) {
      const existing = this.sessions.get(existingId);
      if (existing) {
        return existing;
      }
    }

    return this.spawnForWorkspace(workspaceId);
  }

  get(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  /** Returns the live session for a workspace, or undefined if none exists. */
  getForWorkspace(workspaceId: string): TerminalSession | undefined {
    const sessionId = this.workspaceSessions.get(workspaceId);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  close(id: string): void {
    const session = this.sessions.get(id);

    if (!session) {
      return;
    }

    // Remove workspace mapping if it still points to this session.
    if (this.workspaceSessions.get(session.workspaceId) === id) {
      this.workspaceSessions.delete(session.workspaceId);
    }

    this.sessions.delete(id);
    session.close();
  }

  closeAll(): void {
    const activeSessions = [...this.sessions.values()];
    this.sessions.clear();
    this.workspaceSessions.clear();

    for (const session of activeSessions) {
      session.close();
    }
  }

  private spawnForWorkspace(workspaceId: string): TerminalSession {
    const id = randomUUID();
    const session = new TerminalSession(
      id,
      this.ptyAdapter.spawnDefaultShell(
        this.workspaceTerminalState.getLaunchConfiguration(workspaceId),
      ),
      workspaceId,
    );

    this.sessions.set(id, session);
    this.workspaceSessions.set(workspaceId, id);

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
      if (this.workspaceSessions.get(workspaceId) === id) {
        this.workspaceSessions.delete(workspaceId);
      }
      this.sessions.delete(id);
    });

    return session;
  }
}
