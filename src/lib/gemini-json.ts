import {wealthInstructions,wealthContext,currentWealthRuntime} from './wealth-runtime.ts';
import {hasCredential,ProviderError} from './assistant-server.ts';
import {AI_TIMEOUTS} from './ai-timeouts.ts';
import {currentGeminiModel} from './gemini-model-server.ts';
import {defaultGeminiModel} from './gemini-model.ts';
import {qwenJSON} from './qwen-json.ts';
import {deepseekJSON} from './deepseek-json.ts';
type GeminiOptions={timeoutMs?:number;attemptTimeoutMs?:number;onRetry?:(delayMs:number)=>void;thinking?:'low'|'medium'|'high'};
export function retryFitsBudget(remainingMs:number,delayMs:number,attemptMs:number){return remainingMs>=delayMs+attemptMs+100;}
function retryable(error:unknown){
 if(error instanceof ProviderError)return [408,500,502,503,504].includes(error.status||0);
 for(let depth=0;depth<5&&error instanceof Error;depth++,error=error.cause){
  if(['TimeoutError','APITimeoutError'].includes(error.name))return true;
  if('code' in error&&['ECONNRESET','ETIMEDOUT','UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT'].includes(String(error.code)))return true;
 }
 return false;
}
async function pause(ms:number,signal:AbortSignal){
 signal.throwIfAborted();
 await new Promise<void>((resolve,reject)=>{
  const cancel=()=>{clearTimeout(timer);reject(signal.reason);};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);
  signal.addEventListener('abort',cancel,{once:true});
 });
}
export async function geminiJSON(instruction:string,input:unknown,schema:object,signal:AbortSignal,maxTokens=1000,settings:GeminiOptions={}){
 if(currentGeminiModel()==='deepseek-flash')return deepseekJSON(instruction,input,schema,signal,maxTokens,settings);
 if((currentGeminiModel()||'gemini-3.6-flash').startsWith('qwen'))return qwenJSON(instruction,input,schema,signal,maxTokens,settings);
 if(!hasCredential(process.env.GEMINI_API_KEY))throw new ProviderError('NOT_CONFIGURED');
 const model=currentGeminiModel()||process.env.GEMINI_MODEL||'gemini-3.6-flash';if(!/^[A-Za-z0-9_.-]+$/.test(model))throw new ProviderError('INVALID_MODEL');
 const start=Date.now(),timeoutMs=settings.timeoutMs??AI_TIMEOUTS.explanation;
 const deadline=AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]);
 const thinking=settings.thinking||(maxTokens<=650?'low':currentWealthRuntime()?.depth||'medium');
 const budget=Math.max(maxTokens,thinking==='high'?12288:thinking==='medium'?8192:2048);
 const context=wealthContext();
 const options={method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY!},body:JSON.stringify({model,store:false,system_instruction:instruction+wealthInstructions(),input:JSON.stringify(context?{task:input,wealthContext:context}:input),generation_config:{max_output_tokens:budget,thinking_level:thinking},response_format:{type:'text',mime_type:'application/json',schema}})};
 for(let attempt=1;attempt<=2;attempt++){
  deadline.throwIfAborted();
  const remaining=timeoutMs-(Date.now()-start);
  const attemptSignal=AbortSignal.any([deadline,AbortSignal.timeout(Math.max(1,Math.min(remaining,settings.attemptTimeoutMs??AI_TIMEOUTS.explanationAttempt)))]);
  try{
   const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{...options,signal:attemptSignal});
   if(!response.ok){
    if(response.status===429){
     const body=await response.json().catch(()=>null);
     const details=Array.isArray(body?.error?.details)?body.error.details:[];
     const violations=details.flatMap((d:{violations?:unknown[]}|null)=>Array.isArray(d?.violations)?d.violations:[]);
     const daily=body?.error?.code==='quota_exceeded'||violations.some((v:{quotaId?:string;quotaMetric?:string})=>/per.?day|daily/i.test((v.quotaId||'')+' '+(v.quotaMetric||'')));
     throw new ProviderError(daily?'DAILY_QUOTA':'HTTP_ERROR',429);
    }
    const retryAfter=response.headers.get('retry-after');
    const delay=retryAfter?(Number.isFinite(Number(retryAfter))?Math.max(0,Number(retryAfter)*1000):Math.max(0,Date.parse(retryAfter)-Date.now())):undefined;
    await response.body?.cancel();throw new ProviderError('HTTP_ERROR',response.status,Number.isFinite(delay)?delay:undefined);
   }
   const body=await response.json();if(body.status!=='completed'||!Array.isArray(body.steps))throw new ProviderError('INCOMPLETE_RESPONSE');
   const text=body.steps.filter((s:{type:string})=>s.type==='model_output').flatMap((s:{content:unknown[]})=>Array.isArray(s.content)?s.content:[]).filter((p:{type:string;text?:string})=>p.type==='text'&&typeof p.text==='string').map((p:{text:string})=>p.text).join('');
   if(!text)throw new ProviderError('EMPTY_RESPONSE');
   return {data:JSON.parse(text),model:typeof body.model==='string'?body.model:model,elapsed_ms:Date.now()-start,attempts:attempt,usage:body.usage||null,thinking};
  }catch(error){
   if(deadline.aborted)throw deadline.reason;
   const delayMs=error instanceof ProviderError&&error.retryAfterMs!==undefined?error.retryAfterMs:600+Math.floor(Math.random()*300);
   const nextAttempt=settings.attemptTimeoutMs??AI_TIMEOUTS.explanationAttempt;
   if(attempt===2||!retryable(error)||!retryFitsBudget(timeoutMs-(Date.now()-start),delayMs,nextAttempt))throw error;
   settings.onRetry?.(delayMs);
   // Respect provider cooldown; one bounded retry, never quota/auth/billing errors.
   await pause(delayMs,deadline);
  }
 }
 throw new ProviderError('PROVIDER_FAILED');
}
