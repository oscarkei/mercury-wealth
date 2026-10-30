import test from 'node:test';
import assert from 'node:assert/strict';
import { decision, gemini, scenarioFor, newSession, hasSession, sameOrigin, requestSchema, type ChatInput } from '../src/lib/server.ts';

const input:ChatInput={message:'我張note跌20%會點',requestId:'bcf4c0e7-f2fb-43df-bf4f-78df5564fb14',revision:1,context:'note',shock:-40,route:'sp',history:[]};
const originalFetch=globalThis.fetch;
test.afterEach(()=>{globalThis.fetch=originalFetch;delete process.env.TYPESAFE_API_KEY;delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;});
function jevResponse(route='sp',focus='downside'){
 return Response.json({model:'fake-jev',answers:{workspace:{type:'choice',choice:route,confidence:1,probabilities:{[route]:1}},focus:{type:'choice',choice:focus,confidence:1,probabilities:{[focus]:1}}},usage:{input_tokens:1,output_tokens:1}});
}
function geminiResponse(){
 const enc=new TextEncoder();
 const body=new ReadableStream({start(s){for(const text of ['本金回款 HK$100,000，','合計 HK$104,000。']){const wire='data: '+JSON.stringify({candidates:[{content:{parts:[{text}]}}],modelVersion:'fake-gemini'})+'\n\n';const b=enc.encode(wire);s.enqueue(b.slice(0,13));s.enqueue(b.slice(13,40));s.enqueue(b.slice(40));}s.close();}});
 return new Response(body,{headers:{'Content-Type':'text/event-stream'}});
}
test('signed sessions reject altered tokens and cross-origin requests',()=>{
 const token=newSession(),r=new Request('http://localhost:3000/api/chat',{headers:{cookie:'mw_session='+token,host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','x-mercury-client':'portal'}});
 assert.ok(hasSession(r));assert.ok(sameOrigin(r));assert.equal(hasSession(new Request(r,{headers:{cookie:'mw_session='+token.slice(0,-1)+'X'}})),false);
 assert.equal(sameOrigin(new Request(r,{headers:{host:'127.0.0.1:3000',origin:'https://evil.example','x-mercury-client':'portal'}})),false);
});
test('provider inputs reject unknown scopes, empty messages and external data props',()=>{
 assert.ok(requestSchema.safeParse(input).success);
 assert.equal(requestSchema.safeParse({...input,household:'someone-else'}).success,false);
 assert.equal(requestSchema.safeParse({...input,context:'another-account'}).success,false);
 assert.equal(requestSchema.safeParse({...input,message:''}).success,false);
 assert.equal(scenarioFor(input).shock,-20);assert.equal(scenarioFor({...input,message:'我股票跌40%',context:'overview'}).shock,-40);
});
test('Jev uses typed SDK questions and returns a validated dynamic composition',async()=>{
 process.env.TYPESAFE_API_KEY='test-only-not-a-real-key';
 globalThis.fetch=async()=>jevResponse();
 const d=await decision(input,new AbortController().signal);
 assert.equal(d.route,'sp');assert.equal(d.spec?.focus,'downside');assert.ok(d.spec?.components.includes('Comparison'));assert.equal(d.scenario.total,104000);
});
test('unknown Jev route is rejected rather than rendered',async()=>{
 process.env.TYPESAFE_API_KEY='test-only-not-a-real-key';globalThis.fetch=async()=>jevResponse('execute-trade');
 await assert.rejects(()=>decision(input,new AbortController().signal));
});
test('Gemini SSE parser preserves split UTF-8 and shares the exact scenario facts',async()=>{
 process.env.GEMINI_API_KEY='test-only-not-a-real-key';let sent:Record<string,unknown>={};
 globalThis.fetch=async(_url,options)=>{sent=JSON.parse(String(options?.body));return geminiResponse();};
 const events:Record<string,unknown>[]=[];
 const result=await gemini(input,new AbortController().signal,e=>events.push(e));
 assert.equal(events.length,2);assert.equal(result.text,'本金回款 HK$100,000，合計 HK$104,000。');assert.equal(result.scenario.total,104000);
 assert.match(JSON.stringify(sent),/104000/);assert.match(JSON.stringify(sent),/0.35/);
});
test('independent requests start before either provider completes',async()=>{
 process.env.TYPESAFE_API_KEY='test-only-not-a-real-key';process.env.GEMINI_API_KEY='test-only-not-a-real-key';
 const started:string[]=[],completed:string[]=[];let releaseJev:()=>void=()=>{},startedJev:()=>void=()=>{};const holdJev=new Promise<void>(r=>{releaseJev=r;}),jevStarted=new Promise<void>(r=>{startedJev=r;});
 globalThis.fetch=async(url)=>{if(String(url).includes('typesafe')){started.push('Jev');startedJev();await holdJev;return jevResponse();}started.push('Gemini');await jevStarted;return geminiResponse();};
 const a=decision(input,new AbortController().signal).then(x=>{completed.push('Jev');return x;});
 const b=gemini(input,new AbortController().signal,()=>{}).then(x=>{completed.push('Gemini');return x;});
 await b;assert.deepEqual(new Set(started),new Set(['Jev','Gemini']));assert.deepEqual(completed,['Gemini']);releaseJev();await a;assert.deepEqual(completed,['Gemini','Jev']);
});
test('one provider failure does not prevent the other provider from succeeding',async()=>{
 process.env.TYPESAFE_API_KEY='test-only-not-a-real-key';process.env.GEMINI_API_KEY='test-only-not-a-real-key';
 globalThis.fetch=async(url)=>String(url).includes('typesafe')?new Response('{}',{status:503}):geminiResponse();
 const results=await Promise.allSettled([decision(input,new AbortController().signal),gemini(input,new AbortController().signal,()=>{})]);
 assert.equal(results[0].status,'rejected');assert.equal(results[1].status,'fulfilled');
});
