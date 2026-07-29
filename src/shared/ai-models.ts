export type AIModelOption = {
  id: string;
  name: string;
  description: string;
  isRecommended?: boolean;
};

export const GEMINI_MODELS: AIModelOption[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Fast & recommended for commit messages',
    isRecommended: true,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Standard fast model',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'High capacity model',
  },
];

export const OPENAI_MODELS: AIModelOption[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast & recommended for commit messages',
    isRecommended: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'High intelligence flagship model',
  },
  {
    id: 'gpt-4.5-preview',
    name: 'GPT-4.5 Preview',
    description: 'Next-gen flagship model preview',
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    description: 'Reasoning model optimized for code',
  },
  {
    id: 'o1',
    name: 'o1',
    description: 'Advanced reasoning model',
  },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export const SUPPORTED_AI_MODEL_IDS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4.5-preview',
  'o3-mini',
  'o1',
] as const;

export type SupportedAIModelId = (typeof SUPPORTED_AI_MODEL_IDS)[number];

export function getDefaultModelForProvider(
  provider: 'gemini' | 'openai' | string,
): string {
  if (provider === 'openai') {
    return DEFAULT_OPENAI_MODEL;
  }
  return DEFAULT_GEMINI_MODEL;
}
