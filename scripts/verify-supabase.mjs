// Server/local setup only. Never imported into the browser or exposed as a route.
import {pathToFileURL} from 'node:url';
export const PROJECT_REF='ljrnllkklsumizsxhpwu';
export const PROJECT_URL=`https://${PROJECT_REF}.supabase.co`;
export const VERSION='202610260001_core_v2';
export const TABLE_KEYS={mercury_firm:'id',mercury_household:'id',mercury_client:'id',mercury_custodian:'id',mercury_account:'id',mercury_account_owner:'id',mercury_portfolio:'id',mercury_instrument:'id',mercury_position:'id',mercury_structured_product_detail:'instrument_id',mercury_sp_underlying:'id',mercury_sp_observation:'id',mercury_sp_event:'id',mercury_schema_version:'id'};
export async function verifySupabase(settings,fetcher=fetch){
  if(!settings.SUPABASE_URL)return {status:'not_configured',message:'Run Configure Mercury Database.command to save the project URL and secret key privately on this Mac.'};
  if(settings.SUPABASE_URL!==PROJECT_URL)return {status:'wrong_project',message:'Project URL does not match the Mercury project. No request sent.'};
  const key=settings.SUPABASE_SECRET_KEY;
  if(typeof key!=='string'||!/^sb_secret_[A-Za-z0-9_-]+$/.test(key))return {status:'missing_key',message:'Enter the secret key from Settings > API Keys (sb_secret_...).'};
  async function read(table,query){
    try{
      const r=await fetcher(`${PROJECT_URL}/rest/v1/${table}?${query}`,{headers:{apikey:key,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store'});
      if(r.status===401||r.status===403)return {status:'access_denied'};
      if(!r.ok){let code;try{code=(await r.json()).code}catch{};return {status:r.status===404&&code==='PGRST205'?'schema_missing':'request_failed'};}
      const data=await r.json();return Array.isArray(data)?{status:'ok',data}:{status:'request_failed'};
    }catch{return {status:'connection_failed'};}
  }
  const marker=await read('mercury_schema_version',`select=id&id=eq.${VERSION}&limit=1`);
  if(marker.status!=='ok')return {status:marker.status,message:messages[marker.status]};
  if(marker.data.length!==1||marker.data[0].id!==VERSION)return {status:'schema_missing',message:messages.schema_missing};
  const results=await Promise.all(Object.entries(TABLE_KEYS).map(async([table,keyColumn])=>({table,...await read(table,`select=${keyColumn}&limit=0`)})));
  const failed=results.filter(r=>r.status!=='ok');
  if(failed.length)return {status:'schema_incomplete',message:'Some core tables are unavailable. Recheck the SQL installation and Data API schema cache.',tables:failed.map(r=>r.table)};
  return {status:'ready',projectRef:PROJECT_REF,version:VERSION,tablesVerified:results.length,message:'Connected: 14 core tables are accessible. Portfolio snapshot availability is verified separately by the portal.'};
}
const messages={schema_missing:'Key reached the Data API, but the Mercury schema is not installed/visible yet. Run Mercury Supabase Setup.sql in SQL Editor, then verify again.',access_denied:'Key or table permission was rejected. Check the project and use its server secret key.',request_failed:'Supabase returned an unexpected response. Check Data API availability; no raw error or credential is displayed.',connection_failed:'Could not complete the request within 10 seconds. Check network access and whether the project is paused.'};
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=await verifySupabase(process.env);
  process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=result.status==='ready'?0:2;
}
