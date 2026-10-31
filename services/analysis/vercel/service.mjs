import {z} from 'zod';
import {createSessions} from './session.mjs';
import {capability} from '../portfolio-bridge.mjs';
import {publicPortfolio} from '../cloud/portfolio.mjs';
const input=z.object({conversationId:z.string().uuid(),question:z.string().trim().min(1).max(2500),previousId:z.string().uuid().optional(),continuation:z.string().max(260000).optional(),followupIndex:z.number().int().min(0).max(1).optional(),language:z.enum(['en','zh-Hant','zh-Hans']),scope:z.object({bank:z.string().max(80),book:z.string().max(100)}).strict()}).strict();
const json=(status,body,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
export function createVercelChat({key,secret=key,research,origins,timeoutMs=270000,now=Date.now}){
 const sessions=key?createSessions(secret,now):null;
 let active=0;const activeOwners=new Set(),counts=new Map();
 const sameOrigin=req=>origins.includes(req.headers.get('origin'))&&new URL(req.headers.get('origin')).host===req.headers.get('host')&&req.headers.get('x-mercury-client')==='portal';
 return {async handle(request){
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/api/cloud-chat')return json(200,{mode:'vercel-direct',model:'deepseek-flash',ui:'deepseek',configured:!!key,memory:'this-browser',turnLimit:12,conversationId:null,turns:[]});
  if(request.method!=='POST')return json(405,{error:'Method not supported.'});
  if(!sameOrigin(request))return json(403,{error:'Origin rejected.'});
  if(!sessions)return json(503,{error:'Add DEEPSEEK_API_KEY to this Vercel project and redeploy. No key is sent to the browser.'});
  if(url.pathname==='/api/session')return json(200,{mode:'vercel-direct',memory:'this-browser',turnLimit:12,expiresIn:28800},{'Set-Cookie':sessions.cookie(request)});
  const owner=sessions.owner(request);if(!owner)return json(401,{error:'Session expired. Please send the question again.'});
  let body;try{const text=await request.text();if(Buffer.byteLength(text)>280000)throw Error();body=input.parse(JSON.parse(text));}catch{return json(400,{error:'Invalid question or context.'});}
  const scope=capability(owner,body.scope.book,body.scope.bank);try{publicPortfolio(scope);}catch{return json(403,{error:'Only the selected public demo portfolio is available.'});}
  let previous;try{if(body.previousId)previous=sessions.open(body.continuation,owner,body.conversationId,scope,body.previousId);else if(body.continuation)throw Error();}catch{return json(409,{error:'Saved context expired or is unavailable. Start a new conversation to continue.'});}
  const selectedFollowup=body.followupIndex===undefined?undefined:previous?.followups?.[body.followupIndex];
  if(body.followupIndex!==undefined&&(!selectedFollowup||selectedFollowup.question!==body.question))return json(400,{error:'Follow-up does not match the saved answer.'});
  for(const [id,item] of counts)if(item.until<=now())counts.delete(id);
  const count=counts.get(owner)||{n:0,until:now()+3600000};
  if(active>=1||activeOwners.has(owner))return json(429,{error:'An analysis is running. Please wait for it to finish.'});
  if(count.n>=20||counts.size>=1000)return json(429,{error:'This demo instance has reached its request limit. Please try later.'});
  counts.set(owner,{...count,n:count.n+1});active++;activeOwners.add(owner);
  const abort=new AbortController(),signal=AbortSignal.any([abort.signal,request.signal,AbortSignal.timeout(timeoutMs)]),encoder=new TextEncoder();
  let closed=false;
  const stream=new ReadableStream({async start(controller){
   const emit=event=>{if(!closed&&!signal.aborted)controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'));};
   const heartbeat=setInterval(()=>emit({type:'heartbeat'}),15000);heartbeat.unref?.();
   try{
    const run=await research({question:body.question,language:body.language,owner,previous,portfolioScope:scope,selectedFollowup,signal,onEvent:event=>{if(event.type!=='done')emit(event);}});
    if(signal.aborted){emit({type:'error',error:'Analysis timed out or was cancelled.'});}
    else {const {owner:ignored,...safe}=run;const continuation=sessions.seal(safe,owner,body.conversationId);emit({type:'done',run:safe,continuation,conversationId:body.conversationId});}
   }catch{if(!closed)controller.enqueue(encoder.encode(JSON.stringify({type:'error',error:'Analysis could not complete. No replacement model was used.'})+'\n'));}
   finally{clearInterval(heartbeat);active--;activeOwners.delete(owner);if(!closed){closed=true;controller.close();}}
  },cancel(){closed=true;abort.abort();}});
  return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'}});
 }};
}
