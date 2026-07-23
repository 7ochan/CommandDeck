import WebSocket, { type RawData } from 'ws';

import {
  TERMINAL_PROTOCOL_VERSION,
  parseTerminalClientMessage,
  serializeTerminalMessage,
  type TerminalServerMessage,
} from '../../shared/contracts/terminal.js';
import { TerminalSessionManager } from '../terminal/terminal-session-manager.js';
import { ConnectionRegistry } from './connection-registry.js';

const OUTPUT_FLUSH_INTERVAL_MS = 8;
const OUTPUT_FLUSH_THRESHOLD = 64 * 1024;

export class TerminalGateway {
  private readonly connections = new ConnectionRegistry();

  constructor(private readonly sessions = new TerminalSessionManager()) {}

  handleConnection(socket: WebSocket): void {
    let session;

    try {
      session = this.sessions.create();
    } catch (error) {
      console.error('Unable to create terminal session:', error);
      socket.close(1011, 'Unable to create terminal session');
      return;
    }

    const { id: sessionId } = session;
    let cleanedUp = false;
    let outputBuffer = '';
    let flushTimer: NodeJS.Timeout | null = null;

    const send = (message: TerminalServerMessage) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serializeTerminalMessage(message));
      }
    };

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
      flushOutput();
      send({
        version: TERMINAL_PROTOCOL_VERSION,
        type: 'terminal.exited',
        sessionId,
        payload: { exitCode, signal: signal ?? null },
      });
      socket.close(1000, 'Shell exited');
    });

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      removeDataListener();
      removeCommandListener();
      removeExitListener();

      if (flushTimer) {
        clearTimeout(flushTimer);
      }

      this.connections.deleteBySocket(socket);
      this.sessions.close(sessionId);
    };

    this.connections.add(sessionId, socket);

    socket.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        socket.close(1003, 'Binary messages are unsupported');
        return;
      }

      const message = parseTerminalClientMessage(data.toString());

      if (!message || message.sessionId !== sessionId) {
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

      if (message.type === 'terminal.resize') {
        session.resize(message.payload.cols, message.payload.rows);
        send({
          version: TERMINAL_PROTOCOL_VERSION,
          type: 'terminal.resized',
          sessionId,
          payload: message.payload,
        });
        return;
      }

      socket.close(1000, 'Terminal closed by client');
    });

    socket.once('close', cleanup);
    socket.once('error', cleanup);

    send({
      version: TERMINAL_PROTOCOL_VERSION,
      type: 'terminal.started',
      sessionId,
      payload: {
        shell: session.shell,
        cwd: session.cwd,
        cols: session.cols,
        rows: session.rows,
      },
    });
  }

  closeAll(): void {
    this.sessions.closeAll();
    this.connections.closeAll();
  }
}
