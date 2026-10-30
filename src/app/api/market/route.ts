import { hasSession, localRequest } from '../../../lib/server';
export const runtime='nodejs';
let cache:{fetchedAt:string;sourceDate:string;value:number}|null=null;
function result(c:NonNullable<typeof cache>,cached:boolean){return {...c,cached,source:'HKMA',unit:'HKD per USD',frequency:'Daily reference; not a trading quote',stale:Date.now()-Date.parse(c.sourceDate)>4*86400000};}
export async function GET(request:Request) {
  if(!localRequest(request)||!hasSession(request))return Response.json({error:'SESSION_REQUIRED'},{status:403});
  if(cache&&Date.now()-Date.parse(cache.fetchedAt)<86400000)return Response.json(result(cache,true));
  try{
    const r=await fetch('https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily?pagesize=1&sortby=end_of_day&sortorder=desc',{signal:AbortSignal.timeout(10000),cache:'no-store'});
    if(!r.ok)throw new Error();const data=await r.json(),record=data.result?.records?.[0];
    if(!record||typeof record.end_of_day!=='string'||!Number.isFinite(Number(record.usd))||Number(record.usd)<=0)throw new Error();
    cache={fetchedAt:new Date().toISOString(),sourceDate:record.end_of_day,value:Math.round(Number(record.usd)*10000)/10000};
    return Response.json(result(cache,false));
  }catch{return Response.json({error:'HKMA 資料未能驗證或讀取；未改動示範估值。'},{status:502});}
}
