import test from 'node:test';
import assert from 'node:assert/strict';
import {executeResearch} from '../src/lib/research-engine.ts';
import {publicProviderError} from '../src/lib/assistant-server.ts';
import {StageFailure} from '../src/lib/analysis-stage.ts';
const plan={task:'history' as const,symbols:['XLE'],includeVolume:false,startDate:'2026-01-01',endDate:'2026-10-29',objective:'min_variance' as const,cashPct:10,maxAssetPct:60,capital:1000000,costBps:10};
test('an offline local research worker is not reported as an invalid model answer',async()=>{
 const original=globalThis.fetch,oldRoot=process.env.FINANCE_BASE_URL,oldKey=process.env.FINANCE_API_KEY;
 process.env.FINANCE_BASE_URL='http://127.0.0.1:8890';process.env.FINANCE_API_KEY='synthetic-key';
 try{globalThis.fetch=async()=>{throw new TypeError('fetch failed',{cause:Object.assign(new Error('refused'),{code:'ECONNREFUSED'})});};
 await assert.rejects(()=>executeResearch(plan,new AbortController().signal),e=>publicProviderError(e,new AbortController().signal).code==='FINANCE_UNAVAILABLE');
 }finally{globalThis.fetch=original;for(const [k,v] of Object.entries({FINANCE_BASE_URL:oldRoot,FINANCE_API_KEY:oldKey})){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('a short nested request timeout reports elapsed time, not the longer stage ceiling',()=>{
 const e=new StageFailure({stage:'explanation',service:'DeepSeek',timeout_ms:100000,elapsed_ms:17809},new DOMException('Timed out','TimeoutError'));
 const result=publicProviderError(e,new AbortController().signal);assert.equal(result.code,'TIMEOUT');assert.match(result.message,/18s/);assert.doesNotMatch(result.message,/100s/);
});

test('unverified numerical explanations report evidence validation rather than generic provider failure',()=>{
 const result=publicProviderError(new Error('Unknown evidence reference: cash.balance'),new AbortController().signal);
 assert.equal(result.code,'EVIDENCE_INVALID');assert.match(result.message,/source figures/);
});
