import {AsyncLocalStorage} from 'node:async_hooks';
import type {GeminiModel} from './gemini-model.ts';

// A selection belongs to one request, including its parallel/async tool calls.
// Never mutate process.env: different sessions can choose different models.
const selectedModel=new AsyncLocalStorage<GeminiModel>();
export function withGeminiModel<T>(model:GeminiModel,callback:()=>T):T{
 return selectedModel.run(model,callback);
}
export function currentGeminiModel():GeminiModel|undefined{
 return selectedModel.getStore();
}
export function currentAIProvider():'Gemini'|'Qwen'|'DeepSeek'{const model=currentGeminiModel()||'gemini-3.6-flash';return model.startsWith('deepseek')?'DeepSeek':model.startsWith('qwen')?'Qwen':'Gemini';}
