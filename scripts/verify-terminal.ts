import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket, { type RawData } from 'ws';

import {
  TERMINAL_PROTOCOL_VERSION,
  parseTerminalServerMessage,
  serializeTerminalMessage,
  type TerminalServerMessage,
} from '../src/shared/contracts/terminal.js';

const port = Number.parseInt(process.env.COMMANDDECK_VERIFY_PORT ?? '3210', 10);
const hostname = '127.0.0.1';
const origin = `http://${hostname}:${port}`;
const server = startServer();

try {
  await waitForServer(server);

  const response = await fetch(origin);
  assert.equal(response.status, 200, 'Homepage should respond successfully');

  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'Homepage should issue a terminal session cookie');

  const messages: TerminalServerMessage[] = [];
  let output = '';
  const socket = new WebSocket(`ws://${hostname}:${port}/ws/terminal`, {
    headers: {
      Cookie: cookie,
      Origin: origin,
    },
  });

  socket.on('message', (data: RawData) => {
    const message = parseTerminalServerMessage(data.toString());

    if (!message) {
      return;
    }

    messages.push(message);

    if (message.type === 'terminal.output') {
      output += message.payload.data;
    }
  });

  await once(socket, 'open');
  const started = await waitForMessage(
    messages,
    (message) => message.type === 'terminal.started',
    'terminal.started',
  );
  const sessionId = started.sessionId;

  socket.send(
    serializeTerminalMessage({
      version: TERMINAL_PROTOCOL_VERSION,
      type: 'terminal.resize',
      sessionId,
      payload: { cols: 100, rows: 40 },
    }),
  );
  await waitForMessage(
    messages,
    (message) =>
      message.type === 'terminal.resized' &&
      message.payload.cols === 100 &&
      message.payload.rows === 40,
    'terminal.resized(100x40)',
  );

  sendInput(socket, sessionId, "printf '__COMMAND_ONE__\\n'\r");
  await waitForOutput(
    () => output.includes('__COMMAND_ONE__'),
    'first command',
  );

  sendInput(socket, sessionId, "printf '__COMMAND_TWO__\\n'\r");
  await waitForOutput(
    () => output.includes('__COMMAND_TWO__'),
    'second command',
  );

  sendInput(socket, sessionId, "printf '\\033[31m__COLOR__\\033[0m\\n'\r");
  await waitForOutput(
    () => output.includes('\u001b[31m__COLOR__\u001b[0m'),
    'ANSI color output',
  );

  sendInput(socket, sessionId, 'stty size\r');
  await waitForOutput(
    () => /40\s+100/.test(output),
    'PTY dimensions after resize',
  );

  sendInput(socket, sessionId, 'sleep 5\r');
  await delay(250);
  sendInput(socket, sessionId, '\u0003');
  await delay(150);
  sendInput(socket, sessionId, "printf '__CTRL_C_OK__\\n'\r");
  await waitForOutput(
    () => output.includes('__CTRL_C_OK__'),
    'shell responsiveness after Ctrl+C',
  );

  socket.send(
    serializeTerminalMessage({
      version: TERMINAL_PROTOCOL_VERSION,
      type: 'terminal.close',
      sessionId,
      payload: {},
    }),
  );
  await once(socket, 'close');

  console.log(
    'Terminal verification passed: commands, ANSI color, resize, and Ctrl+C.',
  );
} finally {
  await stopServer(server);
}

function startServer(): ChildProcess {
  return spawn(process.execPath, ['.server/server.js', '--production'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      COMMANDDECK_HOST: hostname,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForServer(serverProcess: ChildProcess): Promise<void> {
  let diagnostics = '';

  await new Promise<void>((resolve, reject) => {
    const handleOutput = (chunk: Buffer) => {
      diagnostics += chunk.toString();

      if (diagnostics.includes('CommandDeck is ready')) {
        cleanup();
        resolve();
      }
    };
    const handleExit = (code: number | null) => {
      cleanup();
      reject(
        new Error(
          `CommandDeck exited before verification (code ${String(code)}).\n${diagnostics}`,
        ),
      );
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out starting CommandDeck.\n${diagnostics}`));
    }, 10_000);
    const cleanup = () => {
      clearTimeout(timer);
      serverProcess.stdout?.off('data', handleOutput);
      serverProcess.stderr?.off('data', handleOutput);
      serverProcess.off('exit', handleExit);
    };

    serverProcess.stdout?.on('data', handleOutput);
    serverProcess.stderr?.on('data', handleOutput);
    serverProcess.once('exit', handleExit);
  });
}

function sendInput(socket: WebSocket, sessionId: string, data: string): void {
  socket.send(
    serializeTerminalMessage({
      version: TERMINAL_PROTOCOL_VERSION,
      type: 'terminal.input',
      sessionId,
      payload: { data },
    }),
  );
}

async function waitForMessage(
  messages: TerminalServerMessage[],
  predicate: (message: TerminalServerMessage) => boolean,
  description: string,
): Promise<TerminalServerMessage> {
  let match: TerminalServerMessage | undefined;

  await waitFor(() => {
    match = messages.find(predicate);
    return Boolean(match);
  }, description);

  assert.ok(match);
  return match;
}

async function waitForOutput(
  predicate: () => boolean,
  description: string,
): Promise<void> {
  await waitFor(predicate, description);
}

async function waitFor(
  predicate: () => boolean,
  description: string,
  timeoutMs = 8_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }

    await delay(20);
  }

  throw new Error(`Timed out waiting for ${description}.`);
}

async function stopServer(serverProcess: ChildProcess): Promise<void> {
  if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
    return;
  }

  serverProcess.kill('SIGTERM');

  await Promise.race([once(serverProcess, 'exit'), delay(3_000)]);

  if (serverProcess.exitCode === null && serverProcess.signalCode === null) {
    serverProcess.kill('SIGKILL');
  }
}
