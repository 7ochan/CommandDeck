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
    model: string = 'gemini-2.0-flash',
  ): Promise<AICommitResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        'Gemini API key is missing. Please configure it in Settings -> AI Assistant.',
      );
    }

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

    const sanitizedKey = apiKey.trim();
    const maskedKey =
      sanitizedKey.length > 8
        ? `${sanitizedKey.slice(0, 4)}...${sanitizedKey.slice(-4)}`
        : 'HIDDEN';

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(sanitizedKey)}`;

    console.log(`[GeminiProvider] Dispatching EXACTLY ONE generateContent request:
- Model: ${model}
- Endpoint: https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${maskedKey}
- Prompt Length: ${promptText.length} chars`);

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

    const headersObj: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      headersObj[key] = val;
    });

    const rawTextBody = await response.text();
    let errorData: {
      error?: { code?: number; status?: string; message?: string };
    } | null = null;
    try {
      errorData = JSON.parse(rawTextBody) as {
        error?: { code?: number; status?: string; message?: string };
      };
    } catch {
      errorData = null;
    }

    if (!response.ok) {
      console.error(`[GeminiProvider] RAW API FAILURE RESPONSE:
==================================================
HTTP Status: ${response.status} ${response.statusText}
Endpoint Model: ${model}
Headers: ${JSON.stringify(headersObj, null, 2)}
Raw Response Body: ${rawTextBody}
Gemini Error Object: ${JSON.stringify(errorData?.error, null, 2)}
error.code: ${errorData?.error?.code}
error.status: ${errorData?.error?.status}
error.message: ${errorData?.error?.message}
==================================================`);

      const status = response.status;
      const msg = errorData?.error?.message || response.statusText;

      if (
        status === 404 ||
        msg.toLowerCase().includes('not found') ||
        msg.toLowerCase().includes('no longer available')
      ) {
        throw new Error(
          `The selected Gemini model (${model}) is no longer available. Please select a supported model in AI Settings or click 'Switch to Recommended Model'.`,
        );
      }

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

    let parsed: {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    } | null = null;
    try {
      parsed = JSON.parse(rawTextBody) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
    } catch (jsonErr) {
      console.error(
        `[GeminiProvider] Failed to parse JSON response body: ${rawTextBody}`,
        jsonErr,
      );
      throw new Error('Gemini API returned invalid JSON.');
    }

    const rawText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Gemini API returned an empty response.');
    }

    const parsedCommit = JSON.parse(rawText);

    const summary = Array.isArray(parsedCommit.summary)
      ? parsedCommit.summary.map(String)
      : ['Updated workspace files and code implementation'];

    const commitMessage =
      typeof parsedCommit.commitMessage === 'string' &&
      parsedCommit.commitMessage.trim()
        ? parsedCommit.commitMessage.trim()
        : 'chore: update codebase changes';

    return {
      summary,
      commitMessage,
      provider: 'gemini',
      modelUsed: model,
    };
  }

  async testConnection(apiKey: string): Promise<AITestConnectionResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        message: 'API key cannot be empty.',
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=${encodeURIComponent(
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
          message:
            'Connected successfully to Google Gemini API (gemini-2.0-flash).',
        };
      }

      const data = await response.json().catch(() => null);
      const status = response.status;
      if (status === 400 || status === 403) {
        return {
          success: false,
          message:
            'Invalid Google Gemini API key. Please check your key in Settings -> AI Assistant.',
        };
      }

      return {
        success: false,
        message: data?.error?.message || `Connection test failed (${status}).`,
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
