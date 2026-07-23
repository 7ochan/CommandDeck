import type WebSocket from 'ws';

export class ConnectionRegistry {
  private readonly socketsBySession = new Map<string, WebSocket>();
  private readonly sessionsBySocket = new Map<WebSocket, string>();

  add(sessionId: string, socket: WebSocket): void {
    this.socketsBySession.set(sessionId, socket);
    this.sessionsBySocket.set(socket, sessionId);
  }

  deleteBySocket(socket: WebSocket): string | undefined {
    const sessionId = this.sessionsBySocket.get(socket);

    if (sessionId) {
      this.sessionsBySocket.delete(socket);
      this.socketsBySession.delete(sessionId);
    }

    return sessionId;
  }

  closeAll(): void {
    const sockets = [...this.sessionsBySocket.keys()];
    this.sessionsBySocket.clear();
    this.socketsBySession.clear();

    for (const socket of sockets) {
      socket.terminate();
    }
  }
}
