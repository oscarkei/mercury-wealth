import {ProviderError,hasCredential} from './assistant-server.ts';
import {wealthContext,wealthInstructions,currentWealthRuntime} from './wealth-runtime.ts';
import {AI_TIMEOUTS} from './ai-timeouts.ts';

// The key is sent only to Alibaba's documented Model Studio hosts.
export function qwenBaseURL(value=process.env.QWEN_BASE_URL||'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'){
 let url:URL;try{url=new URL(value);}catch{throw new ProviderError('INVALID_ENDPOINT');}
 const legacy=['dashscope-intl.aliyuncs.com','dashscope.aliyuncs.com'].includes(url.hostname);
 const workspace=/^[a-z0-9-]+\.(ap-southeast-1|cn-beijing|cn-hongkong)\.maas\.aliyuncs\.com$/.test(url.hostname);
 if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||url.pathname.replace(/\/$/,'')!=='/compatible-mode/v1'||!(legacy||workspace))throw new ProviderError('INVALID_ENDPOINT');
 return url.origin+'/compatible-mode/v1';
}
export async function qwenJSON(instruction:string,input:unknown,schema:object,signal:AbortSignal,maxTokens=1000,settings:{timeoutMs?:number;thinking?:'low'|'medium'|'high'}={}){
 const key=process.env.DASHSCOPE_API_KEY;if(!hasCredential(key))throw new ProviderError('NOT_CONFIGURED');
 const base=qwenBaseURL(),started=Date.now(),thinking=settings.thinking||currentWealthRuntime()?.depth||'medium';
 const timeoutMs=settings.timeoutMs??AI_TIMEOUTS.explanation;
 const context=wealthContext();
 let response:Response;
 try{response=await fetch(base+'/chat/completions',{
  method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},redirect:'error',
  signal:AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]),
  body:JSON.stringify({model:'qwen3.7-flash',stream:false,enable_thinking:true,max_tokens:Math.max(maxTokens,thinking==='high'?12288:8192),
   response_format:{type:'json_object'},messages:[{role:'system',content:instruction+wealthInstructions()+'\nReturn JSON only. Follow this JSON schema exactly: '+JSON.stringify(schema)},
    {role:'user',content:JSON.stringify(context?{task:input,wealthContext:context}:input)}]})
 });}catch(error){if(signal.aborted||error instanceof DOMException&&error.name==='TimeoutError')throw error;throw new ProviderError('CONNECTION_FAILED');}
 if(!response.ok){const retry=response.headers.get('retry-after');await response.body?.cancel();throw new ProviderError('HTTP_ERROR',response.status,retry&&Number.isFinite(Number(retry))?Number(retry)*1000:undefined);}
 const body=await response.json(),choice=body.choices?.[0];
 if(!choice||choice.finish_reason==='length')throw new ProviderError('INCOMPLETE_RESPONSE');
 if(typeof choice.message?.content!=='string'||!choice.message.content.trim())throw new ProviderError('EMPTY_RESPONSE');
 let data:unknown;try{data=JSON.parse(choice.message.content);}catch{throw new ProviderError('INVALID_JSON');}
 return {data,model:'qwen3.7-flash',elapsed_ms:Date.now()-started,attempts:1,usage:body.usage||null,thinking};
}
