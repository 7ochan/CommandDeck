import type { AIProviderId } from '@/shared/types';
import type { AIProvider } from '../types';
import { GeminiProvider } from './gemini-provider';
import { OpenAIProvider } from './openai-provider';

export class AIProviderRegistry {
  private static instance: AIProviderRegistry;
  private providers = new Map<AIProviderId, AIProvider>();

  private constructor() {
    this.register(new GeminiProvider());
    this.register(new OpenAIProvider());
  }

  static getInstance(): AIProviderRegistry {
    if (!AIProviderRegistry.instance) {
      AIProviderRegistry.instance = new AIProviderRegistry();
    }
    return AIProviderRegistry.instance;
  }

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(providerId: AIProviderId): AIProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`AI Provider "${providerId}" is not registered.`);
    }
    return provider;
  }

  listProviders(): Array<{ id: AIProviderId; name: string }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
    }));
  }
}
