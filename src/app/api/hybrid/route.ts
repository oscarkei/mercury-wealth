import {z} from 'zod';
import {ensureHybrid,hybridBase as base} from '../../../lib/hybrid-service.ts';
import {hybridStore,type StoredHybridRun} from '../../../lib/hybrid-store.ts';
import {hasSession,localRequest,sameOrigin,demoOwner} from '../../../lib/server.ts';

export const runtime='nodejs';
export const maxDuration=450;
const inputSchema=z.object({conversationId:z.string().uuid(),question:z.string().trim().min(1).max(2500),previousId:z.string().uuid().optional(),followupIndex:z.number().int().min(0).max(1).optional(),language:z.enum(['en','zh-Hant','zh-Hans']),scope:z.object({bank:z.string().max(80),book:z.string().max(100)}).strict()}).strict();
const cookie=(value:string|null)=>value?.split(';')[0]||'';
const authorized=(request:Request)=>localRequest(request)&&hasSession(request);

export async function GET(request:Request){
 if(new URL(request.url).searchParams.has('health')){if(!localRequest(request))return Response.json({error:'Local request required.'},{status:403});return Response.json({ready:await ensureHybrid(),model:'deepseek-flash',ui:'laya'},{headers:{'Cache-Control':'no-store'}});}
 if(!authorized(request))return Response.json({error:'Local Mercury session required.'},{status:403});
 const owner=demoOwner(request);if(!owner)return Response.json({error:'Session required.'},{status:403});
 const query=new URL(request.url).searchParams;
 if(query.has('history')){const cid=query.get('conversationId')||undefined;if(cid&&!z.string().uuid().safeParse(cid).success)return Response.json({error:'Invalid conversation.'},{status:400});return Response.json(hybridStore().history(owner,cid),{headers:{'Cache-Control':'no-store'}});}
 const id=new URL(request.url).searchParams.get('run');if(!id||!z.string().uuid().safeParse(id).success)return Response.json({error:'Run ID required.'},{status:400});
 const saved=hybridStore().run(owner,id);if(saved)return Response.json({run:saved},{headers:{'Cache-Control':'no-store'}});
 if(!await ensureHybrid())return Response.json({error:'Conversation service unavailable.'},{status:503});
 try{const upstream=await fetch(base+'/api/runs/'+id,{headers:{Cookie:request.headers.get('cookie')||''},cache:'no-store',signal:AbortSignal.timeout(12000)});const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});const set=upstream.headers.get('set-cookie');if(set)headers.set('Set-Cookie',set);const body=await upstream.text();if(upstream.ok){const run=JSON.parse(body).run;const cid=query.get('conversationId');if(run&&cid&&z.string().uuid().safeParse(cid).success&&run.portfolio_scope?.household==='hh_okonkwo')hybridStore().save(owner,cid,{bank:run.portfolio_scope.bank||'all',book:run.portfolio_scope.book||'all'},run);}return new Response(body,{status:upstream.status,headers});}
 catch{return Response.json({error:'Conversation service unavailable.'},{status:503});}
}

export async function POST(request:Request){
 if(!authorized(request)||!sameOrigin(request))return Response.json({error:'Local Mercury session required.'},{status:403});
 let input:z.infer<typeof inputSchema>;try{const raw=await request.text();if(raw.length>12000)throw Error();input=inputSchema.parse(JSON.parse(raw));}catch{return Response.json({error:'Invalid question or portfolio scope.'},{status:400});}
 if(!await ensureHybrid())return Response.json({error:'Conversation service unavailable.'},{status:503});
 try{
  const given=request.headers.get('cookie')||'';
  const initial=await fetch(base+'/api/portfolio/scope',{headers:{Cookie:given},cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!initial.ok)return Response.json({error:'Portfolio session unavailable.'},{status:503});
  const issued=cookie(initial.headers.get('set-cookie')),forwarded=[given,issued].filter(Boolean).join('; ');
  const scope=await fetch(base+'/api/portfolio/scope',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:forwarded},body:JSON.stringify(input.scope),cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!scope.ok)return Response.json({error:'Selected portfolio scope is unavailable.'},{status:scope.status===403?403:503});
  const payload={question:input.question,previousId:input.previousId,followupIndex:input.followupIndex,language:input.language,mode:'hybrid'};
  const upstream=await fetch(base+'/api/chat',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:forwarded},body:JSON.stringify(payload),cache:'no-store',signal:request.signal});
  const headers=new Headers({'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'});
  const set=upstream.headers.get('set-cookie')||initial.headers.get('set-cookie');if(set)headers.set('Set-Cookie',set);
  const owner=demoOwner(request);if(!owner||!upstream.ok||!upstream.body)return new Response(upstream.body,{status:upstream.status,headers});
  const decoder=new TextDecoder();let buffer='';
  const record=(line:string)=>{if(!line.trim())return;const event=JSON.parse(line);if(event.type==='done'&&event.run&&z.string().uuid().safeParse(event.run.id).success&&typeof event.run.answer==='string')hybridStore().save(owner,input.conversationId,input.scope,event.run as StoredHybridRun);};
  const stream=upstream.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){buffer+=decoder.decode(chunk,{stream:true});if(buffer.length>12000000)throw Error('Response too large.');let index;while((index=buffer.indexOf('\n'))>=0){record(buffer.slice(0,index));buffer=buffer.slice(index+1);}controller.enqueue(chunk);},flush(){buffer+=decoder.decode();if(buffer.trim())record(buffer);}}));
  return new Response(stream,{status:upstream.status,headers});
 }catch{return Response.json({error:'The conversation service is unavailable. Existing messages are preserved.'},{status:503});}
}
