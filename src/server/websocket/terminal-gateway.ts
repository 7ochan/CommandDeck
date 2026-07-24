import WebSocket, { type RawData } from 'ws';

import {
  TERMINAL_PROTOCOL_VERSION,
  parseTerminalClientMessage,
  serializeTerminalMessage,
  type TerminalServerMessage,
} from '../../shared/contracts/terminal.js';
import { DEFAULT_WORKSPACE_ID } from '../../shared/types/workspace.js';
import { TerminalSessionManager } from '../terminal/terminal-session-manager.js';
import { ConnectionRegistry } from './connection-registry.js';

const OUTPUT_FLUSH_INTERVAL_MS = 8;
const OUTPUT_FLUSH_THRESHOLD = 64 * 1024;

/**
 * Maximum bytes buffered for a detached workspace session (1 MiB).
 * The tail is kept when the limit is exceeded so the most recent terminal
 * state is always available on reattachment.
 */
const DETACHED_OUTPUT_BUFFER_LIMIT = 1024 * 1024;

type WorkspaceAccess = {
  workspaceExists: (workspaceId: string) => boolean;
  initialWorkspaceId: () => string;
};

const defaultWorkspaceAccess: WorkspaceAccess = {
  workspaceExists: (workspaceId) => workspaceId === DEFAULT_WORKSPACE_ID,
  initialWorkspaceId: () => DEFAULT_WORKSPACE_ID,
};

/**
 * Output accumulated for a session while no socket is attached to it.
 * Keyed by session ID.
 */
type DetachedBuffer = {
  output: string;
  removeDataListener: () => void;
};

export class TerminalGateway {
  private readonly connections = new ConnectionRegistry();

  /** Output accumulated per session while it has no attached socket. */
  private readonly detachedBuffers = new Map<string, DetachedBuffer>();

  /**
   * Session IDs that have been fully started (PTY spawned and first
   * `terminal.started` already sent to at least one client). Used to
   * distinguish "brand-new session → reset xterm" from "reattachment →
   * replay only".
   */
  private readonly startedSessionIds = new Set<string>();

  constructor(
    private readonly sessions = new TerminalSessionManager(),
    private readonly workspaceAccess: WorkspaceAccess = defaultWorkspaceAccess,
  ) {}

