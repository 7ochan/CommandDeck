import { describe, expect, it } from 'vitest';

import { CommandCapture } from '../../../src/server/commands/command-capture.js';
import type { CommandLifecycleEvent } from '../../../src/shared/types/command.js';

describe('CommandCapture Workspace ownership', () => {
  it('snapshots the Workspace when a command starts', () => {
    const times = [100, 150, 200, 240];
    const capture = new CommandCapture(
      '/tmp/project',
      'workspace-one',
      () => times.shift() ?? 999,
    );
    const events: CommandLifecycleEvent[] = [];
    capture.onEvent((event) => events.push(event));

    capture.accept({ type: 'command.line', command: 'printf one' });
    capture.accept({ type: 'command.start' });
    capture.setWorkspace('workspace-two');
    capture.accept({ type: 'command.end', exitCode: 0 });

    capture.accept({ type: 'command.line', command: 'printf two' });
    capture.accept({ type: 'command.start' });
    capture.accept({ type: 'command.end', exitCode: 0 });

    expect(events).toHaveLength(4);
    expect(events[0]?.payload.workspaceId).toBe('workspace-one');
    expect(events[1]?.payload.workspaceId).toBe('workspace-one');
    expect(events[2]?.payload.workspaceId).toBe('workspace-two');
    expect(events[3]?.payload.workspaceId).toBe('workspace-two');
  });
});
