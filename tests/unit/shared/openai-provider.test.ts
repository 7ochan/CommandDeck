import { describe, expect, it } from 'vitest';
import { OpenAIProvider } from '../../../src/features/ai/providers/openai-provider';

describe('OpenAIProvider', () => {
  it('has correct id and name', () => {
    const provider = new OpenAIProvider();
    expect(provider.id).toBe('openai');
    expect(provider.name).toBe('OpenAI');
  });

  it('throws error when API key is missing', async () => {
    const provider = new OpenAIProvider();
    await expect(provider.generateCommit('diff content', '')).rejects.toThrow(
      'OpenAI API key is missing',
    );
  });

  it('fails testConnection when API key is empty', async () => {
    const provider = new OpenAIProvider();
    const result = await provider.testConnection('');
    expect(result.success).toBe(false);
    expect(result.message).toContain('cannot be empty');
  });
});
