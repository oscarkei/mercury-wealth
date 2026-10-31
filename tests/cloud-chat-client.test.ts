import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudChatResponse} from '../src/lib/cloud-chat-client.ts';
const original=globalThis.fetch;
test.afterEach(()=>{globalThis.fetch=original;});
test('browser cloud transport preserves scoped questions and consumes the async result protocol',async()=>{
 const payload={question:'對我持倉有咩影響',previousId:'previous',scope:{bank:'UBS',book:'all'}},calls:{url:string;body?:unknown}[]=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),body:init?.body?JSON.parse(String(init.body)):undefined});return init?.method==='POST'?Response.json({jobId:'job-test'},{status:202}):Response.json({status:'complete',run:{id:'run-test',answer:'Test',status:'completed'}});};
 const response=await cloudChatResponse(payload,new AbortController().signal);const event=JSON.parse((await response.text()).trim());
 assert.equal(event.type,'done');assert.equal(event.run.id,'run-test');assert.deepEqual(calls[0].body,payload);assert.deepEqual(calls.map(c=>c.url),['/api/cloud-chat','/api/cloud-chat?job=job-test']);
});
test('cloud connection failures are not turned into synthetic successful answers',async()=>{
 globalThis.fetch=async()=>Response.json({error:'Not connected'},{status:503});
 const response=await cloudChatResponse({},new AbortController().signal);assert.equal(response.status,503);assert.equal((await response.json()).error,'Not connected');
});
