import {hasSession,localRequest,sameOrigin} from '../../../../lib/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!localRequest(request)||!sameOrigin(request)||!hasSession(request))return Response.json({error:'A local Mercury session is required.'},{status:403});
 const root=process.env.FINANCE_BASE_URL,key=process.env.FINANCE_API_KEY;
 if(root!=='http://127.0.0.1:8890'||!key)return Response.json({error:'Start the Mercury Finance API and reopen the local portal.'},{status:503});
 let payload:string;
 try{payload=await request.text();if(payload.length>16384)return Response.json({error:'Strategy input is too large.'},{status:413});JSON.parse(payload);}catch{return Response.json({error:'Invalid strategy input.'},{status:400});}
 try{
  const response=await fetch(root+'/v1/strategy/backtest',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:payload,signal:AbortSignal.any([request.signal,AbortSignal.timeout(30000)]),redirect:'error',cache:'no-store'});
  if(response.status===422){const data=await response.json();return Response.json({error:typeof data.error==='string'?data.error:'Invalid strategy input.',issues:Array.isArray(data.issues)?data.issues.slice(0,12):[]},{status:422,headers:{'Cache-Control':'no-store'}});}
  if(!response.ok)throw Error();
  const data=await response.json();
  if(data.engine!=='mercury-strategies-1.0.0'||!Array.isArray(data.strategies)||data.execution_ready!==false)throw Error();
  return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'The strategy service is unavailable. Start Mercury Finance API and retry.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
