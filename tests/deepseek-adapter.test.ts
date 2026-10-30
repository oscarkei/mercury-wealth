import {test} from 'node:test';
import assert from 'node:assert/strict';
import {geminiJSON} from '../src/lib/gemini-json.ts';
import {withGeminiModel} from '../src/lib/gemini-model-server.ts';
import {ProviderError} from '../src/lib/assistant-server.ts';

test('DeepSeek uses only the approved V4 Pro endpoint, thinking and JSON mode',async()=>{
 const previousKey=process.env.DEEPSEEK_API_KEY,previousFetch=globalThis.fetch;
 process.env.DEEPSEEK_API_KEY='synthetic-deepseek-key';
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(String(url),'https://api.deepseek.com/chat/completions');
   const request=JSON.parse(String(options?.body));
   assert.equal(request.model,'deepseek-flash');assert.equal(request.thinking.type,'enabled');assert.equal(request.response_format.type,'json_object');
   assert.match(request.messages[0].content,/schema/);assert.match(request.messages[1].content,/portfolio/);
   return Response.json({choices:[{finish_reason:'stop',message:{content:'{"reply":"answer"}'}}]});
  };
  const result=await withGeminiModel('deepseek-flash',()=>geminiJSON('Test',{task:'portfolio'},{type:'object'},new AbortController().signal));
  assert.equal(result.model,'deepseek-flash');assert.deepEqual(result.data,{reply:'answer'});
  globalThis.fetch=async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'not json'}}]});
  await assert.rejects(()=>withGeminiModel('deepseek-flash',()=>geminiJSON('Test',{}, {},new AbortController().signal)),(error:unknown)=>error instanceof ProviderError&&error.code==='INVALID_JSON');
 }finally{globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=previousKey;}
});
