import { prepareDiffForAI } from '../diff-preparation';
import type {
  AICommitResult,
  AIProvider,
  AITestConnectionResult,
} from '../types';

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';

  async generateCommit(
    diff: string,
    apiKey: string,
    model: string = 'gpt-4o-mini',
  ): Promise<AICommitResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        'OpenAI API key is missing. Please configure it in Settings -> AI Assistant.',
      );
    }

    const prepared = prepareDiffForAI(diff);

    const systemPrompt = `You are a principal software engineer and Git Commit Assistant. Analyze the provided codebase changes and determine the high-level intent, feature domain, and architectural impact of the change.

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
}`;

    const userPrompt = `Code Base Changes (${prepared.isTruncated ? 'Intelligently Summarized' : 'Complete Diff'}):\n${prepared.preparedDiff}`;

    const sanitizedKey = apiKey.trim();
    const maskedKey =
      sanitizedKey.length > 8
        ? `${sanitizedKey.slice(0, 4)}...${sanitizedKey.slice(-4)}`
        : 'HIDDEN';

    console.log(`[OpenAIProvider] Dispatching chat/completions request:
- Model: ${model}
- API Key: ${maskedKey}
- Prompt Length: ${userPrompt.length} chars`);

    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sanitizedKey}`,
          },
          body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            temperature: 0.2,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
        },
      );

      const headersObj: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        headersObj[key] = val;
      });

      const rawTextBody = await response.text();
      let errorData: {
        error?: { message?: string; type?: string; code?: string };
      } | null = null;
      try {
        errorData = JSON.parse(rawTextBody) as {
          error?: { message?: string; type?: string; code?: string };
        };
      } catch {
        errorData = null;
      }

      if (!response.ok) {
        console.error(`[OpenAIProvider] RAW API FAILURE RESPONSE:
==================================================
HTTP Status: ${response.status} ${response.statusText}
Model: ${model}
Headers: ${JSON.stringify(headersObj, null, 2)}
Raw Response Body: ${rawTextBody}
Error Object: ${JSON.stringify(errorData?.error, null, 2)}
==================================================`);

        const status = response.status;
        const msg = errorData?.error?.message || response.statusText;

        if (status === 401) {
          throw new Error(
            'Invalid OpenAI API key. Please check your key in Settings -> AI Assistant.',
          );
        }

        if (status === 429) {
          throw new Error(
            'OpenAI API rate limit or quota exceeded. Please check your account plan and billing details.',
          );
        }

        if (status === 404) {
          throw new Error(
            `The selected OpenAI model (${model}) is not available or supported. Please select another model in AI Settings.`,
          );
        }

        throw new Error(`OpenAI API error (${status}): ${msg}`);
      }

      let parsed: {
        choices?: Array<{
          message?: { content?: string };
        }>;
      } | null = null;

      try {
        parsed = JSON.parse(rawTextBody) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
      } catch (jsonErr) {
        console.error(
          `[OpenAIProvider] Failed to parse JSON response body: ${rawTextBody}`,
          jsonErr,
        );
        throw new Error('OpenAI API returned invalid JSON.');
      }

      const content = parsed?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI API returned an empty response content.');
      }

      const parsedCommit = JSON.parse(content);

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
        provider: 'openai',
        modelUsed: model,
      };
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(
        'Failed to connect to OpenAI API. Please check your network connection.',
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

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Connected successfully to OpenAI API.',
        };
      }

      const data = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (response.status === 401) {
        return {
          success: false,
          message:
            'Invalid OpenAI API key. Please check your key in Settings -> AI Assistant.',
        };
      }

      return {
        success: false,
        message:
          data?.error?.message ||
          `OpenAI connection test failed (${response.status}).`,
      };
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error ? err.message : 'Failed to reach OpenAI API.',
      };
    }
  }
}
