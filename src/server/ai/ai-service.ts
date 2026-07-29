import { AIProviderRegistry } from '../../features/ai/providers/ai-provider-registry';
import type {
  AICommitResult,
  AITestConnectionResult,
} from '../../features/ai/types';
import type { AIProviderId } from '../../shared/types';

class AIService {
  private static instance: AIService;
  private apiKeys = new Map<AIProviderId, string>();

  private constructor() {}

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  setApiKey(provider: AIProviderId, key: string): void {
    if (!key || key.trim().length === 0) {
      this.apiKeys.delete(provider);
    } else {
      this.apiKeys.set(provider, key.trim());
    }
  }

  getApiKey(provider: AIProviderId): string | undefined {
    return this.apiKeys.get(provider);
  }

  hasApiKey(provider: AIProviderId): boolean {
    const key = this.apiKeys.get(provider);
    return Boolean(key && key.trim().length > 0);
  }

  async testConnection(
    providerId: AIProviderId,
    apiKey?: string,
  ): Promise<AITestConnectionResult> {
    const keyToTest = apiKey ?? this.getApiKey(providerId);
    if (!keyToTest) {
      return {
        success: false,
        message: 'No API key configured.',
      };
    }

    const provider = AIProviderRegistry.getInstance().get(providerId);
    return provider.testConnection(keyToTest);
  }

  async generateCommitMessage(
    providerId: AIProviderId,
    diff: string,
    apiKeyOverride?: string,
  ): Promise<AICommitResult> {
    const apiKey = apiKeyOverride ?? this.getApiKey(providerId);
    if (!apiKey) {
      throw new Error(
        `API key for ${providerId} is missing. Please configure it in Settings -> AI Assistant.`,
      );
    }

    const provider = AIProviderRegistry.getInstance().get(providerId);
    return provider.generateCommit(diff, apiKey);
  }
}

export const aiService = AIService.getInstance();
