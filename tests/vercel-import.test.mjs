import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient,transformRow,verifyDataset,hash} from '../scripts/import-vercel-data.mjs';
test('source transform keeps original payload and explicit lineage',()=>{
 const row={id:'one',initialFixing:{amount:123.45,currency:'USD'},optional:null},schema={primarySourceKey:'id',fields:[{sourceKey:'id',column:'id'},{sourceKey:'initialFixing',column:'initial_fixing'},{sourceKey:'optional',column:'optional'}]};
 const result=transformRow(row,schema,'asset_1');assert.equal(result._record_key,'one');assert.deepEqual(result._source_json,row);assert.deepEqual(result.initial_fixing,row.initialFixing);assert.equal(result._source_sha256,hash(row));
});
test('client pins Mercury host, refuses other tables and does not leak key in URL',async()=>{
 const settings={SUPABASE_URL:'https://ljrnllkklsumizsxhpwu.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_synthetic'};
 assert.throws(()=>createClient({...settings,SUPABASE_URL:'https://example.com'}));
 const client=createClient(settings,async(url,init)=>{assert(!url.includes(settings.SUPABASE_SECRET_KEY));assert.equal(init.headers.apikey,settings.SUPABASE_SECRET_KEY);assert.equal(init.redirect,'error');return Response.json([])});
 await assert.rejects(()=>client('mercury_firm'));await client('mercury_v1_household');
});
test('readback detects edited raw payload even if stored checksum is unchanged',async()=>{
 const original={id:'one',amount:12};const schema={table:'mercury_v1_test',primarySourceKey:'id'};
 const fake=async()=>[{_record_key:'one',_source_sha256:hash(original),_source_json:{id:'one',amount:13}}];
 await assert.rejects(()=>verifyDataset(fake,schema,[original],'import'),/differs/);
});
test('paginated verification crosses the 1,000-row gateway limit',async()=>{
 const rows=Array.from({length:1203},(_,i)=>({id:'r'+i,value:i}));
 const calls=[];const fake=async(_table,query)=>{calls.push(Number(query.offset));return rows.slice(Number(query.offset),Number(query.offset)+1000).map(r=>({_record_key:r.id,_source_sha256:hash(r),_source_json:r}));};
 assert.equal(await verifyDataset(fake,{table:'mercury_v1_test',primarySourceKey:'id'},rows,'import'),1203);assert.deepEqual(calls,[0,1000]);
});
