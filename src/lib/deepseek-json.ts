import {ProviderError,hasCredential} from './assistant-server.ts';
import {wealthContext,wealthInstructions,currentWealthRuntime} from './wealth-runtime.ts';
import {AI_TIMEOUTS} from './ai-timeouts.ts';

export async function deepseekJSON(instruction:string,input:unknown,schema:object,signal:AbortSignal,maxTokens=1000,settings:{timeoutMs?:number;thinking?:'low'|'medium'|'high'}={}){
 const key=process.env.DEEPSEEK_API_KEY;if(!hasCredential(key))throw new ProviderError('NOT_CONFIGURED');
 const base='https://api.deepseek.com',started=Date.now(),thinking=settings.thinking||currentWealthRuntime()?.depth||'medium';
 const timeoutMs=settings.timeoutMs??AI_TIMEOUTS.explanation;
 const context=wealthContext();
 let response:Response;
 try{response=await fetch(base+'/chat/completions',{
  method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},redirect:'error',
  signal:AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]),
  body:JSON.stringify({model:'deepseek-flash',stream:false,thinking:{type:'enabled'},max_tokens:Math.max(maxTokens,thinking==='high'?12288:8192),
   response_format:{type:'json_object'},messages:[{role:'system',content:instruction+wealthInstructions()+'\nReturn JSON only. Follow this JSON schema exactly: '+JSON.stringify(schema)},
    {role:'user',content:JSON.stringify(context?{task:input,wealthContext:context}:input)}]})
 });}catch(error){if(signal.aborted||error instanceof DOMException&&error.name==='TimeoutError')throw error;throw new ProviderError('CONNECTION_FAILED');}
 if(!response.ok){const retry=response.headers.get('retry-after');await response.body?.cancel();throw new ProviderError('HTTP_ERROR',response.status,retry&&Number.isFinite(Number(retry))?Number(retry)*1000:undefined);}
 const body=await response.json(),choice=body.choices?.[0];
 if(!choice||choice.finish_reason==='length')throw new ProviderError('INCOMPLETE_RESPONSE');
 if(typeof choice.message?.content!=='string'||!choice.message.content.trim())throw new ProviderError('EMPTY_RESPONSE');
 let data:unknown;try{data=JSON.parse(choice.message.content);}catch{throw new ProviderError('INVALID_JSON');}
 return {data,model:'deepseek-flash',elapsed_ms:Date.now()-started,attempts:1,usage:body.usage||null,thinking};
}
