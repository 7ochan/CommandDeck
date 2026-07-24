import { describe, expect, it } from 'vitest';

import {
  TERMINAL_PROTOCOL_VERSION,
  parseTerminalClientMessage,
  parseTerminalServerMessage,
} from '../../../src/shared/contracts/terminal.js';

describe('terminal.execute protocol', () => {
  it('accepts an explicit Workspace selection', () => {
    expect(
      parseTerminalClientMessage(
        JSON.stringify({
          version: TERMINAL_PROTOCOL_VERSION,
          type: 'terminal.workspace.select',
          sessionId: 'session-1',
          payload: { workspaceId: 'workspace-two' },
        }),
      ),
    ).toEqual({
      version: TERMINAL_PROTOCOL_VERSION,
      type: 'terminal.workspace.select',
      sessionId: 'session-1',
      payload: { workspaceId: 'workspace-two' },
    });
  });

  it('accepts a workspace close request', () => {
    expect(
      parseTerminalClientMessage(
        JSON.stringify({
          version: TERMINAL_PROTOCOL_VERSION,
          type: 'terminal.workspace.close',
          sessionId: 'session-1',
          payload: { workspaceId: 'workspace-old' },
        }),
      ),
    ).toEqual({
      version: TERMINAL_PROTOCOL_VERSION,
      type: 'terminal.workspace.close',
      sessionId: 'session-1',
      payload: { workspaceId: 'workspace-old' },
    });
  });

  it('parses terminal.workspace.selected with sessionId and bufferedOutput', () => {
    expect(
      parseTerminalServerMessage(
        JSON.stringify({
          version: TERMINAL_PROTOCOL_VERSION,
          type: 'terminal.workspace.selected',
          sessionId: 'session-1',
          payload: {
            workspaceId: 'workspace-two',
            sessionId: 'session-2',
            bufferedOutput: 'some output',
          },
        }),
      ),
    ).toEqual({
      version: TERMINAL_PROTOCOL_VERSION,
      type: 'terminal.workspace.selected',
      sessionId: 'session-1',
      payload: {
        workspaceId: 'workspace-two',
        sessionId: 'session-2',
        bufferedOutput: 'some output',
      },
    });
  });

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

