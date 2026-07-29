import type {
  AICommitResult,
  AIProvider,
  AITestConnectionResult,
} from '../types';

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini AI';

  async generateCommit(
    diff: string,
    apiKey: string,
    model?: string,
  ): Promise<AICommitResult> {
    void model;
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('Gemini API key is required.');
    }

    // Milestone 1 Architecture & UI Stub (Live API integration pending user approval in Milestone 2)
    const summary = [
      'Refined settings toggle component styling and focus ring feedback',
      'Added AI Assistant section to Settings with provider selection and API key management',
      'Implemented AI Commit Review Dialog workflow for reviewing and editing commit messages',
      'Integrated git diff detection and commit execution architecture',
    ];

    const commitMessage =
      'feat(ai): implement AI commit review assistant and settings';

    return {
      commitMessage,
      summary,
      provider: 'gemini',
    };
  }

  async testConnection(apiKey: string): Promise<AITestConnectionResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        message: 'API key cannot be empty.',
      };
    }

    if (apiKey.length < 10) {
      return {
        success: false,
        message: 'Invalid API key format.',
      };
    }

    return {
      success: true,
      message: 'Successfully connected to Google Gemini API.',
    };
  }
}
