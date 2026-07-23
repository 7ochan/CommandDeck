import { randomUUID } from 'node:crypto';

import { PtyAdapter } from './pty-adapter.js';
import { TerminalSession } from './terminal-session.js';

export class TerminalSessionManager {
  private readonly sessions = new Map<string, TerminalSession>();

  constructor(private readonly ptyAdapter = new PtyAdapter()) {}

  create(): TerminalSession {
    const id = randomUUID();
    const session = new TerminalSession(
      id,
      this.ptyAdapter.spawnDefaultShell(),
    );

    this.sessions.set(id, session);
    session.onExit(() => this.sessions.delete(id));

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
