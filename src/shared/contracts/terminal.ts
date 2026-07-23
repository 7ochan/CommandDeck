import type {
  CommandCompletedPayload,
  CommandStartedPayload,
} from '../types/command';

export const TERMINAL_PROTOCOL_VERSION = 1 as const;
export const TERMINAL_WEBSOCKET_PATH = '/ws/terminal';

const MAX_INPUT_LENGTH = 64 * 1024;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 500;
const MIN_ROWS = 2;
const MAX_ROWS = 300;

type TerminalMessage<TType extends string, TPayload> = {
  version: typeof TERMINAL_PROTOCOL_VERSION;
  type: TType;
  sessionId: string;
  payload: TPayload;
};

export type TerminalClientMessage =
  | TerminalMessage<'terminal.input', { data: string }>
  | TerminalMessage<'terminal.execute', { command: string }>
  | TerminalMessage<'terminal.resize', { cols: number; rows: number }>
  | TerminalMessage<'terminal.close', Record<string, never>>;

export type TerminalServerMessage =
  | TerminalMessage<
      'terminal.started',
      { shell: string; cwd: string; cols: number; rows: number }
    >
  | TerminalMessage<'terminal.output', { data: string }>
  | TerminalMessage<'terminal.resized', { cols: number; rows: number }>
  | TerminalMessage<
      'terminal.exited',
      { exitCode: number; signal: number | null }
    >
  | TerminalMessage<'terminal.error', { message: string }>
  | TerminalMessage<'command.started', CommandStartedPayload>
  | TerminalMessage<'command.completed', CommandCompletedPayload>;

export function parseTerminalClientMessage(
  value: string,
): TerminalClientMessage | null {
  const message = parseMessage(value);

  if (!message) {
    return null;
  }

  const { payload, sessionId, type, version } = message;

  if (type === 'terminal.input') {
    return typeof payload.data === 'string' &&
      payload.data.length <= MAX_INPUT_LENGTH
      ? { version, type, sessionId, payload: { data: payload.data } }
      : null;
  }

  if (type === 'terminal.execute') {
    return typeof payload.command === 'string' &&
      payload.command.trim().length > 0 &&
      payload.command.length <= MAX_INPUT_LENGTH
      ? {
          version,
          type,
          sessionId,
          payload: { command: payload.command },
        }
      : null;
  }

  if (type === 'terminal.resize') {
    const { cols, rows } = payload;

    return isIntegerInRange(cols, MIN_COLUMNS, MAX_COLUMNS) &&
      isIntegerInRange(rows, MIN_ROWS, MAX_ROWS)
      ? { version, type, sessionId, payload: { cols, rows } }
      : null;
  }

  if (type === 'terminal.close') {
    return { version, type, sessionId, payload: {} };
  }

  return null;
}

export function parseTerminalServerMessage(
  value: string,
): TerminalServerMessage | null {
  const message = parseMessage(value);

  if (!message) {
    return null;
  }

  const { payload, sessionId, type, version } = message;

  if (type === 'terminal.started') {
    const { cols, cwd, rows, shell } = payload;

    return typeof shell === 'string' &&
      typeof cwd === 'string' &&
      isIntegerInRange(cols, MIN_COLUMNS, MAX_COLUMNS) &&
      isIntegerInRange(rows, MIN_ROWS, MAX_ROWS)
      ? { version, type, sessionId, payload: { shell, cwd, cols, rows } }
      : null;
  }

  if (type === 'terminal.output') {
    return typeof payload.data === 'string'
      ? { version, type, sessionId, payload: { data: payload.data } }
      : null;
  }

  if (type === 'terminal.resized') {
    const { cols, rows } = payload;

    return isIntegerInRange(cols, MIN_COLUMNS, MAX_COLUMNS) &&
      isIntegerInRange(rows, MIN_ROWS, MAX_ROWS)
      ? { version, type, sessionId, payload: { cols, rows } }
      : null;
  }

  if (type === 'terminal.exited') {
    const { exitCode, signal } = payload;

    return typeof exitCode === 'number' &&
      Number.isInteger(exitCode) &&
      (signal === null ||
        (typeof signal === 'number' && Number.isInteger(signal)))
      ? {
          version,
          type,
          sessionId,
          payload: { exitCode, signal: signal as number | null },
        }
      : null;
  }

  if (type === 'terminal.error') {
    return typeof payload.message === 'string'
      ? { version, type, sessionId, payload: { message: payload.message } }
      : null;
  }

  if (type === 'command.started') {
    const command = parseCommandStartedPayload(payload);
    return command ? { version, type, sessionId, payload: command } : null;
  }

  if (type === 'command.completed') {
    const command = parseCommandCompletedPayload(payload);
    return command ? { version, type, sessionId, payload: command } : null;
  }

  return null;
}

function parseCommandStartedPayload(
  payload: Record<string, unknown>,
): CommandStartedPayload | null {
  const { command, commandId, cwd, startedAt } = payload;

  return typeof commandId === 'string' &&
    commandId.length > 0 &&
    typeof command === 'string' &&
    command.length > 0 &&
    typeof cwd === 'string' &&
    isNonNegativeInteger(startedAt)
    ? { commandId, command, cwd, startedAt }
    : null;
}

function parseCommandCompletedPayload(
  payload: Record<string, unknown>,
): CommandCompletedPayload | null {
  const started = parseCommandStartedPayload(payload);
  const { completionReason, durationMs, endedAt, exitCode } = payload;

  return started &&
    isNonNegativeInteger(endedAt) &&
    isNonNegativeInteger(durationMs) &&
    typeof exitCode === 'number' &&
    Number.isInteger(exitCode) &&
    (completionReason === 'shell' || completionReason === 'session-exit')
    ? {
        ...started,
        endedAt,
        durationMs,
        exitCode,
        completionReason,
      }
    : null;
}

export function serializeTerminalMessage(
  message: TerminalClientMessage | TerminalServerMessage,
): string {
  return JSON.stringify(message);
}

function parseMessage(value: string): {
  version: typeof TERMINAL_PROTOCOL_VERSION;
  type: string;
  sessionId: string;
  payload: Record<string, unknown>;
} | null {
  try {
    const candidate: unknown = JSON.parse(value);

    if (
      !isRecord(candidate) ||
      candidate.version !== TERMINAL_PROTOCOL_VERSION ||
      typeof candidate.type !== 'string' ||
      typeof candidate.sessionId !== 'string' ||
      candidate.sessionId.length === 0 ||
      !isRecord(candidate.payload)
    ) {
      return null;
    }

    return {
      version: TERMINAL_PROTOCOL_VERSION,
      type: candidate.type,
      sessionId: candidate.sessionId,
      payload: candidate.payload,
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
