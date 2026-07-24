import { describe, expect, it } from 'vitest';

import {
  clearPendingTimelineExecution,
  loadPendingTimelineExecution,
  queuePendingTimelineExecution,
} from '../../../src/features/timeline/pending-execution.js';

describe('Timeline terminal execution handoff', () => {
  it('queues one workspace-scoped command and clears it after use', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    queuePendingTimelineExecution(
      { workspaceId: 'workspace-two', command: 'npm test' },
      storage,
    );
    expect(loadPendingTimelineExecution(storage)).toEqual({
      workspaceId: 'workspace-two',
      command: 'npm test',
    });

    clearPendingTimelineExecution(storage);
    expect(loadPendingTimelineExecution(storage)).toBeNull();
  });

  it('ignores malformed handoff data', () => {
    const storage = {
      getItem: () => '{"workspaceId":"workspace-one","command":"  "}',
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    expect(loadPendingTimelineExecution(storage)).toBeNull();
  });
});
