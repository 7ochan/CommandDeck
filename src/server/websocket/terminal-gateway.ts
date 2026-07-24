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

type WorkspaceAccess = {
  workspaceExists: (workspaceId: string) => boolean;
  initialWorkspaceId: () => string;
};

const defaultWorkspaceAccess: WorkspaceAccess = {
  workspaceExists: (workspaceId) => workspaceId === DEFAULT_WORKSPACE_ID,
  initialWorkspaceId: () => DEFAULT_WORKSPACE_ID,
};

export class TerminalGateway {
  private readonly connections = new ConnectionRegistry();

  constructor(
    private readonly sessions = new TerminalSessionManager(),
    private readonly workspaceAccess: WorkspaceAccess = defaultWorkspaceAccess,
  ) {}

  handleConnection(socket: WebSocket, requestedWorkspaceId?: string): void {
    let cleanedUp = false;
    let activeBinding: {
      session: ReturnType<TerminalSessionManager['create']>;
      flushOutput: () => void;
      dispose: () => void;
    } | null = null;

    const send = (message: TerminalServerMessage) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serializeTerminalMessage(message));
      }
    };

    const attachSession = (workspaceId: string) => {
      const session = this.sessions.create(workspaceId);
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

      return binding;
    };

    const detachActiveSession = (flushOutput: boolean) => {
      const binding = activeBinding;

      if (!binding) {
        return;
      }

      activeBinding = null;

      if (flushOutput) {
        binding.flushOutput();
      }

      binding.dispose();
      this.connections.deleteBySocket(socket);
      this.sessions.close(binding.session.id);
    };

    const startWorkspaceSession = (workspaceId: string): boolean => {
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

      const previousSessionId = activeBinding?.session.id;
      detachActiveSession(true);

      try {
        attachSession(workspaceId);
        return true;
      } catch (error) {
        console.error('Unable to create terminal session:', error);

        if (previousSessionId) {
          send({
            version: TERMINAL_PROTOCOL_VERSION,
            type: 'terminal.error',
            sessionId: previousSessionId,
            payload: { message: 'Unable to create terminal session.' },
          });
        }

        socket.close(1011, 'Unable to create terminal session');
        return false;
      }
    };

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      detachActiveSession(false);
    };

    const initialWorkspaceId = requestedWorkspaceId
      ? requestedWorkspaceId
      : this.workspaceAccess.initialWorkspaceId();

    if (!startWorkspaceSession(initialWorkspaceId)) {
      socket.close(1008, 'Workspace not found');
      return;
    }

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
          send({
            version: TERMINAL_PROTOCOL_VERSION,
            type: 'terminal.workspace.selected',
            sessionId: session.id,
            payload: { workspaceId: session.workspaceId },
          });
          return;
        }

        startWorkspaceSession(message.payload.workspaceId);
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
    this.sessions.closeAll();
    this.connections.closeAll();
  }
}
