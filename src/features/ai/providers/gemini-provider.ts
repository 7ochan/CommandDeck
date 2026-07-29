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

    const promptText = `You are a senior software engineer and Git Commit assistant. Analyze the provided git diff and generate:
1. A concise summary (3 to 6 bullet points) explaining the intent and key changes.
2. A professional Conventional Commit message (e.g. feat(scope): title or fix(scope): title).

Return strictly valid JSON matching this schema:
{
  "summary": ["bullet point 1", "bullet point 2"],
  "commitMessage": "feat(scope): concise title"
}

Git Diff:
${diff.slice(0, 20_000)}`;

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