  handleConnection(socket: WebSocket, requestedWorkspaceId?: string): void {
    let cleanedUp = false;

    let activeBinding: {
      session: ReturnType<TerminalSessionManager['getOrCreateForWorkspace']>;
      flushOutput: () => void;
      dispose: () => void;
    } | null = null;

    const send = (message: TerminalServerMessage) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serializeTerminalMessage(message));
      }
    };

    // ─── Attach socket to a session ───────────────────────────────────────────

    const attachToSession = (
      session: ReturnType<TerminalSessionManager['getOrCreateForWorkspace']>,
    ) => {
      const { id: sessionId } = session;
      let outputBuffer = '';
      let flushTimer: NodeJS.Timeout | null = null;

      const flushOutput = () => {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }

        if (outputBuffer.length === 0) {
          return;
        }

        const data = outputBuffer;
        outputBuffer = '';
        send({
          version: TERMINAL_PROTOCOL_VERSION,
          type: 'terminal.output',
          sessionId,
          payload: { data },
        });
      };

      const queueOutput = (data: string) => {
        outputBuffer += data;

        if (outputBuffer.length >= OUTPUT_FLUSH_THRESHOLD) {
          flushOutput();
          return;
        }

        flushTimer ??= setTimeout(flushOutput, OUTPUT_FLUSH_INTERVAL_MS);
      };

      const removeDataListener = session.onData(queueOutput);

      const removeCommandListener = session.onCommand((event) => {
        flushOutput();

        if (event.type === 'command.started') {
          send({
            version: TERMINAL_PROTOCOL_VERSION,
            type: 'command.started',
            sessionId,
            payload: event.payload,
          });
        } else {
          send({
            version: TERMINAL_PROTOCOL_VERSION,
            type: 'command.completed',
            sessionId,
            payload: event.payload,
          });
        }
      });

      const removeExitListener = session.onExit(({ exitCode, signal }) => {
        if (activeBinding?.session.id !== sessionId) {
          return;
        }

        flushOutput();
        send({
          version: TERMINAL_PROTOCOL_VERSION,
          type: 'terminal.exited',
          sessionId,
          payload: { exitCode, signal: signal ?? null },
        });
        socket.close(1000, 'Shell exited');
      });

      const binding = {
        session,
        flushOutput,
        dispose: () => {
          removeDataListener();
          removeCommandListener();
          removeExitListener();

          if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
          }
        },
      };

      activeBinding = binding;
      this.connections.add(sessionId, socket);

      // Drain the detached buffer accumulated while this session had no socket.
      const detachedBuffer = this.detachedBuffers.get(sessionId);
      const bufferedOutput = detachedBuffer?.output ?? '';

      if (detachedBuffer) {
        detachedBuffer.removeDataListener();
        this.detachedBuffers.delete(sessionId);
      }

      const isFirstStart = !this.startedSessionIds.has(sessionId);
      this.startedSessionIds.add(sessionId);

      if (isFirstStart) {
        // Brand-new PTY: tell the client to reset xterm and begin a fresh session.
        send({
          version: TERMINAL_PROTOCOL_VERSION,
          type: 'terminal.started',
          sessionId,
          payload: {
            shell: session.shell,
            cwd: session.cwd,
            cols: session.cols,
            rows: session.rows,
            workspaceId: session.workspaceId,
          },
        });
      } else {
        // Existing PTY reattached: keep xterm state, replay buffered output.
        send({
          version: TERMINAL_PROTOCOL_VERSION,
          type: 'terminal.workspace.selected',
          sessionId,
          payload: {
            workspaceId: session.workspaceId,
            sessionId,
            bufferedOutput,
          },
        });
      }

      return binding;
    };

    // ─── Detach socket from current session (PTY keeps running) ──────────────

    const detachActiveSession = (flushBeforeDetach: boolean) => {
      const binding = activeBinding;

      if (!binding) {
        return;
      }

      activeBinding = null;

      if (flushBeforeDetach) {
        binding.flushOutput();
      }

      binding.dispose();
      this.connections.deleteBySocket(socket);

      // Start buffering output for this session while it runs unattached.
      const { session } = binding;
      const sessionId = session.id;

      const bufferWhileDetached = (data: string) => {
        const entry = this.detachedBuffers.get(sessionId);

        if (!entry) {
          return;
        }

        entry.output += data;

        if (entry.output.length > DETACHED_OUTPUT_BUFFER_LIMIT) {
          entry.output = entry.output.slice(
            entry.output.length - DETACHED_OUTPUT_BUFFER_LIMIT,
          );
        }
      };

      const removeDataListener = session.onData(bufferWhileDetached);
      this.detachedBuffers.set(sessionId, { output: '', removeDataListener });
    };

    // ─── Switch to a different workspace ─────────────────────────────────────

    const switchWorkspaceSession = (workspaceId: string): boolean => {
      if (!this.workspaceAccess.workspaceExists(workspaceId)) {
        const sessionId = activeBinding?.session.id;

        if (sessionId) {
          send({
            version: TERMINAL_PROTOCOL_VERSION,
            type: 'terminal.error',
            sessionId,
            payload: { message: 'Workspace not found.' },
          });
        }

        return false;
      }

      detachActiveSession(true);

      try {
        const session = this.sessions.getOrCreateForWorkspace(workspaceId);
        attachToSession(session);
        return true;
      } catch (error) {
        console.error('Unable to attach terminal session:', error);

        socket.close(1011, 'Unable to create terminal session');
        return false;
      }
    };

    // ─── Full cleanup on socket close ─────────────────────────────────────────

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      // Detach listeners only; PTYs keep running for future reattachment.
      detachActiveSession(false);
    };

    // ─── Initial attachment ───────────────────────────────────────────────────

    const initialWorkspaceId = requestedWorkspaceId
      ? requestedWorkspaceId
      : this.workspaceAccess.initialWorkspaceId();

    if (!this.workspaceAccess.workspaceExists(initialWorkspaceId)) {
      socket.close(1008, 'Workspace not found');
      return;
    }

    try {
      const session = this.sessions.getOrCreateForWorkspace(initialWorkspaceId);
      attachToSession(session);
    } catch (error) {
      console.error('Unable to create initial terminal session:', error);
      socket.close(1011, 'Unable to create terminal session');
      return;
    }

    // ─── Incoming message handling ────────────────────────────────────────────

    socket.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        socket.close(1003, 'Binary messages are unsupported');
        return;
      }

      const message = parseTerminalClientMessage(data.toString());
      const session = activeBinding?.session;

      if (!message || !session || message.sessionId !== session.id) {
        socket.close(1008, 'Invalid terminal message');
        return;
      }

      if (message.type === 'terminal.input') {
        session.write(message.payload.data);
        return;
      }

      if (message.type === 'terminal.execute') {
        session.execute(message.payload.command);
        return;
      }

      if (message.type === 'terminal.workspace.select') {
        if (message.payload.workspaceId === session.workspaceId) {
          // Already on this workspace — confirm without doing anything.
          send({
            version: TERMINAL_PROTOCOL_VERSION,
            type: 'terminal.workspace.selected',
            sessionId: session.id,
            payload: {
              workspaceId: session.workspaceId,
              sessionId: session.id,
              bufferedOutput: '',
            },
          });
          return;
        }

        switchWorkspaceSession(message.payload.workspaceId);
        return;
      }

      if (message.type === 'terminal.workspace.close') {
        // Terminate the PTY for a workspace that is being deleted.
        // The session being closed must NOT be the currently active one
        // (the client should switch away first).
        const targetWorkspaceId = message.payload.workspaceId;

        if (targetWorkspaceId !== session.workspaceId) {
          const closedSession = this.sessions.getForWorkspace(targetWorkspaceId);

          if (closedSession) {
            const detachedBuf = this.detachedBuffers.get(closedSession.id);

            if (detachedBuf) {
              detachedBuf.removeDataListener();
              this.detachedBuffers.delete(closedSession.id);
            }

            this.startedSessionIds.delete(closedSession.id);
            this.sessions.close(closedSession.id);
          }
        }

        return;
      }

      if (message.type === 'terminal.resize') {
        session.resize(message.payload.cols, message.payload.rows);
        send({
          version: TERMINAL_PROTOCOL_VERSION,
          type: 'terminal.resized',
          sessionId: session.id,
          payload: message.payload,
        });
        return;
      }

      socket.close(1000, 'Terminal closed by client');
    });

    socket.once('close', cleanup);
    socket.once('error', cleanup);
  }

  closeAll(): void {
    for (const buffer of this.detachedBuffers.values()) {
      buffer.removeDataListener();
    }

    this.detachedBuffers.clear();
    this.startedSessionIds.clear();
    this.sessions.closeAll();
    this.connections.closeAll();
  }
}
