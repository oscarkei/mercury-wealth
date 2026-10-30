import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadDatabasePortfolio,verifySeedRows} from '../src/lib/supabase-portfolio-server.ts';
import {demoSeedPlan} from '../src/lib/portfolio-seed.ts';
import {holdings,TOTAL} from '../src/lib/domain.ts';
test('database snapshot joins actual rows, preserving base currency and aggregated quantities',async()=>{
 const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SECRET_KEY;
 try{process.env.SUPABASE_URL='https://ljrnllkklsumizsxhpwu.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_synthetic';
  const fake:typeof fetch=async(input,init)=>{assert.equal(init?.redirect,'error');assert.equal(init?.method,'GET');const table=String(input).split('/rest/v1/')[1].split('?')[0];return Response.json(demoSeedPlan.find(p=>p.table===table)!.rows);};
  const data=await loadDatabasePortfolio(fake);assert.deepEqual(data.holdings,holdings);assert.equal(data.total,TOTAL);assert.equal(data.source,'supabase');assert.equal(data.dataMode,'mock');
  const positions=demoSeedPlan.find(p=>p.table==='mercury_position')!.rows;assert(positions.every(p=>p.quantity===null&&p.market_value===null&&p.base_currency==='USD'));
 }finally{if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=oldKey;}
});
test('partial, duplicate or edited immutable snapshots fail instead of mixing with fixed demo narratives',()=>{
 const sample=[{id:'one',value:12},{id:'two',value:20}];
 assert.throws(()=>verifySeedRows(sample,[sample[0]]),/incomplete/);
 assert.throws(()=>verifySeedRows(sample,[sample[0],sample[0]]),/incomplete/);
 assert.throws(()=>verifySeedRows(sample,[{id:'one',value:13},sample[1]]),/differs/);
 assert.doesNotThrow(()=>verifySeedRows(sample,[],true));
});
