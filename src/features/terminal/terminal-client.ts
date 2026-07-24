import {
  TERMINAL_PROTOCOL_VERSION,
  TERMINAL_WEBSOCKET_PATH,
  serializeTerminalMessage,
  type TerminalClientMessage,
} from '@/shared/contracts';

export function createTerminalWebSocket(workspaceId: string): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = new URL(
    `${protocol}//${window.location.host}${TERMINAL_WEBSOCKET_PATH}`,
  );
  url.searchParams.set('workspaceId', workspaceId);
  return new WebSocket(url);
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

export function executeTerminalCommand(
  socket: WebSocket,
  sessionId: string,
  command: string,
): void {
  send(socket, {
    version: TERMINAL_PROTOCOL_VERSION,
    type: 'terminal.execute',
    sessionId,
    payload: { command },
  });
}

export function selectTerminalWorkspace(
  socket: WebSocket,
  sessionId: string,
  workspaceId: string,
): void {
  send(socket, {
    version: TERMINAL_PROTOCOL_VERSION,
    type: 'terminal.workspace.select',
    sessionId,
    payload: { workspaceId },
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
