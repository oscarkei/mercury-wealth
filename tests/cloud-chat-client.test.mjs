import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudChatResponse,cloudChatRead,readCloudTurns,clearCloudTurns} from '../src/lib/cloud-chat-client.ts';
const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};globalThis.window={location:{origin:'https://example.test'}};
const originalFetch=globalThis.fetch;
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.window;delete globalThis.localStorage;});
const payload={conversationId:'c1',question:'question',language:'en',scope:{bank:'all',book:'all'}};
const event=id=>({type:'done',conversationId:'c1',run:{id,question:'question',answer:'Answer',status:'completed',trace:[],results:[],sources:[],components:[]},continuation:'sealed-'+id});
test('direct stream persists only completed JSON and sends sealed context for follow-up',async()=>{
 let submitted;
 globalThis.fetch=async(path,init)=>{submitted=JSON.parse(init.body);const data=JSON.stringify(event('r1'))+'\n';return new Response(new ReadableStream({start(c){const bytes=new TextEncoder().encode(data);c.enqueue(bytes.slice(0,12));c.enqueue(bytes.slice(12));c.close();}}),{headers:{'Content-Type':'application/x-ndjson'}});};
 const response=await cloudChatResponse(payload,new AbortController().signal),rendered=JSON.parse((await response.text()).trim());
 assert.equal(rendered.continuation,undefined);assert.equal(readCloudTurns()[0].continuation,'sealed-r1');
 await (await cloudChatResponse({...payload,previousId:'r1'},new AbortController().signal)).text();assert.equal(submitted.continuation,'sealed-r1');
});
test('browser history is capped and restores rich result for the matching conversation',async()=>{
 for(let i=2;i<16;i++){globalThis.fetch=async()=>new Response(JSON.stringify(event('r'+i))+'\n',{headers:{'Content-Type':'application/x-ndjson'}});await (await cloudChatResponse(payload,new AbortController().signal)).text();}
 assert.equal(readCloudTurns().length,12);
 globalThis.fetch=async()=>{throw Error('Offline: saved results must not require a connection');};
 const restored=await (await cloudChatRead('/api/cloud-chat?run=r15&conversationId=c1')).json();assert.equal(restored.run.id,'r15');
 assert.equal((await cloudChatRead('/api/cloud-chat?run=r15&conversationId=c2')).status,404);
 clearCloudTurns('c1');assert.equal(readCloudTurns().length,0);
});
