import {hasSession,localRequest,sameOrigin} from '../../../../lib/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!localRequest(request)||!sameOrigin(request)||!hasSession(request))return Response.json({error:'A local Mercury session is required.'},{status:403});
 const root=process.env.FINANCE_BASE_URL,key=process.env.FINANCE_API_KEY;
 if(root!=='http://127.0.0.1:8890'||!key)return Response.json({error:'Start the Mercury Finance API and reopen the local portal.'},{status:503});
 let payload:string;
 try{payload=await request.text();if(payload.length>262144)return Response.json({error:'Calculation input is too large.'},{status:413});JSON.parse(payload);}catch{return Response.json({error:'Invalid calculation input.'},{status:400});}
 try{
  const response=await fetch(root+'/v1/twr',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:payload,signal:AbortSignal.any([request.signal,AbortSignal.timeout(15000)]),redirect:'error',cache:'no-store'});
  if(response.status===422){const data=await response.json();return Response.json({error:typeof data.error==='string'?data.error:'Invalid TWR input.',issues:Array.isArray(data.issues)?data.issues.slice(0,12):[]},{status:422,headers:{'Cache-Control':'no-store'}});}
  if(!response.ok)throw Error();
  const data=await response.json();
  if(data.engine!=='mercury-twr-1.0.0'||typeof data.twr!=='string'||!Array.isArray(data.series))throw Error();
  return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'The finance calculation service is unavailable. Start Mercury Finance API and retry.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
