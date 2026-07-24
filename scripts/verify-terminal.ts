import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
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
import { expandCommandTemplate } from '../src/shared/command-template/index.js';
import {
  commandDeckItemSchema,
  commandDeckResponseSchema,
  commandHistoryResponseSchema,
  workspaceSummarySchema,
  workspacesResponseSchema,
} from '../src/shared/schemas/index.js';
import type { CommandHistoryEntry } from '../src/shared/types/command.js';
import type { CommandDeckItem } from '../src/shared/types/deck.js';
import type { WorkspaceSummary } from '../src/shared/types/workspace.js';

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
  const timelineResponse = await fetch(`${origin}/timeline`);
  assert.equal(
    timelineResponse.status,
    200,
    'Workspace Timeline page should respond successfully',
  );

  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'Homepage should issue a terminal session cookie');
  const initialWorkspaces = await loadWorkspaces();
  assert.equal(initialWorkspaces.length, 1);
  assert.equal(initialWorkspaces[0]?.name, 'Default Workspace');
  const defaultWorkspaceId = initialWorkspaces[0]?.workspaceId;
  assert.ok(defaultWorkspaceId);
  const defaultWorkingDirectory = join(dataDirectory, 'default-project');
  const servicesWorkingDirectory = join(dataDirectory, 'services-project');
  mkdirSync(defaultWorkingDirectory);
  mkdirSync(servicesWorkingDirectory);

  const messages: TerminalServerMessage[] = [];
  let output = '';
  const socket = new WebSocket(
    `ws://${hostname}:${port}/ws/terminal?workspaceId=${encodeURIComponent(defaultWorkspaceId)}`,
    {
      headers: {
        Cookie: cookie,
        Origin: origin,
      },
    },
  );

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
  let sessionId = started.sessionId;
  assert.equal(
    started.type === 'terminal.started'
      ? started.payload.workspaceId
      : undefined,
    defaultWorkspaceId,
    'The first terminal should start in Default Workspace',
  );
  assert.equal(
    started.type === 'terminal.started' ? started.payload.cwd : undefined,
    homedir(),
  );
  await waitForOutput(
    () => normalizeTerminalText(output).includes('~\n❯ '),
    'minimal cwd-only prompt',
  );

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
  await waitForOutput(() => {
    const terminalText = normalizeTerminalText(output);
    const commandOutputIndex = terminalText.lastIndexOf('__COMMAND_ONE__');
    const nextPromptIndex = terminalText.indexOf('❯ ', commandOutputIndex);

    return (
      commandOutputIndex >= 0 &&
      nextPromptIndex > commandOutputIndex &&
      /\n[ \t]*\n/.test(terminalText.slice(commandOutputIndex, nextPromptIndex))
    );
  }, 'command-boundary spacing before the next prompt');

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

  sendExecute(
    socket,
    sessionId,
    `cd -- ${shellQuote(defaultWorkingDirectory)}`,
  );
  const defaultCwdStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) => message.payload.command.startsWith('cd -- '),
    'Default Workspace cwd command start',
  );
  const defaultCwdCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) =>
      message.payload.commandId === defaultCwdStarted.payload.commandId,
    'Default Workspace cwd command completion',
  );
  assertCommandPair(defaultCwdStarted, defaultCwdCompleted, 0);

  const deckItem = await addHistoryEntryToDeck(
    defaultWorkspaceId,
    firstCompleted.payload.commandId,
  );
  const editedDeckItem = await editDeckItem(
    defaultWorkspaceId,
    deckItem.deckItemId,
    {
      displayName: 'Verification command',
      command: "printf '__DECK_{{value}}_{{value}}__\\n'",
      description: 'Edited independently from History.',
    },
  );
  assert.equal(
    editedDeckItem.sourceHistoryId,
    firstCompleted.payload.commandId,
    'Deck item should retain History provenance',
  );
  const historyAfterDeckEdit = await loadCommandHistory(defaultWorkspaceId);
  assert.equal(
    historyAfterDeckEdit.find(
      ({ commandId }) => commandId === firstCompleted.payload.commandId,
    )?.command,
    firstCompleted.payload.command,
    'Editing a Deck item must not modify its source History entry',
  );

  const deckExpansion = expandCommandTemplate(editedDeckItem.command, {
    value: 'RUN',
  });
  assert.ok(deckExpansion.ok, 'Deck template should expand successfully');
  const expandedDeckCommand = deckExpansion.command;
  assert.equal(
    editedDeckItem.command,
    "printf '__DECK_{{value}}_{{value}}__\\n'",
    'Expanding a Deck command must not mutate its stored template',
  );

  sendExecute(socket, sessionId, expandedDeckCommand);
  const deckRunStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) => message.payload.command === expandedDeckCommand,
    'Deck command start',
  );
  const deckRunCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) => message.payload.commandId === deckRunStarted.payload.commandId,
    'Deck command completion',
  );
  assertCommandPair(deckRunStarted, deckRunCompleted, 0);

  const servicesWorkspace = await createWorkspace('Services');
  const initialServicesTerminal = await selectWorkspace(
    socket,
    sessionId,
    messages,
    servicesWorkspace.workspaceId,
  );
  assert.notEqual(
    initialServicesTerminal.sessionId,
    sessionId,
    'Switching Workspace should replace the terminal session',
  );
  assert.equal(initialServicesTerminal.payload.cwd, homedir());
  sessionId = initialServicesTerminal.sessionId;
  sendExecute(
    socket,
    sessionId,
    `cd -- ${shellQuote(servicesWorkingDirectory)}`,
  );
  const servicesCwdStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) =>
      message.payload.workspaceId === servicesWorkspace.workspaceId &&
      message.payload.command.startsWith('cd -- '),
    'Services Workspace cwd command start',
  );
  const servicesCwdCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) =>
      message.payload.commandId === servicesCwdStarted.payload.commandId,
    'Services Workspace cwd command completion',
  );
  assertCommandPair(servicesCwdStarted, servicesCwdCompleted, 0);
  sendExecute(socket, sessionId, "printf '__WORKSPACE_SERVICES__\\n'");
  const servicesStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) => message.payload.command.includes('__WORKSPACE_SERVICES__'),
    'Services Workspace command start',
  );
  const servicesCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) =>
      message.payload.commandId === servicesStarted.payload.commandId,
    'Services Workspace command completion',
  );
  assertCommandPair(servicesStarted, servicesCompleted, 0);
  assert.equal(
    servicesCompleted.payload.workspaceId,
    servicesWorkspace.workspaceId,
  );

  const servicesDeckItem = await addHistoryEntryToDeck(
    servicesWorkspace.workspaceId,
    servicesCompleted.payload.commandId,
  );
  const servicesTemplate = await editDeckItem(
    servicesWorkspace.workspaceId,
    servicesDeckItem.deckItemId,
    {
      displayName: 'Workspace template',
      command: "printf '__WORKSPACE_{{target}}__\\n'",
      description: 'Runs only in the active Workspace.',
    },
  );
  const servicesExpansion = expandCommandTemplate(servicesTemplate.command, {
    target: 'TEMPLATE',
  });
  assert.ok(servicesExpansion.ok);
  sendExecute(socket, sessionId, servicesExpansion.command);
  const servicesTemplateStarted = await waitForCommandMessage(
    messages,
    'command.started',
    (message) => message.payload.command === servicesExpansion.command,
    'Services template command start',
  );
  const servicesTemplateCompleted = await waitForCommandMessage(
    messages,
    'command.completed',
    (message) =>
      message.payload.commandId === servicesTemplateStarted.payload.commandId,
    'Services template command completion',
  );
  assertCommandPair(servicesTemplateStarted, servicesTemplateCompleted, 0);
  assert.equal(
    servicesTemplateCompleted.payload.workspaceId,
    servicesWorkspace.workspaceId,
  );

  const restoredDefaultTerminal = await selectWorkspace(
    socket,
    sessionId,
    messages,
    defaultWorkspaceId,
  );
  assert.notEqual(restoredDefaultTerminal.sessionId, sessionId);
  assert.equal(restoredDefaultTerminal.payload.cwd, defaultWorkingDirectory);
  sessionId = restoredDefaultTerminal.sessionId;

  const restoredServicesTerminal = await selectWorkspace(
    socket,
    sessionId,
    messages,
    servicesWorkspace.workspaceId,
  );
  assert.notEqual(restoredServicesTerminal.sessionId, sessionId);
  assert.equal(restoredServicesTerminal.payload.cwd, servicesWorkingDirectory);
  sessionId = restoredServicesTerminal.sessionId;

  const defaultHistoryDuringServices =
    await loadCommandHistory(defaultWorkspaceId);
  assert.equal(
    defaultHistoryDuringServices.some(
      ({ commandId }) => commandId === servicesCompleted.payload.commandId,
    ),
    false,
    'Services History must not leak into Default Workspace',
  );
  const servicesHistory = await loadCommandHistory(
    servicesWorkspace.workspaceId,
  );
  assertHistoryPersisted(servicesHistory, [
    servicesCwdCompleted.payload.commandId,
    servicesCompleted.payload.commandId,
    servicesTemplateCompleted.payload.commandId,
  ]);
  assert.equal((await loadCommandDeck(defaultWorkspaceId)).length, 1);
  assert.equal(
    (await loadCommandDeck(servicesWorkspace.workspaceId)).length,
    1,
  );
  assert.equal(
    (
      await loadCommandHistory(
        servicesWorkspace.workspaceId,
        '__WORKSPACE_SERVICES__',
      )
    ).length,
    1,
    'Workspace-scoped History search should remain available',
  );
  const renamedServicesWorkspace = await renameWorkspace(
    servicesWorkspace.workspaceId,
    'Backend Services',
  );
  assert.equal(renamedServicesWorkspace.name, 'Backend Services');

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
    defaultCwdCompleted.payload.commandId,
    deckRunCompleted.payload.commandId,
  ];
  const historyBeforeRestart = await loadCommandHistory(defaultWorkspaceId);
  assertHistoryPersisted(historyBeforeRestart, expectedCommandIds);

  await stopServer(server);
  server = startServer(dataDirectory);
  await waitForServer(server);

  const historyAfterRestart = await loadCommandHistory(defaultWorkspaceId);
  assertHistoryPersisted(historyAfterRestart, expectedCommandIds);
  const deckAfterRestart = await loadCommandDeck(defaultWorkspaceId);
  assert.deepEqual(
    deckAfterRestart,
    [editedDeckItem],
    'Edited Command Deck should persist across server restart',
  );
  const workspacesAfterRestart = await loadWorkspaces();
  assert.deepEqual(
    workspacesAfterRestart.map(({ name }) => name),
    ['Default Workspace', 'Backend Services'],
    'Workspace names should persist across restart',
  );
  const servicesAfterRestart = workspacesAfterRestart.find(
    ({ workspaceId }) => workspaceId === servicesWorkspace.workspaceId,
  );
  assert.ok(servicesAfterRestart);
  assert.equal(servicesAfterRestart.historyCount, 3);
  assert.equal(servicesAfterRestart.deckCount, 1);
  assertHistoryPersisted(
    await loadCommandHistory(servicesWorkspace.workspaceId),
    [
      servicesCwdCompleted.payload.commandId,
      servicesCompleted.payload.commandId,
      servicesTemplateCompleted.payload.commandId,
    ],
  );
  assert.deepEqual(await loadCommandDeck(servicesWorkspace.workspaceId), [
    servicesTemplate,
  ]);

  const restartedResponse = await fetch(origin);
  const restartedCookie = restartedResponse.headers
    .get('set-cookie')
    ?.split(';')[0];
  assert.ok(restartedCookie);
  const restoredDefault = await openTerminal(
    defaultWorkspaceId,
    restartedCookie,
  );
  assert.equal(restoredDefault.started.payload.cwd, defaultWorkingDirectory);
  await closeTerminal(
    restoredDefault.socket,
    restoredDefault.started.sessionId,
  );
  const restoredServices = await openTerminal(
    servicesWorkspace.workspaceId,
    restartedCookie,
  );
  assert.equal(restoredServices.started.payload.cwd, servicesWorkingDirectory);
  await closeTerminal(
    restoredServices.socket,
    restoredServices.started.sessionId,
  );

  rmSync(defaultWorkingDirectory, { recursive: true, force: true });
  const invalidDirectoryFallback = await openTerminal(
    defaultWorkspaceId,
    restartedCookie,
  );
  assert.equal(
    invalidDirectoryFallback.started.payload.cwd,
    homedir(),
    'A missing saved cwd should fall back to the user home directory',
  );
  await closeTerminal(
    invalidDirectoryFallback.socket,
    invalidDirectoryFallback.started.sessionId,
  );
  await deleteWorkspace(servicesWorkspace.workspaceId, 204);
  await deleteWorkspace(defaultWorkspaceId, 409);

  console.log(
    'Terminal verification passed: minimal prompt and command spacing, per-Workspace cwd restoration and invalid-directory fallback, Workspace CRUD/switching/isolation/restart behavior, lifecycle ownership, History persistence/search, Deck templates, reruns, failures, multiline input, ANSI color, resize, and Ctrl+C.',
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

async function openTerminal(
  workspaceId: string,
  cookie: string,
): Promise<{
  socket: WebSocket;
  started: Extract<TerminalServerMessage, { type: 'terminal.started' }>;
}> {
  const messages: TerminalServerMessage[] = [];
  const socket = new WebSocket(
    `ws://${hostname}:${port}/ws/terminal?workspaceId=${encodeURIComponent(workspaceId)}`,
    {
      headers: {
        Cookie: cookie,
        Origin: origin,
      },
    },
  );
  socket.on('message', (data: RawData) => {
    const message = parseTerminalServerMessage(data.toString());

    if (message) {
      messages.push(message);
    }
  });
  await once(socket, 'open');
  const started = await waitForMessage(
    messages,
    (message) => message.type === 'terminal.started',
    `terminal.started(${workspaceId})`,
  );

  if (started.type !== 'terminal.started') {
    throw new Error('Expected terminal.started.');
  }

  return { socket, started };
}

async function closeTerminal(
  socket: WebSocket,
  sessionId: string,
): Promise<void> {
  socket.send(
    serializeTerminalMessage({
      version: TERMINAL_PROTOCOL_VERSION,
      type: 'terminal.close',
      sessionId,
      payload: {},
    }),
  );
  await once(socket, 'close');
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function normalizeTerminalText(value: string): string {
  return value
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replaceAll('\r', '');
}

async function loadCommandHistory(
  workspaceId: string,
  searchTerm?: string,
): Promise<CommandHistoryEntry[]> {
  const parameters = new URLSearchParams({ workspaceId });

  if (searchTerm) {
    parameters.set('q', searchTerm);
  }

  const response = await fetch(
    `${origin}/api/history?${parameters.toString()}`,
    { cache: 'no-store' },
  );
  assert.equal(
    response.status,
    200,
    'Command History API should respond successfully',
  );
  const payload: unknown = await response.json();
  return commandHistoryResponseSchema.parse(payload).entries;
}

async function addHistoryEntryToDeck(
  workspaceId: string,
  historyId: string,
): Promise<CommandDeckItem> {
  const response = await fetch(`${origin}/api/deck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, historyId }),
  });
  assert.equal(response.status, 201, 'Adding a History entry should succeed');
  return commandDeckItemSchema.parse(await response.json());
}

async function editDeckItem(
  workspaceId: string,
  deckItemId: string,
  update: { displayName: string; command: string; description: string },
): Promise<CommandDeckItem> {
  const response = await fetch(
    `${origin}/api/deck/${encodeURIComponent(deckItemId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    },
  );
  assert.equal(response.status, 200, 'Editing a Deck item should succeed');
  return commandDeckItemSchema.parse(await response.json());
}

async function loadCommandDeck(
  workspaceId: string,
): Promise<CommandDeckItem[]> {
  const response = await fetch(
    `${origin}/api/deck?workspaceId=${encodeURIComponent(workspaceId)}`,
    { cache: 'no-store' },
  );
  assert.equal(response.status, 200, 'Command Deck API should respond');
  return commandDeckResponseSchema.parse(await response.json()).items;
}

async function loadWorkspaces(): Promise<WorkspaceSummary[]> {
  const response = await fetch(`${origin}/api/workspaces`, {
    cache: 'no-store',
  });
  assert.equal(response.status, 200, 'Workspaces API should respond');
  return workspacesResponseSchema.parse(await response.json()).workspaces;
}

async function createWorkspace(name: string): Promise<WorkspaceSummary> {
  const response = await fetch(`${origin}/api/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  assert.equal(response.status, 201, 'Creating a Workspace should succeed');
  return workspaceSummarySchema.parse(await response.json());
}

async function renameWorkspace(
  workspaceId: string,
  name: string,
): Promise<WorkspaceSummary> {
  const response = await fetch(
    `${origin}/api/workspaces/${encodeURIComponent(workspaceId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    },
  );
  assert.equal(response.status, 200, 'Renaming a Workspace should succeed');
  return workspaceSummarySchema.parse(await response.json());
}

async function deleteWorkspace(
  workspaceId: string,
  expectedStatus: number,
): Promise<void> {
  const response = await fetch(
    `${origin}/api/workspaces/${encodeURIComponent(workspaceId)}`,
    { method: 'DELETE' },
  );
  assert.equal(response.status, expectedStatus);
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

async function selectWorkspace(
  socket: WebSocket,
  sessionId: string,
  messages: TerminalServerMessage[],
  workspaceId: string,
): Promise<Extract<TerminalServerMessage, { type: 'terminal.started' }>> {
  const messageOffset = messages.length;
  socket.send(
    serializeTerminalMessage({
      version: TERMINAL_PROTOCOL_VERSION,
      type: 'terminal.workspace.select',
      sessionId,
      payload: { workspaceId },
    }),
  );
  let started: TerminalServerMessage | undefined;

  await waitFor(() => {
    started = messages
      .slice(messageOffset)
      .find(
        (message) =>
          message.type === 'terminal.started' &&
          message.payload.workspaceId === workspaceId,
      );
    return Boolean(started);
  }, `terminal.started(${workspaceId})`);

  assert.ok(started?.type === 'terminal.started');
  return started;
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
  assert.equal(completed.payload.workspaceId, started.payload.workspaceId);
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
