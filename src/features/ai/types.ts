import type { AIProviderId } from '@/shared/types';

export type AICommitRequest = {
  diff: string;
  workspacePath?: string;
};

export type AICommitResult = {
  commitMessage: string;
  summary: string[];
  provider: AIProviderId;
};

export type AITestConnectionResult = {
  success: boolean;
  message: string;
};

export interface AIProvider {
  id: AIProviderId;
  name: string;
  generateCommit(
    diff: string,
    apiKey: string,
    model?: string,
  ): Promise<AICommitResult>;
  testConnection(apiKey: string): Promise<AITestConnectionResult>;
}
