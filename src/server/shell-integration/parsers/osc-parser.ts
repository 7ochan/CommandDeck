import type { ShellIntegrationConfiguration } from '../shell-profiles.js';

const OSC_PREFIX = '\u001b]633;';
const BELL_TERMINATOR = '\u0007';
const STRING_TERMINATOR = '\u001b\\';

export type ShellMarker =
  | { type: 'prompt.start' }
  | { type: 'prompt.end' }
  | { type: 'cwd'; cwd: string }
  | { type: 'command.line'; command: string }
  | { type: 'command.start' }
  | { type: 'command.end'; exitCode: number };

export type ShellIntegrationToken =
  { type: 'output'; data: string } | { type: 'marker'; marker: ShellMarker };

export class OscShellIntegrationParser {
  private buffer = '';

  constructor(private readonly configuration: ShellIntegrationConfiguration) {}

  push(chunk: string): ShellIntegrationToken[] {
    this.buffer += chunk;
    const tokens: ShellIntegrationToken[] = [];

    while (this.buffer.length > 0) {
      const markerStart = this.buffer.indexOf(OSC_PREFIX);

      if (markerStart === -1) {
        const retainedLength = matchingPrefixSuffixLength(
          this.buffer,
          OSC_PREFIX,
        );
        pushOutput(
          tokens,
          this.buffer.slice(0, this.buffer.length - retainedLength),
        );
        this.buffer = this.buffer.slice(this.buffer.length - retainedLength);
        break;
      }

      pushOutput(tokens, this.buffer.slice(0, markerStart));
      const contentStart = markerStart + OSC_PREFIX.length;
      const terminator = findTerminator(this.buffer, contentStart);

      if (!terminator) {
        this.buffer = this.buffer.slice(markerStart);
        break;
      }

      const rawSequence = this.buffer.slice(
        markerStart,
        terminator.index + terminator.length,
      );
      const content = this.buffer.slice(contentStart, terminator.index);
      this.buffer = this.buffer.slice(terminator.index + terminator.length);

      const marker = parseMarker(content, this.configuration.nonce);

      if (marker) {
        tokens.push({ type: 'marker', marker });
      } else {
        pushOutput(tokens, rawSequence);
      }
    }

    return tokens;
  }

  drain(): string {
    const remaining = this.buffer;
    this.buffer = '';
    return remaining;
  }
}

function parseMarker(content: string, nonce: string): ShellMarker | null {
  const fields = content.split(';');
  const code = fields[0];

  if (code === 'A' && fields[1] === nonce) {
    return { type: 'prompt.start' };
  }

  if (code === 'B' && fields[1] === nonce) {
    return { type: 'prompt.end' };
  }

  if (code === 'C' && fields[1] === nonce) {
    return { type: 'command.start' };
  }

  if (code === 'D' && fields[2] === nonce) {
    const exitCode = Number.parseInt(fields[1] ?? '', 10);
    return Number.isInteger(exitCode)
      ? { type: 'command.end', exitCode }
      : null;
  }

  if (code === 'E' && fields.at(-1) === nonce) {
    return {
      type: 'command.line',
      command: decodeOscValue(fields.slice(1, -1).join(';')),
    };
  }

  if (code === 'P' && fields.at(-1) === nonce) {
    const property = fields.slice(1, -1).join(';');

    if (property.startsWith('Cwd=')) {
      return { type: 'cwd', cwd: decodeOscValue(property.slice(4)) };
    }
  }

  return null;
}

function decodeOscValue(value: string): string {
  let decoded = '';

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character !== '\\') {
      decoded += character;
      continue;
    }

    if (value[index + 1] === '\\') {
      decoded += '\\';
      index += 1;
      continue;
    }

    const hexadecimal = value.slice(index + 2, index + 4);

    if (value[index + 1] === 'x' && /^[0-9a-f]{2}$/i.test(hexadecimal)) {
      decoded += String.fromCharCode(Number.parseInt(hexadecimal, 16));
      index += 3;
      continue;
    }

    decoded += character;
  }

  return decoded;
}

function findTerminator(
  value: string,
  fromIndex: number,
): { index: number; length: number } | null {
  const bellIndex = value.indexOf(BELL_TERMINATOR, fromIndex);
  const stringIndex = value.indexOf(STRING_TERMINATOR, fromIndex);

  if (bellIndex === -1 && stringIndex === -1) {
    return null;
  }

  if (bellIndex !== -1 && (stringIndex === -1 || bellIndex < stringIndex)) {
    return { index: bellIndex, length: BELL_TERMINATOR.length };
  }

  return { index: stringIndex, length: STRING_TERMINATOR.length };
}

function matchingPrefixSuffixLength(value: string, prefix: string): number {
  const maximum = Math.min(value.length, prefix.length - 1);

  for (let length = maximum; length > 0; length -= 1) {
    if (value.endsWith(prefix.slice(0, length))) {
      return length;
    }
  }

  return 0;
}

function pushOutput(tokens: ShellIntegrationToken[], data: string): void {
  if (data.length === 0) {
    return;
  }

  const previous = tokens.at(-1);

  if (previous?.type === 'output') {
    previous.data += data;
  } else {
    tokens.push({ type: 'output', data });
  }
}
