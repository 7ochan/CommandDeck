import { describe, expect, it, vi } from 'vitest';

import { copyCommandText } from '../../../src/features/command-cards/clipboard.js';

describe('copyCommandText', () => {
  it('copies only the exact command text', async () => {
    const writeText = vi
      .fn<(value: string) => Promise<void>>()
      .mockResolvedValue();
    const command = "printf 'first'\nprintf 'second'";

    await copyCommandText(command, { writeText });

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith(command);
  });
});
