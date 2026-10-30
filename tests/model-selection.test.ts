import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantInputSchema} from '../src/lib/assistant-contract.ts';
import {geminiJSON} from '../src/lib/gemini-json.ts';
import {withGeminiModel,currentGeminiModel} from '../src/lib/gemini-model-server.ts';
import {defaultGeminiModel} from '../src/lib/gemini-model.ts';

const input={requestId:'bcf4c0e7-f2fb-43df-bf4f-78df5564fb14',revision:1,message:'Compare stocks',context:'Public research',view:'overview',product:'phoenix',path:[100,98,96,94,97,95,92],history:[]};
test('default model is Qwen Flash and unrecognized models are rejected',()=>{
 assert.equal(defaultGeminiModel,'deepseek-flash');
 for(const geminiModel of ['gemini-3.1-flash-lite','gemini-3.6-flash'])assert.equal(assistantInputSchema.safeParse({...input,geminiModel}).success,true);
 for(const geminiModel of ['gemini-3.1-pro-preview','https://example.com','gemini-3.6-flash\nother'])assert.equal(assistantInputSchema.safeParse({...input,geminiModel}).success,false);
 assert.equal(assistantInputSchema.safeParse(input).success,true); // Old clients retain the configured server default.
});

test('overlapping conversations and nested tool calls retain their own model',async()=>{
 const originalFetch=globalThis.fetch,originalKey=process.env.GEMINI_API_KEY,originalModel=process.env.GEMINI_MODEL;
 const seen:{request:string;model:string}[]=[];
 process.env.GEMINI_API_KEY='synthetic-test-key';process.env.GEMINI_MODEL='configured-default';
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(String(options?.body));const request=JSON.parse(body.input).request;
  seen.push({request,model:body.model});
  await new Promise(resolve=>setTimeout(resolve,request.startsWith('a')?15:5));
  return Response.json({status:'completed',model:body.model,steps:[{type:'model_output',content:[{type:'text',text:'{"status":"ok"}'}]}]});
 };
 try{
  const run=(model:'gemini-3.1-flash-lite'|'gemini-3.6-flash',prefix:string)=>withGeminiModel(model,async()=>{
   await geminiJSON('test',{request:prefix+'1'},{type:'object'},new AbortController().signal);
   await Promise.resolve();
   await geminiJSON('test',{request:prefix+'2'},{type:'object'},new AbortController().signal);
  });
  await Promise.all([run('gemini-3.1-flash-lite','a'),run('gemini-3.6-flash','b')]);
  assert.equal(seen.length,4);
  for(const call of seen)assert.equal(call.model,call.request.startsWith('a')?'gemini-3.1-flash-lite':'gemini-3.6-flash');
  assert.equal(currentGeminiModel(),undefined);
  assert.equal(process.env.GEMINI_MODEL,'configured-default');
  await geminiJSON('test',{request:'default'},{type:'object'},new AbortController().signal);
  assert.equal(seen.at(-1)?.model,'configured-default');
 }finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;
  if(originalModel===undefined)delete process.env.GEMINI_MODEL;else process.env.GEMINI_MODEL=originalModel;
 }
});
