import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifySupabase,PROJECT_URL,VERSION} from '../scripts/verify-supabase.mjs';
const settings={SUPABASE_URL:PROJECT_URL,SUPABASE_SECRET_KEY:'sb_secret_synthetic_only'};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
test('wrong project or publishable key never sends a request',async()=>{
 const fetcher=()=>{throw new Error('Must not fetch')};
 assert.equal((await verifySupabase({...settings,SUPABASE_URL:'https://example.com'},fetcher)).status,'wrong_project');
 assert.equal((await verifySupabase({...settings,SUPABASE_SECRET_KEY:'sb_publishable_synthetic'},fetcher)).status,'missing_key');
});
test('checks version and every table with read-only requests; credentials never in URLs/results',async()=>{
 const requests=[];
 const result=await verifySupabase(settings,async(url,init)=>{requests.push(url);assert.equal(init.redirect,'error');assert.equal(init.headers.apikey,settings.SUPABASE_SECRET_KEY);assert(!url.includes(settings.SUPABASE_SECRET_KEY));assert(!init.method||init.method==='GET');return response(url.includes('id=eq.')?[{id:VERSION}]:[])});
 assert.equal(result.status,'ready');assert.equal(requests.length,15);assert.equal(result.tablesVerified,14);assert(!JSON.stringify(result).includes(settings.SUPABASE_SECRET_KEY));
});
test('missing schema is different from rejected key',async()=>{
 assert.equal((await verifySupabase(settings,async()=>response({code:'PGRST205'},404))).status,'schema_missing');
 assert.equal((await verifySupabase(settings,async()=>response({},401))).status,'access_denied');
 assert.equal((await verifySupabase(settings,async()=>response([]))).status,'schema_missing');
});
test('partial schema is not marked ready',async()=>{
 const r=await verifySupabase(settings,async url=>url.includes('id=eq.')?response([{id:VERSION}]):url.includes('/mercury_position?')?response({code:'PGRST205'},404):response([]));
 assert.equal(r.status,'schema_incomplete');assert.deepEqual(r.tables,['mercury_position']);
});
test('provider/network errors are sanitized',async()=>{
 const secret=settings.SUPABASE_SECRET_KEY;
 for(const fetcher of [async()=>{throw new Error(secret)},async()=>response({error:secret},500)]){
  const r=await verifySupabase(settings,fetcher);assert(!JSON.stringify(r).includes(secret));assert.notEqual(r.status,'ready');
 }
});
