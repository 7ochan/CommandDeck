import {
  TERMINAL_PROTOCOL_VERSION,
  TERMINAL_WEBSOCKET_PATH,
  serializeTerminalMessage,
  type TerminalClientMessage,
} from '@/shared/contracts';

export function createTerminalWebSocket(): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(
    `${protocol}//${window.location.host}${TERMINAL_WEBSOCKET_PATH}`,
  );
}

export function sendTerminalInput(
  socket: WebSocket,
  sessionId: string,
  data: string,
): void {
  send(socket, {
    version: TERMINAL_PROTOCOL_VERSION,
    type: 'terminal.input',
    sessionId,
    payload: { data },
  });
}

export function sendTerminalResize(
  socket: WebSocket,
  sessionId: string,
  cols: number,
  rows: number,
): void {
  send(socket, {
    version: TERMINAL_PROTOCOL_VERSION,
    type: 'terminal.resize',
    sessionId,
    payload: { cols, rows },
  });
}

function send(socket: WebSocket, message: TerminalClientMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(serializeTerminalMessage(message));
  }
}
