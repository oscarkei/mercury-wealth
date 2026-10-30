import {test} from 'node:test';
import assert from 'node:assert/strict';
import {geminiJSON} from '../src/lib/gemini-json.ts';
import {withGeminiModel} from '../src/lib/gemini-model-server.ts';
import {qwenBaseURL} from '../src/lib/qwen-json.ts';
import {ProviderError,publicProviderError} from '../src/lib/assistant-server.ts';

test('Qwen sends the selected task and schema to the approved endpoint and reads the model answer',async()=>{
 const previousKey=process.env.DASHSCOPE_API_KEY,previousURL=process.env.QWEN_BASE_URL,previousFetch=globalThis.fetch;
 process.env.DASHSCOPE_API_KEY='local-test-key';delete process.env.QWEN_BASE_URL;
 try{
  globalThis.fetch=async (input,init)=>{
   assert.equal(String(input),'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions');
   const request=JSON.parse(String(init?.body));assert.equal(request.model,'qwen3.7-flash');
   assert.equal(request.enable_thinking,true);assert.equal(request.response_format.type,'json_object');
   assert.match(request.messages[0].content,/schema/);assert.match(request.messages[1].content,/portfolio/);
   return Response.json({choices:[{finish_reason:'stop',message:{content:'{"reply":"answer"}'}}]});
  };
  const result=await withGeminiModel('qwen3.7-flash',()=>geminiJSON('Test',{task:'portfolio'},{type:'object'},new AbortController().signal));
  assert.equal(result.model,'qwen3.7-flash');assert.deepEqual(result.data,{reply:'answer'});
 }finally{globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.DASHSCOPE_API_KEY;else process.env.DASHSCOPE_API_KEY=previousKey;if(previousURL===undefined)delete process.env.QWEN_BASE_URL;else process.env.QWEN_BASE_URL=previousURL;}
});
test('Qwen provider diagnostics are actionable and never expose an upstream error or key',async()=>{
 const previousKey=process.env.DASHSCOPE_API_KEY,previousFetch=globalThis.fetch;process.env.DASHSCOPE_API_KEY='local-test-key';
 try{
  for(const [fetcher,expected] of [[async()=>{throw new Error('secret local-test-key');},'CONNECTION_FAILED'],[async()=>new Response('secret local-test-key',{status:400}),'BAD_REQUEST']] as const){
   globalThis.fetch=fetcher;
   try{await withGeminiModel('qwen3.7-flash',()=>geminiJSON('Test',{}, {},new AbortController().signal));assert.fail('Expected failure');}
   catch(error){const diagnostic=publicProviderError(error,new AbortController().signal);assert.equal(diagnostic.code,expected);assert.doesNotMatch(JSON.stringify(diagnostic),/local-test-key|secret/);}
  }
 }finally{globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.DASHSCOPE_API_KEY;else process.env.DASHSCOPE_API_KEY=previousKey;}
});
test('Qwen rejects unexpected hosts and incomplete or invalid JSON',async()=>{
 assert.throws(()=>qwenBaseURL('https://example.com/compatible-mode/v1'));
 assert.equal(qwenBaseURL('https://llm-demo.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1'),'https://llm-demo.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1');
 const previousKey=process.env.DASHSCOPE_API_KEY,previousURL=process.env.QWEN_BASE_URL,previousFetch=globalThis.fetch;process.env.DASHSCOPE_API_KEY='local-test-key';delete process.env.QWEN_BASE_URL;
 try{
  for(const [content,reason,code] of [['not JSON','stop','INVALID_JSON'],['{}','length','INCOMPLETE_RESPONSE']] as const){
   globalThis.fetch=async()=>Response.json({choices:[{finish_reason:reason,message:{content}}]});
   await assert.rejects(()=>withGeminiModel('qwen3.7-flash',()=>geminiJSON('Test',{}, {},new AbortController().signal)),(error:unknown)=>error instanceof ProviderError&&error.code===code);
  }
 }finally{globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.DASHSCOPE_API_KEY;else process.env.DASHSCOPE_API_KEY=previousKey;if(previousURL===undefined)delete process.env.QWEN_BASE_URL;else process.env.QWEN_BASE_URL=previousURL;}
});
