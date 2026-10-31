import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('cancel stops an active finance worker and the next request starts a clean worker',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'mercury-finance-cancel-'));
 const worker=join(dir,'worker.mjs'),launcher=join(dir,'python');
 const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
 writeFileSync(worker,`import {createInterface} from 'node:readline';createInterface({input:process.stdin}).on('line',line=>{const r=JSON.parse(line);if(r.name==='health')console.log(JSON.stringify({id:r.id,result:{ready:true}}));});`);
 writeFileSync(launcher,'#!/bin/sh\nexec '+quote(process.execPath)+' '+quote(worker)+'\n',{mode:0o700});
 const old=process.env.MERCURY_FINANCE_PYTHON;process.env.MERCURY_FINANCE_PYTHON=launcher;
 const client=await import('../finance-client.mjs?cancellation-test');
 try{
  assert.equal((await client.financeCall('health',{})).ready,true);
  const abort=new AbortController(),started=Date.now();
  const waiting=client.financeCall('hang',{},abort.signal);setTimeout(()=>abort.abort(),20);
  await assert.rejects(waiting,/cancelled/);assert.ok(Date.now()-started<2000);
  assert.equal((await client.financeCall('health',{},AbortSignal.timeout(3000))).ready,true);
 }finally{client.closeFinance();old===undefined?delete process.env.MERCURY_FINANCE_PYTHON:process.env.MERCURY_FINANCE_PYTHON=old;rmSync(dir,{recursive:true,force:true});}
});
