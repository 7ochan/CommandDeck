import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';

import { TERMINAL_WEBSOCKET_PATH } from '../../shared/contracts/terminal.js';
import { TerminalGateway } from './terminal-gateway.js';

export const TERMINAL_SESSION_COOKIE = 'commanddeck_terminal';

type TerminalWebSocketServerOptions = {
  httpServer: HttpServer;
  sessionToken: string;
  gateway?: TerminalGateway;
};

export class TerminalWebSocketServer {
  private readonly webSocketServer = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 128 * 1024,
  });
  private readonly gateway: TerminalGateway;
  private readonly upgradeHandler: (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => void;

  constructor(private readonly options: TerminalWebSocketServerOptions) {
    this.gateway = options.gateway ?? new TerminalGateway();
    this.upgradeHandler = (request, socket, head) => {
      const requestUrl = new URL(
        request.url ?? '/',
        `http://${request.headers.host ?? 'localhost'}`,
      );

      if (requestUrl.pathname !== TERMINAL_WEBSOCKET_PATH) {
        return;
      }

      if (
        !hasTerminalSessionCookie(
          request.headers.cookie,
          options.sessionToken,
        ) ||
        !isSameOrigin(request)
      ) {
        rejectUpgrade(socket, '401 Unauthorized');
        return;
      }

      this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        this.webSocketServer.emit('connection', webSocket, request);
      });
    };

    this.webSocketServer.on('connection', (socket) => {
      this.gateway.handleConnection(socket);
    });
    options.httpServer.on('upgrade', this.upgradeHandler);
  }

  close(): void {
    this.options.httpServer.off('upgrade', this.upgradeHandler);
    this.gateway.closeAll();

    for (const client of this.webSocketServer.clients) {
      client.terminate();
    }

    this.webSocketServer.close();
  }
}

export function createTerminalSessionCookie(sessionToken: string): string {
  return `${TERMINAL_SESSION_COOKIE}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict`;
}

export function hasTerminalSessionCookie(
  cookieHeader: string | undefined,
  sessionToken: string,
): boolean {
  return (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${TERMINAL_SESSION_COOKIE}=${sessionToken}`);
}

function isSameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;

  if (!origin || !host) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    return (
      (originUrl.protocol === 'http:' || originUrl.protocol === 'https:') &&
      originUrl.host === host
    );
  } catch {
    return false;
  }
}

function rejectUpgrade(socket: Duplex, status: string): void {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}
