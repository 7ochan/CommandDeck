import { prepareDiffForAI } from '../diff-preparation';
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
    model: string = 'gemini-2.5-flash',
  ): Promise<AICommitResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        'Gemini API key is missing. Please configure it in Settings -> AI Assistant.',
      );
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    const prepared = prepareDiffForAI(diff);

    const promptText = `You are a principal software engineer and Git Commit Assistant. Analyze the provided codebase changes and determine the high-level intent, feature domain, and architectural impact of the change.

Guidelines:
1. Understand INTENT: Explain WHY and WHAT was achieved, rather than listing mechanical code edits (e.g. "added line 5").
2. CONVENTIONAL COMMITS: Generate a clear, professional Conventional Commit title formatted as \`<type>(<scope>): <short description>\` (e.g. \`feat(settings): add AI provider configuration section\` or \`fix(terminal): resolve cursor blinking regression\`).
3. FORBID VAGUE MESSAGES: NEVER output generic or unhelpful titles like "update files", "misc changes", "fix bug", "changes made", or "update code".
4. SUMMARY: Provide 3 to 6 concise, high-value bullet points summarizing the purpose and key modifications.
${prepared.isTruncated ? '5. NOTE: The git diff was very large, so repository change statistics, changed file list, and representative diff samples have been provided below.' : ''}

Return strictly valid JSON matching this exact schema:
{
  "summary": ["bullet point 1", "bullet point 2"],
  "commitMessage": "feat(scope): concise title"
}

Code Base Changes (${prepared.isTruncated ? 'Intelligently Summarized' : 'Complete Diff'}):
${prepared.preparedDiff}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const status = response.status;
        const msg = errorData?.error?.message || response.statusText;

        if (status === 400 || status === 403 || msg.includes('API_KEY')) {
          throw new Error(
            'Invalid Google Gemini API key. Please check your key in Settings -> AI Assistant.',
          );
        }
        if (status === 429) {
          throw new Error(
            'Google Gemini API rate limit reached. Please wait a moment and try again.',
          );
        }
        throw new Error(`Google Gemini API error (${status}): ${msg}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('Gemini API returned an empty response.');
      }

      const parsed = JSON.parse(rawText);

      const summary = Array.isArray(parsed.summary)
        ? parsed.summary.map(String)
        : ['Updated workspace files and code implementation'];

      const commitMessage =
        typeof parsed.commitMessage === 'string' && parsed.commitMessage.trim()
          ? parsed.commitMessage.trim()
          : 'chore: update codebase changes';

      return {
        summary,
        commitMessage,
        provider: 'gemini',
      };
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(
        'Failed to connect to Google Gemini API. Please check your network connection.',
      );
    }
  }

  async testConnection(apiKey: string): Promise<AITestConnectionResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        message: 'API key cannot be empty.',
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${encodeURIComponent(
      apiKey.trim(),
    )}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Connected successfully to Google Gemini API.',
        };
      }

      const data = await response.json().catch(() => null);
      const message =
        data?.error?.message ||
        `Connection failed with status ${response.status}.`;

      return {
        success: false,
        message,
      };
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : 'Failed to reach Google Gemini API.',
      };
    }
  }
}
