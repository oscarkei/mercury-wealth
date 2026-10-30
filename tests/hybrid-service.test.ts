import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawn,type ChildProcess} from 'node:child_process';
import {analysisEnvironment,createHybridService} from '../src/lib/hybrid-service.ts';

const absent={listening:false,ready:false};
const loading={listening:true,ready:false};
const ready={listening:true,ready:true};
const sleep=async()=>{};
function child(){return Object.assign(new EventEmitter(),{unref(){}}) as ChildProcess;}

test('auto-start retains analysis settings without forwarding unrelated secrets',()=>{
 const env=analysisEnvironment({DEEPSEEK_API_KEY:'synthetic-key',MERCURY_LAYA_MODEL_PATH:'/models/laya',MERCURY_LAYA_PYTHON:'/laya/python',MERCURY_FINANCE_PYTHON:'/finance/python',EIA_API_KEY:'synthetic-eia',BEA_API_KEY:'synthetic-bea',SUPABASE_SECRET_KEY:'do-not-forward',UNRELATED_SECRET:'do-not-forward'});
 assert.equal(env.MERCURY_LAYA_MODEL_PATH,'/models/laya');
 assert.equal(env.MERCURY_LAYA_PYTHON,'/laya/python');
 assert.equal(env.MERCURY_FINANCE_PYTHON,'/finance/python');
 assert.equal(env.DEEPSEEK_API_KEY,'synthetic-key');
 assert.equal(env.EIA_API_KEY,'synthetic-eia');
 assert.equal(env.BEA_API_KEY,'synthetic-bea');
 assert.equal(env.SUPABASE_SECRET_KEY,undefined);
 assert.equal(env.UNRELATED_SECRET,undefined);
});
test('a ready service is reused without spawning',async()=>{
 const ensure=createHybridService({env:{},readHealth:async()=>ready,start:()=>{throw Error('Unexpected spawn');}});
 assert.equal(await ensure(),true);
});
test('concurrent requests share startup while Laya loads',async()=>{
 let reads=0,starts=0;
 const ensure=createHybridService({env:{},readHealth:async()=>++reads===1?absent:reads===2?loading:ready,start:()=>{starts++;return child();},sleep,attempts:3});
 assert.deepEqual(await Promise.all([ensure(),ensure(),ensure()]),[true,true,true]);
 assert.equal(starts,1);
});
test('a listening but loading service is not started twice',async()=>{
 let reads=0;
 const ensure=createHybridService({env:{},readHealth:async()=>++reads<3?loading:ready,start:()=>{throw Error('Unexpected duplicate');},sleep,attempts:3});
 assert.equal(await ensure(),true);
});
test('startup timeout does not spawn another owned process on retry',async()=>{
 let starts=0;
 const ensure=createHybridService({env:{},readHealth:async()=>absent,start:()=>{starts++;return child();},sleep,attempts:2});
 assert.equal(await ensure(),false);assert.equal(await ensure(),false);
 assert.equal(starts,1);
});
test('missing executable is handled as an asynchronous startup failure',async()=>{
 const ensure=createHybridService({env:{},readHealth:async()=>absent,start:()=>spawn('/mercury-test-missing-executable',[],{stdio:'ignore'}),sleep:()=>new Promise(resolve=>setTimeout(resolve,10)),attempts:10});
 assert.equal(await ensure(),false);
});
test('a stopped child allows a later clean retry',async()=>{
 let starts=0;
 const process=child();
 const ensure=createHybridService({env:{},readHealth:async()=>absent,start:()=>{starts++;return process;},sleep:async()=>{process.emit('exit',1);},attempts:2});
 assert.equal(await ensure(),false);assert.equal(await ensure(),false);
 assert.equal(starts,2);
});
test('terminal worker failure returns unavailable without creating a duplicate',async()=>{
 const ensure=createHybridService({env:{},readHealth:async()=>({...loading,failed:true}),start:()=>{throw Error('Unexpected duplicate');}});
 assert.equal(await ensure(),false);
});
test('Vercel never attempts to start or contact a local worker',async()=>{
 const ensure=createHybridService({env:{VERCEL:'1'},readHealth:async()=>{throw Error('Unexpected request');},start:()=>{throw Error('Unexpected spawn');}});
 assert.equal(await ensure(),false);
});
