import { describe, expect, it } from 'vitest';
import { credentialStore } from '../../../src/server/ai/credential-store';

describe('CredentialStore', () => {
  it('persists credentials per provider without overwriting other providers', () => {
    credentialStore.set('gemini', 'AIza-test-gemini-key');
    credentialStore.set('openai', 'sk-test-openai-key');

    expect(credentialStore.get('gemini')).toBe('AIza-test-gemini-key');
    expect(credentialStore.get('openai')).toBe('sk-test-openai-key');
    expect(credentialStore.has('gemini')).toBe(true);
    expect(credentialStore.has('openai')).toBe(true);
  });

  it('deletes credential on set when given an empty or whitespace string', () => {
    credentialStore.set('gemini', 'AIza-valid-key');
    credentialStore.set('gemini', '   ');

    expect(credentialStore.get('gemini')).toBeUndefined();
    expect(credentialStore.has('gemini')).toBe(false);
  });
});
