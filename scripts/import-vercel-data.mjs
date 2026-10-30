// Local import command; source lineage and cloud verification are recorded without credentials.
import fs from 'node:fs';
import crypto from 'node:crypto';
import nextEnv from '@next/env';
import {fileURLToPath,pathToFileURL} from 'node:url';
const out=new URL('../../',import.meta.url),project=new URL('../',import.meta.url);
export const stable=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(stable).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
export const hash=value=>crypto.createHash('sha256').update(stable(value)).digest('hex');
export function transformRow(row,schema,importId){
 const key=schema.primarySourceKey?row[schema.primarySourceKey]:hash(row);
 const result={_import_id:importId,_record_key:key,_source_sha256:hash(row),_source_json:row};
 for(const field of schema.fields)result[field.column]=row[field.sourceKey]??null;
 return result;
}
export async function pool(jobs,concurrency=3){let index=0;const results=[];await Promise.all(Array.from({length:Math.min(concurrency,jobs.length)},async()=>{while(index<jobs.length){const i=index++;results[i]=await jobs[i]();}}));return results;}
export function createClient(settings,fetcher=fetch){
 const root='https://ljrnllkklsumizsxhpwu.supabase.co';
 if(settings.SUPABASE_URL!==root||!settings.SUPABASE_SECRET_KEY?.startsWith('sb_secret_'))throw Error('Local Supabase setup is incomplete.');
 return async(table,query='',body,method='POST')=>{
  if(!/^mercury_v1_[a-z_]+$/.test(table))throw Error('Unsupported import table.');
  for(let attempt=0;attempt<3;attempt++){
   let response;
   try{response=await fetcher(`${root}/rest/v1/${table}?${new URLSearchParams(query)}`,{method:body===undefined?'GET':method,headers:{apikey:settings.SUPABASE_SECRET_KEY,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'})},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000)});}catch{if(attempt===2)throw Error('Import network request failed.');await new Promise(r=>setTimeout(r,500*(attempt+1)));continue;}
   if([429,502,503,504].includes(response.status)&&attempt<2){await new Promise(r=>setTimeout(r,700*(attempt+1)));continue;}
   if(!response.ok)throw Error(response.status===404?'Import schema is missing. Run Mercury Vercel Import Setup.sql in SQL Editor.':'Import request rejected; check schema and project permissions.');
   if(body!==undefined)return null;
   const rows=await response.json();if(!Array.isArray(rows))throw Error('Unexpected import response.');return rows;
  }
 };
}
export async function verifyDataset(api,schema,rows,importId){
 const expected=new Map(rows.map(r=>[schema.primarySourceKey?r[schema.primarySourceKey]:hash(r),hash(r)]));
 const seen=new Set();
 for(let offset=0;;){
  const page=await api(schema.table,{select:'_record_key,_source_sha256,_source_json',_import_id:'eq.'+importId,order:'_record_key.asc',offset:String(offset),limit:'1000'});
  for(const row of page){const key=row._record_key;if(seen.has(key)||!expected.has(key)||row._source_sha256!==expected.get(key)||hash(row._source_json)!==expected.get(key))throw Error('Imported record content differs from the recovered source.');seen.add(key);}
  offset+=page.length;if(page.length<1000)break;
 }
 if(seen.size!==rows.length)throw Error('Imported row count differs from the recovered source.');
 return seen.size;
}
async function main(){
 nextEnv.loadEnvConfig(fileURLToPath(project),false,{info(){},error(){}});
 const manifest=JSON.parse(fs.readFileSync(new URL('Mercury Vercel Import Manifest.json',out),'utf8'));
 const source=JSON.parse(fs.readFileSync(new URL('Mercury Vercel Source Data.json',out),'utf8'));
 if(source.assetSha256!==manifest.assetSha256||manifest.projectRef!=='ljrnllkklsumizsxhpwu')throw Error('Import source manifest mismatch.');
 for(const s of manifest.schemas)if(source.datasets[s.name]?.length!==s.count||hash(source.datasets[s.name])!==s.hash)throw Error('Source data checksum mismatch.');
 const api=createClient(process.env),id=manifest.importId;
 // A read-only preflight confirms DDL availability before any cloud writes.
 await api('mercury_v1_imports',{select:'id',limit:'0'});
 await pool(manifest.schemas.map(s=>()=>api(s.table,{select:'_record_key',limit:'0'})));
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({status:'ready_to_import',sourceRows:manifest.sourceRows,derivedRows:manifest.derivedRows,datasets:manifest.schemas.length}));return;}
 const run={id,source_url:manifest.source,asset_sha256:manifest.assetSha256,as_of:manifest.asOf,data_mode:'mock',status:'importing',expected_datasets:manifest.schemas.length,expected_records:manifest.totalRows};
 await api('mercury_v1_imports',{on_conflict:'id'},[run]);
 const existing=await api('mercury_v1_imports',{select:'id,asset_sha256,expected_records',id:'eq.'+id});
 if(existing.length!==1||existing[0].asset_sha256!==manifest.assetSha256||existing[0].expected_records!==manifest.totalRows)throw Error('Existing import metadata conflicts; nothing overwritten.');
 const jobs=[];
 for(const s of manifest.schemas){
  await api('mercury_v1_datasets',{on_conflict:'import_id,name'},[{import_id:id,name:s.name,table_name:s.table,origin:s.origin,expected_records:s.count,payload_sha256:s.hash}]);
  const rows=source.datasets[s.name];
  for(let i=0;i<rows.length;i+=400){const batch=rows.slice(i,i+400).map(r=>transformRow(r,s,id));jobs.push(()=>api(s.table,{on_conflict:'_import_id,_record_key'},batch));}
 }
 let batches=0;
 await pool(jobs.map(job=>async()=>{await job();batches++;if(batches%25===0)console.log(JSON.stringify({stage:'uploading',batchesDone:batches,batchesTotal:jobs.length}));}));
 let verified=0;const datasets=await pool(manifest.schemas.map(s=>async()=>{
  const count=await verifyDataset(api,s,source.datasets[s.name],id);verified+=count;
  await api('mercury_v1_datasets',{import_id:'eq.'+id,name:'eq.'+s.name},{verified_records:count},'PATCH');
  return {name:s.name,count,verified:true};
 }));
 if(verified!==manifest.totalRows)throw Error('Final record total mismatch.');
 await api('mercury_v1_imports',{id:'eq.'+id},{status:'complete',verified_records:verified,completed_at:new Date().toISOString()},'PATCH');
 const report={status:'complete',importId:id,sourceRows:manifest.sourceRows,derivedRows:manifest.derivedRows,totalVerified:verified,datasets,sourceAssetSha256:manifest.assetSha256,verifiedAt:new Date().toISOString(),mock:true,existingChanDemoPreserved:true,limitations:manifest.limitations};
 fs.writeFileSync(new URL('Mercury Vercel Import Verification.json',out),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'complete',totalVerified:verified,datasets:datasets.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){main().catch(error=>{const allowed=['Local Supabase setup is incomplete.','Import schema is missing. Run Mercury Vercel Import Setup.sql in SQL Editor.','Import source manifest mismatch.','Source data checksum mismatch.'];const message=allowed.includes(error.message)?error.message:'Import stopped. Existing data was not replaced; inspect source checksums, schema or connectivity, then retry.';console.error(message);process.exitCode=2;});}
