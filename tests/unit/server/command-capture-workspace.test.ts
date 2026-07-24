import { describe, expect, it } from 'vitest';

import { CommandCapture } from '../../../src/server/commands/command-capture.js';
import type { CommandLifecycleEvent } from '../../../src/shared/types/command.js';

describe('CommandCapture Workspace ownership', () => {
  it('keeps interrupted commands in the old session Workspace', () => {
    const times = [100, 150, 200, 240];
    const firstCapture = new CommandCapture(
      '/tmp/project',
      'workspace-one',
      () => times.shift() ?? 999,
    );
    const secondCapture = new CommandCapture(
      '/tmp/other-project',
      'workspace-two',
      () => times.shift() ?? 999,
    );
    const events: CommandLifecycleEvent[] = [];
    firstCapture.onEvent((event) => events.push(event));
    secondCapture.onEvent((event) => events.push(event));

    firstCapture.accept({ type: 'command.line', command: 'sleep 10' });
    firstCapture.accept({ type: 'command.start' });
    firstCapture.handleSessionExit(130);

    secondCapture.accept({ type: 'command.line', command: 'printf two' });
    secondCapture.accept({ type: 'command.start' });
    secondCapture.accept({ type: 'command.end', exitCode: 0 });

    expect(events).toHaveLength(4);
    expect(events[0]?.payload.workspaceId).toBe('workspace-one');
    expect(events[1]?.payload.workspaceId).toBe('workspace-one');
    expect(events[1]?.type).toBe('command.completed');
    expect(events[2]?.payload.workspaceId).toBe('workspace-two');
    expect(events[3]?.payload.workspaceId).toBe('workspace-two');
  });
});
