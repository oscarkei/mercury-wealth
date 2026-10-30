import test from 'node:test';
import assert from 'node:assert/strict';
import {runStockAnalysis} from '../src/lib/stock-engine.ts';
import {withWealthRuntime} from '../src/lib/wealth-runtime.ts';
import {withGeminiModel} from '../src/lib/gemini-model-server.ts';
import {normalizeAnalysisPlan} from '../src/lib/analysis-planner.ts';
import type {AssistantInput,AssistantEvent} from '../src/lib/assistant-contract.ts';
import type {StockAnalysis} from '../src/lib/stock-contract.ts';
test('elaborating an existing stock chart reuses its exact observations without another market request',async()=>{
 const input:AssistantInput={requestId:'bcf4c0e7-f2fb-43df-bf4f-78df5564fb14',revision:1,message:'Can you explain more?',context:'Public research',view:'insights',product:'phoenix',path:[100,100,100,100,100,100,100],history:[],stockContext:{symbol:'XLE',range:'6mo'}};
 const prior:StockAnalysis={kind:'stocks',range:'6mo',data:{query:'XLE',retrievedAt:'2026-10-30T10:00:00Z',results:[],warnings:[],quote:{symbol:'XLE',name:'Energy ETF',exchange:'NYSEArca',currency:'USD',price:110,quoteTime:1793318400,points:[{time:1793232000,close:100,volume:null},{time:1793318400,close:110,volume:null}]}},modules:['price_history'],composer:{provider:'Local',model:'test',elapsed_ms:0},plannerModel:'deepseek-flash'};
 const plan=normalizeAnalysisPlan({workflow:'stocks',tools:['yahoo_finance'],goal:'Explain chart',analysisQuestions:['Explain chart'],stockQuery:'XLE',stockRange:'6mo'},input);
 const original=globalThis.fetch,key=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY='synthetic-test';let calls=0;const events:Partial<AssistantEvent>[]=[];
 try{globalThis.fetch=async url=>{assert.equal(String(url),'https://api.deepseek.com/chat/completions');calls++;return Response.json({choices:[{finish_reason:'stop',message:{content:'{"reply":"This is the same observed price path, not a total-return series."}'}}]});};
 await withGeminiModel('deepseek-flash',()=>withWealthRuntime({input,state:{topics:[{kind:'stock_analysis',question:'XLE',result:prior,updatedAt:Date.now()}]},skills:[],depth:'medium'},()=>runStockAnalysis(input,plan,'deepseek-flash',new AbortController().signal,e=>events.push(e))));
 assert.equal(calls,1);assert.deepEqual(events.find(e=>e.type==='stock_analysis')?.stockAnalysis?.data,prior.data);assert.ok(!events.some(e=>e.stage==='stock_data'));
 }finally{globalThis.fetch=original;if(key===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=key;}
});
