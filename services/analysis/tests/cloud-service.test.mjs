import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {CloudStore} from '../cloud/store.mjs';
import {createCloudService} from '../cloud/service.mjs';
import {publicPortfolio} from '../cloud/portfolio.mjs';
import {capability} from '../portfolio-bridge.mjs';
import {executePortfolio} from '../portfolio-tools.mjs';
const token='test-service-token-not-real-000000000000000000';
function fixture(t,overrides={}){
 const dir=mkdtempSync(join(tmpdir(),'mercury-cloud-')),path=join(dir,'history.sqlite'),store=new CloudStore(path),owner=randomUUID(),conversationId=randomUUID();
 const service=createCloudService({token,store,ready:()=>({ready:true}),research:async args=>({id:randomUUID(),owner:args.owner,question:args.question,answer:'Test answer',status:'completed',portfolio_scope:args.portfolioScope,followups:[],history:[]}),...overrides});
 t.after(()=>{service.close();store.close();rmSync(dir,{recursive:true,force:true});});
 const call=(path,body,who=owner,authorization=token,method=body?'POST':'GET')=>service.handle(new Request('http://service'+path,{method,headers:{authorization:'Bearer '+authorization,'x-mercury-owner':who,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));
 const input={conversationId,question:'持倉概覽',language:'zh-Hant',scope:{bank:'all',book:'all'}};
 return {store,service,owner,call,input,path};
}
test('public health is minimal; missing service authentication cannot query or create jobs',async t=>{
 const f=fixture(t);assert.equal((await f.call('/healthz',null,'','')).status,200);
 assert.equal((await f.call('/v1/history',null,f.owner,'wrong')).status,401);
 assert.equal((await f.call('/v1/jobs',f.input,'invalid-owner')).status,403);
});
test('cloud jobs return promptly and keep result/history isolated by owner and conversation',async t=>{
 let release;const wait=new Promise(r=>release=r);
 const f=fixture(t,{research:async args=>{await wait;return {id:randomUUID(),owner:args.owner,question:args.question,answer:'Done',status:'completed',portfolio_scope:args.portfolioScope};}});
 const accepted=await f.call('/v1/jobs',f.input);assert.equal(accepted.status,202);const {jobId}=await accepted.json();
 assert.equal((await (await f.call('/v1/jobs/'+jobId)).json()).status,'running');
 assert.equal((await f.call('/v1/jobs/'+jobId,null,randomUUID())).status,404);
 release();await new Promise(r=>setImmediate(r));const result=await (await f.call('/v1/jobs/'+jobId)).json();assert.equal(result.status,'complete');assert.equal(result.run.owner,undefined);
 assert.equal((await (await f.call('/v1/history')).json()).turns.length,1);
 const foreign={...f.input,previousId:result.run.id,conversationId:randomUUID()};assert.equal((await f.call('/v1/jobs',foreign)).status,403);
 assert.equal((await f.call('/v1/runs/'+result.run.id,null,randomUUID())).status,404);
});
test('scope changes, missing targets and forged follow-up clicks cannot cross the cloud boundary',async t=>{
 const f=fixture(t);assert.equal((await f.call('/v1/jobs',{...f.input,scope:{bank:'foreign',book:'all'}})).status,403);
 assert.equal((await f.call('/v1/jobs',{...f.input,household:'foreign'})).status,400);
 assert.equal((await f.call('/v1/jobs',{...f.input,followupIndex:0})).status,400);
 const id=randomUUID();f.store.save(f.owner,f.input.conversationId,{id,portfolio_scope:capability(f.owner,'all','UBS'),followups:[]});
 assert.equal((await f.call('/v1/jobs',{...f.input,previousId:id})).status,403);
});
test('unavailable finance prevents cloud inference rather than falling back',async t=>{
 const f=fixture(t,{ready:()=>({ready:false}),research:()=>{throw Error('Should not run');}});
 assert.equal((await f.call('/v1/jobs',f.input)).status,503);
});
test('persistent global quota cannot be bypassed with a new visitor session',async t=>{
 const f=fixture(t,{dailyLimit:1});assert.equal((await f.call('/v1/jobs',f.input)).status,202);
 assert.equal((await f.call('/v1/jobs',f.input,randomUUID())).status,429);
});
test('public portfolio matches website values, strips account names and uses truthful source labels',async()=>{
 const scope=capability(randomUUID()),snapshot=publicPortfolio(scope);assert.equal(snapshot.source,'public-demo');assert.equal(snapshot.holdings.length,23);
 assert.equal(snapshot.holdings.some(h=>h.account||h.owner||h.owners),false);
 const run={portfolio_scope:scope,sources:[],results:[],facts:[]};const out=await executePortfolio('get_portfolio',{},run,{portfolioLoader:async()=>snapshot});
 assert.equal(out.result.data.total,snapshot.total);assert.equal(run.sources[0].publisher,'Mercury public demo');assert.ok(!run.sources[0].url.includes('127.0.0.1'));
});
test('stored jobs survive reopen and interrupted work is marked failed without recharging',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mercury-cloud-reopen-')),path=join(dir,'history.sqlite'),owner=randomUUID(),id=randomUUID(),conversation=randomUUID();
 let store=new CloudStore(path);store.create(id,owner,conversation);store.close();store=new CloudStore(path);assert.equal(store.job(owner,id).status,'failed');assert.equal(store.allowed(owner,1),false);store.close();rmSync(dir,{recursive:true,force:true});
});
