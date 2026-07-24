import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket, { type RawData } from 'ws';

import {
  TERMINAL_PROTOCOL_VERSION,
  parseTerminalServerMessage,
  serializeTerminalMessage,
  type TerminalServerMessage,
} from '../src/shared/contracts/terminal.js';
import { OscShellIntegrationParser } from '../src/server/shell-integration/parsers/osc-parser.js';
import {
  commandDeckItemSchema,
  commandDeckResponseSchema,
  commandHistoryResponseSchema,
} from '../src/shared/schemas/index.js';
import type { CommandHistoryEntry } from '../src/shared/types/command.js';
import type { CommandDeckItem } from '../src/shared/types/deck.js';

const port = Number.parseInt(process.env.COMMANDDECK_VERIFY_PORT ?? '3210', 10);
const hostname = '127.0.0.1';
const origin = `http://${hostname}:${port}`;
const dataDirectory = mkdtempSync(
  join(tmpdir(), 'commanddeck-terminal-verification-'),
);
let server = startServer(dataDirectory);

try {
  verifyStreamingParser();
  await waitForServer(server);
  assert.ok(
    existsSync(join(dataDirectory, 'commanddeck.db')),
    'The database should initialize automatically on first launch',
  );

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

  const lifecycleCountBeforeEmptyCommand = commandMessages(messages).length;
  sendInput(socket, sessionId, '\r');
  await delay(250);
  assert.equal(
    commandMessages(messages).length,
    lifecycleCountBeforeEmptyCommand,
    'Empty commands must not emit lifecycle events',
  );

  sendInput(socket, sessionId, "printf '__COMMAND_ONE__\\n'\r");
  const firstStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) => message.payload.command.includes('__COMMAND_ONE__'),
    'first command start',
  );
  const firstCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) => message.payload.commandId === firstStarted.payload.commandId,
    'first command completion',
  );
  assertCommandPair(firstStarted, firstCompleted, 0);

  sendInput(socket, sessionId, "printf '__COMMAND_TWO__\\n'\r");
  const secondStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) => message.payload.command.includes('__COMMAND_TWO__'),
    'second command start',
  );
  const secondCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) => message.payload.commandId === secondStarted.payload.commandId,
    'second command completion',
  );
  assertCommandPair(secondStarted, secondCompleted, 0);

  sendInput(socket, sessionId, 'false\r');
  const failedStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) => message.payload.command === 'false',
    'failed command start',
  );
  const failedCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) => message.payload.commandId === failedStarted.payload.commandId,
    'failed command completion',
  );
  assertCommandPair(failedStarted, failedCompleted, 1);

  sendExecute(socket, sessionId, failedCompleted.payload.command);
  const rerunFailedStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) =>
      message.payload.command === failedCompleted.payload.command &&
      message.payload.commandId !== failedCompleted.payload.commandId,
    'rerun failed command start',
  );
  const rerunFailedCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) =>
      message.payload.commandId === rerunFailedStarted.payload.commandId,
    'rerun failed command completion',
  );
  assertCommandPair(rerunFailedStarted, rerunFailedCompleted, 1);

  sendInput(socket, sessionId, 'if true; then\r');
  sendInput(socket, sessionId, "  printf '__MULTILINE__\\n'\r");
  sendInput(socket, sessionId, 'fi\r');
  const multilineStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) => message.payload.command.includes('__MULTILINE__'),
    'multiline command start',
  );
  assert.ok(
    multilineStarted.payload.command.includes('\n'),
    'Multiline command text should preserve newlines',
  );
  const multilineCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) =>
      message.payload.commandId === multilineStarted.payload.commandId,
    'multiline command completion',
  );
  assertCommandPair(multilineStarted, multilineCompleted, 0);

  sendExecute(socket, sessionId, multilineCompleted.payload.command);
  const rerunMultilineStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) =>
      message.payload.command === multilineCompleted.payload.command &&
      message.payload.commandId !== multilineCompleted.payload.commandId,
    'rerun multiline command start',
  );
  const rerunMultilineCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) =>
      message.payload.commandId === rerunMultilineStarted.payload.commandId,
    'rerun multiline command completion',
  );
  assertCommandPair(rerunMultilineStarted, rerunMultilineCompleted, 0);

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
  const interruptedStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) => message.payload.command === 'sleep 5',
    'interrupted command start',
  );
  await delay(250);
  sendInput(socket, sessionId, '\u0003');
  const interruptedCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) =>
      message.payload.commandId === interruptedStarted.payload.commandId,
    'interrupted command completion',
  );
  assertCommandPair(interruptedStarted, interruptedCompleted, 130);

  sendInput(socket, sessionId, "printf '__CTRL_C_OK__\\n'\r");
  const afterInterruptStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) => message.payload.command.includes('__CTRL_C_OK__'),
    'command start after Ctrl+C',
  );
  const afterInterruptCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) =>
      message.payload.commandId === afterInterruptStarted.payload.commandId,
    'command completion after Ctrl+C',
  );
  assertCommandPair(afterInterruptStarted, afterInterruptCompleted, 0);

  const deckItem = await addHistoryEntryToDeck(
    firstCompleted.payload.commandId,
  );
  const editedDeckItem = await editDeckItem(deckItem.deckItemId, {
    displayName: 'Verification command',
    command: "printf '__DECK_RUN__\\n'",
    description: 'Edited independently from History.',
  });
  assert.equal(
    editedDeckItem.sourceHistoryId,
    firstCompleted.payload.commandId,
    'Deck item should retain History provenance',
  );
  const historyAfterDeckEdit = await loadCommandHistory();
  assert.equal(
    historyAfterDeckEdit.find(
      ({ commandId }) => commandId === firstCompleted.payload.commandId,
    )?.command,
    firstCompleted.payload.command,
    'Editing a Deck item must not modify its source History entry',
  );

  sendExecute(socket, sessionId, editedDeckItem.command);
  const deckRunStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) => message.payload.command === editedDeckItem.command,
    'Deck command start',
  );
  const deckRunCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) => message.payload.commandId === deckRunStarted.payload.commandId,
    'Deck command completion',
  );
  assertCommandPair(deckRunStarted, deckRunCompleted, 0);

  socket.send(
    serializeTerminalMessage({
      version: TERMINAL_PROTOCOL_VERSION,
      type: 'terminal.close',
      sessionId,
      payload: {},
    }),
  );
  await once(socket, 'close');

  const expectedCommandIds = [
    firstCompleted.payload.commandId,
    secondCompleted.payload.commandId,
    failedCompleted.payload.commandId,
    rerunFailedCompleted.payload.commandId,
    multilineCompleted.payload.commandId,
    rerunMultilineCompleted.payload.commandId,
    interruptedCompleted.payload.commandId,
    afterInterruptCompleted.payload.commandId,
    deckRunCompleted.payload.commandId,
  ];
  const historyBeforeRestart = await loadCommandHistory();
  assertHistoryPersisted(historyBeforeRestart, expectedCommandIds);

  await stopServer(server);
  server = startServer(dataDirectory);
  await waitForServer(server);

  const historyAfterRestart = await loadCommandHistory();
  assertHistoryPersisted(historyAfterRestart, expectedCommandIds);
  const deckAfterRestart = await loadCommandDeck();
  assert.deepEqual(
    deckAfterRestart,
    [editedDeckItem],
    'Edited Command Deck should persist across server restart',
  );

  console.log(
    'Terminal verification passed: lifecycle events, History persistence/search storage, Deck add/edit/run/restart behavior, reruns, failures, multiline input, ANSI color, resize, and Ctrl+C.',
  );
} finally {
  await stopServer(server);
  rmSync(dataDirectory, { recursive: true, force: true });
}

