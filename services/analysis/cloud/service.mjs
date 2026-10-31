import {randomUUID,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {capability} from '../portfolio-bridge.mjs';
import {publicPortfolio} from './portfolio.mjs';
const uuid=z.string().uuid();
const input=z.object({conversationId:uuid,question:z.string().trim().min(1).max(2500),previousId:uuid.optional(),followupIndex:z.number().int().min(0).max(1).optional(),language:z.enum(['en','zh-Hant','zh-Hans']),scope:z.object({bank:z.string().max(80),book:z.string().max(100)}).strict()}).strict();
const json=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const equal=(a,b)=>Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function createCloudService({token,store,research,ready,dailyLimit=100}){
 if(!token||token.length<32)throw Error('A strong MERCURY_SERVICE_TOKEN is required.');
 let running=false;const queue=[],controllers=new Map();
 async function drain(){
  if(running)return;running=true;
  try{while(queue.length){const task=queue.shift(),{id,owner,body,scope,previous,selectedFollowup,controller}=task;if(controller.signal.aborted){store.update(id,'failed',{error:'Analysis cancelled.'});controllers.delete(id);continue;}
   store.update(id,'running',{progress:'Understanding your question…'});
   try{
    const run=await research({question:body.question,language:body.language,owner,previous,portfolioScope:scope,selectedFollowup,signal:controller.signal,onEvent:event=>{
     if(event.type==='progress')store.update(id,'running',{progress:event.text});
     if(event.type==='analysis'||event.type==='done')store.update(id,'running',{run:event.run});
    }});
    const {owner:ignored,...safe}=run;store.save(owner,body.conversationId,safe);store.update(id,'complete',{run:safe});
   }catch{store.update(id,'failed',{error:'Analysis did not complete. Please retry.'});}
   finally{controllers.delete(id);}
  }}finally{running=false;}
 }
 return {async handle(request){
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/healthz')return json(200,{status:'alive'});
  const auth=request.headers.get('authorization')||'';
  if(!equal(auth,'Bearer '+token))return json(401,{error:'Service authorization required.'});
  if(request.method==='GET'&&url.pathname==='/v1/health')return json(200,ready());
  const owner=request.headers.get('x-mercury-owner');if(!uuid.safeParse(owner).success)return json(403,{error:'Signed visitor session required.'});
  if(request.method==='GET'&&url.pathname==='/v1/history'){
   const cid=url.searchParams.get('conversationId')||undefined;if(cid&&!uuid.safeParse(cid).success)return json(400,{error:'Invalid conversation.'});
   return json(200,store.history(owner,cid));
  }
  const match=url.pathname.match(/^\/v1\/(jobs|runs)\/([a-f0-9-]{36})$/);
  if(match){const [,kind,id]=match;if(!uuid.safeParse(id).success)return json(400,{error:'Invalid ID.'});
   if(request.method==='GET'){const value=kind==='jobs'?store.job(owner,id):store.run(owner,id);return value?json(200,kind==='jobs'?value:{run:value}):json(404,{error:'Analysis unavailable.'});}
   if(request.method==='DELETE'&&kind==='jobs'){if(!store.job(owner,id))return json(404,{error:'Analysis unavailable.'});controllers.get(id)?.abort();return json(200,{cancelled:true});}
  }
  if(request.method!=='POST'||url.pathname!=='/v1/jobs')return json(404,{error:'Not found.'});
  if(!ready().ready)return json(503,{error:'DeepSeek / Laya / finance service is not ready.'});
  let body;try{const raw=await request.text();if(raw.length>12000)throw Error();body=input.parse(JSON.parse(raw));}catch{return json(400,{error:'Invalid question or scope.'});}
  const scope=capability(owner,body.scope.book,body.scope.bank);try{publicPortfolio(scope);}catch{return json(403,{error:'Scope is outside the public demo.'});}
  const previous=body.previousId?store.run(owner,body.previousId,body.conversationId):undefined;
  if(body.previousId&&(!previous||previous.portfolio_scope?.key!==scope.key))return json(403,{error:'Previous answer does not belong to this conversation and scope.'});
  const selectedFollowup=body.followupIndex===undefined?undefined:previous?.followups?.[body.followupIndex];
  if(body.followupIndex!==undefined&&(!selectedFollowup||selectedFollowup.question!==body.question))return json(400,{error:'Follow-up does not match this answer.'});
  if(queue.length>=10||!store.allowed(owner,dailyLimit))return json(429,{error:'Demo analysis capacity reached. Please try later.'});
  const id=randomUUID(),controller=new AbortController();store.create(id,owner,body.conversationId);controllers.set(id,controller);queue.push({id,owner,body,scope,previous,selectedFollowup,controller});void drain();return json(202,{jobId:id});
 },close(){for(const controller of controllers.values())controller.abort();}};
}
