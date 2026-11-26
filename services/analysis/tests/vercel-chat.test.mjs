import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSessions} from '../vercel/session.mjs';
import {createVercelChat} from '../vercel/service.mjs';
import {capability} from '../portfolio-bridge.mjs';
const secret='only-a-test-credential-0123456789',origin='https://example.test',cid=randomUUID();
const headers={host:'example.test',origin,'x-mercury-client':'portal','Content-Type':'application/json'};
const req=(path,body,cookie)=>new Request(origin+path,{method:'POST',headers:{...headers,...(cookie?{cookie}:{})},body:JSON.stringify(body)});
const body={conversationId:cid,question:'持倉概覽',language:'zh-Hant',scope:{bank:'all',book:'all'}};
test('encrypted continuation authenticates owner, conversation, scope and expiry',()=>{
 let clock=Date.now();const sessions=createSessions(secret,()=>clock),owner=randomUUID(),run={id:randomUUID(),portfolio_scope:capability(owner),answer:'private text',trace:[{secret:'not-needed'}]};
 const token=sessions.seal(run,owner,cid);assert.ok(!token.includes('private'));
 const open=(id=owner,conversation=cid,scope=run.portfolio_scope)=>sessions.open(token,id,conversation,scope,run.id);
 assert.equal(open().answer,run.answer);assert.equal(open().trace,undefined);
 assert.throws(()=>open(randomUUID()));assert.throws(()=>open(owner,randomUUID()));assert.throws(()=>open(owner,cid,capability(owner,'another')));
 assert.throws(()=>sessions.open(token.slice(0,20)+'x'+token.slice(21),owner,cid,run.portfolio_scope,run.id));
 clock+=9*3600000;assert.throws(()=>open());
});
test('direct stream saves no server job; follow-up works on a fresh instance',async()=>{
 const research=async args=>({id:randomUUID(),question:args.question,answer:args.previous?'follow-up':'first',portfolio_scope:args.portfolioScope,status:'completed',followups:[{question:'再解釋'}]});
 const make=()=>createVercelChat({key:secret,research,origins:[origin]});const first=make();
 const session=await first.handle(req('/api/session',{})),cookie=session.headers.get('set-cookie').split(';')[0];
 const response=await first.handle(req('/api/cloud-chat',body,cookie));assert.equal(response.status,200);
 const event=JSON.parse((await response.text()).trim());assert.equal(event.type,'done');assert.ok(event.continuation);
 const next=await make().handle(req('/api/cloud-chat',{...body,question:'再解釋',previousId:event.run.id,continuation:event.continuation,followupIndex:0},cookie));
 assert.equal(JSON.parse((await next.text()).trim()).run.answer,'follow-up');
 const wrong=await make().handle(req('/api/cloud-chat',{...body,previousId:event.run.id},cookie));assert.equal(wrong.status,409);
});
test('rejects missing key, invalid origin, unauthenticated and injected scope before model calls',async()=>{
 let calls=0;const app=createVercelChat({key:secret,origins:[origin],research:()=>{calls++;}});
 assert.equal((await createVercelChat({origins:[origin]}).handle(req('/api/session',{}))).status,503);
 assert.equal((await app.handle(new Request(origin+'/api/session',{method:'POST',headers:{...headers,origin:'https://evil.test'}}))).status,403);
 assert.equal((await app.handle(req('/api/cloud-chat',body))).status,401);
 const cookie=(await app.handle(req('/api/session',{}))).headers.get('set-cookie').split(';')[0];
 assert.equal((await app.handle(req('/api/cloud-chat',{...body,scope:{...body.scope,household:'other'}},cookie))).status,400);
 assert.equal((await app.handle(req('/api/cloud-chat',{...body,scope:{book:'unknown',bank:'all'}},cookie))).status,403);assert.equal(calls,0);
});
test('one running analysis rejects concurrent work and releases slot on cancellation',async()=>{
 let started;const began=new Promise(r=>started=r);
 const app=createVercelChat({key:secret,origins:[origin],research:async({signal})=>{started();await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));throw Error('aborted');}});
 const cookie=(await app.handle(req('/api/session',{}))).headers.get('set-cookie').split(';')[0];
 const response=await app.handle(req('/api/cloud-chat',body,cookie));await began;
 assert.equal((await app.handle(req('/api/cloud-chat',body,cookie))).status,429);
 await response.body.cancel();
});
test('prefilled action authenticates saved template and bounded input before research',async()=>{
 let received;
 const research=async args=>{received=args;return {id:randomUUID(),question:args.question,answer:'calculated',portfolio_scope:args.portfolioScope,status:'completed',followups:[{question:'Cash {value}%',input:{min:0,max:100,value:10}}]};};
 const make=()=>createVercelChat({key:secret,research,origins:[origin]});const app=make(),cookie=(await app.handle(req('/api/session',{}))).headers.get('set-cookie').split(';')[0];
 const first=JSON.parse((await(await app.handle(req('/api/cloud-chat',body,cookie))).text()).trim());
 const payload={...body,question:'Cash 15%',previousId:first.run.id,continuation:first.continuation,followupIndex:0,followupValue:15};
 assert.equal((await make().handle(req('/api/cloud-chat',{...payload,question:'Cash 80%'},cookie))).status,400);
 assert.equal((await make().handle(req('/api/cloud-chat',{...payload,followupValue:101},cookie))).status,400);
 const response=await make().handle(req('/api/cloud-chat',payload,cookie));await response.text();assert.equal(received.selectedFollowup.question,'Cash 15%');
});