function startServer(commandDeckDataDirectory: string): ChildProcess {
  return spawn(process.execPath, ['.server/server.js', '--production'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      COMMANDDECK_HOST: hostname,
      COMMANDDECK_DATA_DIR: commandDeckDataDirectory,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function loadCommandHistory(): Promise<CommandHistoryEntry[]> {
  const response = await fetch(`${origin}/api/history`, { cache: 'no-store' });
  assert.equal(
    response.status,
    200,
    'Command History API should respond successfully',
  );
  const payload: unknown = await response.json();
  return commandHistoryResponseSchema.parse(payload).entries;
}

async function addHistoryEntryToDeck(
  historyId: string,
): Promise<CommandDeckItem> {
  const response = await fetch(`${origin}/api/deck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ historyId }),
  });
  assert.equal(response.status, 201, 'Adding a History entry should succeed');
  return commandDeckItemSchema.parse(await response.json());
}

async function editDeckItem(
  deckItemId: string,
  update: { displayName: string; command: string; description: string },
): Promise<CommandDeckItem> {
  const response = await fetch(
    `${origin}/api/deck/${encodeURIComponent(deckItemId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    },
  );
  assert.equal(response.status, 200, 'Editing a Deck item should succeed');
  return commandDeckItemSchema.parse(await response.json());
}

async function loadCommandDeck(): Promise<CommandDeckItem[]> {
  const response = await fetch(`${origin}/api/deck`, { cache: 'no-store' });
  assert.equal(response.status, 200, 'Command Deck API should respond');
  return commandDeckResponseSchema.parse(await response.json()).items;
}

function assertHistoryPersisted(
  entries: CommandHistoryEntry[],
  expectedCommandIds: string[],
): void {
  const persistedIds = new Set(entries.map(({ commandId }) => commandId));

  for (const commandId of expectedCommandIds) {
    assert.ok(
      persistedIds.has(commandId),
      `Completed command ${commandId} should be persisted`,
    );
  }

  for (let index = 1; index < entries.length; index += 1) {
    assert.ok(
      entries[index - 1].endedAt >= entries[index].endedAt,
      'Persisted History should remain newest-first',
    );
  }
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

function sendExecute(
  socket: WebSocket,
  sessionId: string,
  command: string,
): void {
  socket.send(
    serializeTerminalMessage({
      version: TERMINAL_PROTOCOL_VERSION,
      type: 'terminal.execute',
      sessionId,
      payload: { command },
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

type CommandStartedMessage = Extract<
  TerminalServerMessage,
  { type: 'command.started' }
>;
type CommandCompletedMessage = Extract<
  TerminalServerMessage,
  { type: 'command.completed' }
>;

async function waitForCommandMessage(
  messages: TerminalServerMessage[],
  type: 'command.started',
  predicate: (message: CommandStartedMessage) => boolean,
  description: string,
): Promise<CommandStartedMessage>;
async function waitForCommandMessage(
  messages: TerminalServerMessage[],
  type: 'command.completed',
  predicate: (message: CommandCompletedMessage) => boolean,
  description: string,
): Promise<CommandCompletedMessage>;
async function waitForCommandMessage(
  messages: TerminalServerMessage[],
  type: 'command.started' | 'command.completed',
  predicate: (message: never) => boolean,
  description: string,
): Promise<CommandStartedMessage | CommandCompletedMessage> {
  let match: CommandStartedMessage | CommandCompletedMessage | undefined;

  await waitFor(() => {
    match = commandMessages(messages).find(
      (message) => message.type === type && predicate(message as never),
    );
    return Boolean(match);
  }, description);

  assert.ok(match);
  return match;
}

function commandMessages(
  messages: TerminalServerMessage[],
): Array<CommandStartedMessage | CommandCompletedMessage> {
  return messages.filter(
    (message): message is CommandStartedMessage | CommandCompletedMessage =>
      message.type === 'command.started' ||
      message.type === 'command.completed',
  );
}

function assertCommandPair(
  started: CommandStartedMessage,
  completed: CommandCompletedMessage,
  expectedExitCode: number,
): void {
  assert.equal(completed.payload.commandId, started.payload.commandId);
  assert.equal(completed.payload.command, started.payload.command);
  assert.equal(completed.payload.cwd, started.payload.cwd);
  assert.equal(completed.payload.startedAt, started.payload.startedAt);
  assert.equal(completed.payload.exitCode, expectedExitCode);
  assert.equal(completed.payload.completionReason, 'shell');
  assert.ok(completed.payload.endedAt >= started.payload.startedAt);
  assert.equal(
    completed.payload.durationMs,
    completed.payload.endedAt - started.payload.startedAt,
  );
}

function verifyStreamingParser(): void {
  const nonce = 'parser-test-nonce';
  const parser = new OscShellIntegrationParser({ shell: 'zsh', nonce });
  const stream = [
    'before',
    `\u001b]633;E;printf \\x27hello\\x27\\x0a;${nonce}\u0007`,
    `\u001b]633;C;${nonce}\u0007`,
    'output',
    `\u001b]633;D;7;${nonce}\u0007`,
    'after',
  ].join('');
  const tokens = [...stream].flatMap((character) => parser.push(character));
  const visibleOutput = tokens
    .filter((token) => token.type === 'output')
    .map((token) => token.data)
    .join('');
  const markers = tokens
    .filter((token) => token.type === 'marker')
    .map((token) => token.marker);

  assert.equal(visibleOutput, 'beforeoutputafter');
  assert.deepEqual(markers, [
    { type: 'command.line', command: "printf 'hello'\n" },
    { type: 'command.start' },
    { type: 'command.end', exitCode: 7 },
  ]);
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
