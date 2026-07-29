import { prepareDiffForAI } from '../diff-preparation';
import type {
  AICommitResult,
  AIProvider,
  AITestConnectionResult,
} from '../types';

const RECOMMENDED_FALLBACK_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

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

    // Try requested model first, then fallback models if 404 occurs
    const targetModels = [
      model,
      ...RECOMMENDED_FALLBACK_MODELS.filter((m) => m !== model),
    ];

    let lastErrorMsg = '';
    let usedFallback = false;
    let actualModelUsed = model;

    for (const currentModel of targetModels) {
      const sanitizedKey = apiKey.trim();
      const maskedKey = sanitizedKey.length > 8 ? `${sanitizedKey.slice(0, 4)}...${sanitizedKey.slice(-4)}` : 'HIDDEN';

      console.log(`[GeminiProvider] Dispatching request:
- Model: ${currentModel}
- Endpoint: https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${maskedKey}
- Target Models Array: ${JSON.stringify(targetModels)}
- Prompt Length: ${promptText.length} chars`);

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

        const headersObj: Record<string, string> = {};
        response.headers.forEach((val, key) => {
          headersObj[key] = val;
        });

        const rawTextBody = await response.text();
        let errorData: any = null;
        try {
          errorData = JSON.parse(rawTextBody);
        } catch {
          errorData = null;
        }

        if (!response.ok) {
          console.error(`[GeminiProvider] RAW API FAILURE RESPONSE:
==================================================
HTTP Status: ${response.status} ${response.statusText}
Endpoint Model: ${currentModel}
Headers: ${JSON.stringify(headersObj, null, 2)}
Raw Response Body: ${rawTextBody}
Gemini Error Object: ${JSON.stringify(errorData?.error, null, 2)}
error.code: ${errorData?.error?.code}
error.status: ${errorData?.error?.status}
error.message: ${errorData?.error?.message}
==================================================`);

          const status = response.status;
          const msg = errorData?.error?.message || response.statusText;

          // If model not found or no longer available, attempt fallback model
          if (
            status === 404 ||
            msg.toLowerCase().includes('not found') ||
            msg.toLowerCase().includes('no longer available')
          ) {
            lastErrorMsg = `The selected Gemini model (${currentModel}) is no longer available. Please choose another model in AI Settings.`;
            usedFallback = true;
            continue; // try next fallback model in loop
          }

          if (status === 400 || status === 403 || msg.includes('API_KEY')) {
            throw new Error(
              `Google Gemini API Error (${status}): ${msg}`,
            );
          }

          if (status === 429) {
            throw new Error(
              `Google Gemini API Rate Limit Reached (${status}): ${msg}`,
            );
          }

          throw new Error(
            `Google Gemini API Error (${status}): ${msg || 'Service temporarily unavailable'}`,
          );
        }

        let parsed: any = null;
        try {
          parsed = JSON.parse(rawTextBody);
        } catch (jsonErr) {
          console.error(`[GeminiProvider] Failed to parse JSON response body: ${rawTextBody}`, jsonErr);
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

        actualModelUsed = currentModel;

        return {
          summary,
          commitMessage,
          provider: 'gemini',
          modelUsed: actualModelUsed,
          fallbackNotice: usedFallback
            ? `Selected model (${model}) was unavailable. Automatically generated using ${actualModelUsed}.`
            : undefined,
        };
      } catch (err) {
        if (
          err instanceof Error &&
          !err.message.includes('no longer available')
        ) {
          throw err;
        }
      }
    }

    throw new Error(
      lastErrorMsg ||
        `The selected Gemini model (${model}) is no longer available. Please choose another model in AI Settings.`,
    );
  }

  async testConnection(apiKey: string): Promise<AITestConnectionResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        message: 'API key cannot be empty.',
      };
    }

    for (const testModel of RECOMMENDED_FALLBACK_MODELS) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(testModel)}?key=${encodeURIComponent(
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
            message: `Connected successfully to Google Gemini API (using ${testModel}).`,
          };
        }

        void response.json().catch(() => null);
        const status = response.status;
        if (status === 400 || status === 403) {
          return {
            success: false,
            message:
              'Invalid Google Gemini API key. Please check your key in Settings -> AI Assistant.',
          };
        }
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

    return {
      success: false,
      message:
        'Unable to reach Google Gemini API. Please check your network connection.',
    };
  }
}
