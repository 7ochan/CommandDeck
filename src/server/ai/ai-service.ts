import { AIProviderRegistry } from '../../features/ai/providers/ai-provider-registry';
import type {
  AICommitResult,
  AITestConnectionResult,
} from '../../features/ai/types';
import type { AIProviderId } from '../../shared/types';
import { getServerContainerIfInitialized } from '../runtime/server-container-registry';
import { credentialStore } from './credential-store';

class AIService {
  private static instance: AIService;

  private constructor() {}

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  setApiKey(provider: AIProviderId, key: string): void {
    if (!key || key.trim().length === 0) {
      return;
    }
    credentialStore.set(provider, key);
  }

  getApiKey(provider: AIProviderId): string | undefined {
    return credentialStore.get(provider);
  }

  hasApiKey(provider: AIProviderId): boolean {
    return credentialStore.has(provider);
  }

  getAllHasMap(): Record<string, boolean> {
    return credentialStore.getAllHasMap();
  }

  deleteApiKey(provider: AIProviderId): void {
    credentialStore.delete(provider);
  }

  async testConnection(
    providerId: AIProviderId,
    apiKeyOverride?: string,
  ): Promise<AITestConnectionResult> {
    const keyToTest = apiKeyOverride ?? this.getApiKey(providerId);
    if (!keyToTest && providerId !== 'ollama') {
      return {
        success: false,
        message: `No API key provided or configured for ${providerId}.`,
      };
    }

    const provider = AIProviderRegistry.getInstance().get(providerId);
    return provider.testConnection(keyToTest || '');
  }

  async generateCommitMessage(
    providerId: AIProviderId,
    diff: string,
    apiKeyOverride?: string,
    modelOverride?: string,
  ): Promise<AICommitResult> {
    const apiKey = apiKeyOverride ?? this.getApiKey(providerId);
    if (!apiKey && providerId !== 'ollama') {
      throw new Error(
        `API key for ${providerId} is missing. Please configure it in Settings -> AI Assistant.`,
      );
    }

    const container = getServerContainerIfInitialized();
    const snapshotModel =
      container?.settingsService.getSnapshot().settings.ai.model;
    const model = modelOverride ?? snapshotModel ?? 'gemini-2.0-flash';

    const provider = AIProviderRegistry.getInstance().get(providerId);
    return provider.generateCommit(diff, apiKey || '', model);
  }
}

export const aiService = AIService.getInstance();
