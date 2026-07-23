import { describe, expect, it } from 'vitest';

import {
  TERMINAL_PROTOCOL_VERSION,
  parseTerminalClientMessage,
} from '../../../src/shared/contracts/terminal.js';

describe('terminal.execute protocol', () => {
  it('preserves an exact multiline command', () => {
    const command = "if true; then\n  printf 'again\\n'\nfi";

    expect(
      parseTerminalClientMessage(
        JSON.stringify({
          version: TERMINAL_PROTOCOL_VERSION,
          type: 'terminal.execute',
          sessionId: 'session-1',
          payload: { command },
        }),
      ),
    ).toEqual({
      version: TERMINAL_PROTOCOL_VERSION,
      type: 'terminal.execute',
      sessionId: 'session-1',
      payload: { command },
    });
  });

  it('rejects empty execute requests', () => {
    expect(
      parseTerminalClientMessage(
        JSON.stringify({
          version: TERMINAL_PROTOCOL_VERSION,
          type: 'terminal.execute',
          sessionId: 'session-1',
          payload: { command: '   ' },
        }),
      ),
    ).toBeNull();
  });
});
