import {z} from 'zod';

// Models selectable in the portal. Keep provider IDs server-validated.
export const geminiModels=['gemini-3.1-flash-lite','gemini-3.6-flash','qwen3.7-plus','qwen3.7-flash','deepseek-flash'] as const;
export const geminiModelSchema=z.enum(geminiModels);
export type GeminiModel=z.infer<typeof geminiModelSchema>;
export const defaultGeminiModel:GeminiModel='deepseek-flash';
export const geminiModelLabels:Record<GeminiModel,string>={
 'gemini-3.1-flash-lite':'3.1 Flash-Lite',
 'gemini-3.6-flash':'3.6 Flash',
 'qwen3.7-plus':'Qwen 3.7 Plus',
 'qwen3.7-flash':'Qwen 3.7 Flash',
 'deepseek-flash':'DeepSeek Flash',
};
