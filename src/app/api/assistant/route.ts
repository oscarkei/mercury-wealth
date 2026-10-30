import {fedPlanSchema} from '../../../lib/fed-contract.ts';
import {familySnapshotSchema} from '../../../lib/family-contract.ts';
import {runPlannedAssistant} from '../../../lib/fed-engine.ts';
import {assistantInputSchema,type AssistantEvent} from '../../../lib/assistant-contract.ts';
import {connectionStatus,hasCredential} from '../../../lib/assistant-server.ts';
import {hasSession,localRequest,sameOrigin,demoOwner} from '../../../lib/server.ts';
import {withGeminiModel} from '../../../lib/gemini-model-server.ts';
import {conversationStore} from '../../../lib/conversation-store.ts';
import {withWealthRuntime,type WealthRuntime} from '../../../lib/wealth-runtime.ts';
import {loadWealthClient} from '../../../lib/wealth-client.ts';
import {AI_TIMEOUTS} from '../../../lib/ai-timeouts.ts';
export const runtime='nodejs';
export const maxDuration=240;
const running=new Set<string>();
export async function POST(request:Request){
 if(!sameOrigin(request)||!hasSession(request)||!localRequest(request))return Response.json({error:'A local Mercury session is required.'},{status:403});
 if(!connectionStatus().ready)return Response.json({error:'An AI provider is not configured or live AI is disabled.'},{status:503});
 let input;try{const text=await request.text();if(text.length>260000)throw Error();input=assistantInputSchema.parse(JSON.parse(text));}catch{return Response.json({error:'Invalid message or scenario.'},{status:400});}
 if(!hasCredential(process.env.DEEPSEEK_API_KEY))return Response.json({error:'DeepSeek is not configured. Set DEEPSEEK_API_KEY locally and restart Mercury.'},{status:503});
 // Server-owned model lock, including stale browser preferences and resume attempts.
 input.geminiModel='deepseek-flash';
 const owner=demoOwner(request);if(!owner||!input.conversationId)return Response.json({error:'Refresh the connection to initialize persistent conversation memory.'},{status:409});
 const store=conversationStore(),key=store.key(owner,input.conversationId,input.portfolioScope);
 if(running.has(key))return Response.json({error:'Wait for the current response or cancel it before retrying.'},{status:429});
 const recovery=input.resumeRequestId?store.resume(key,input.resumeRequestId):undefined;
 if(input.resumeRequestId&&!recovery)return Response.json({error:'No resumable explanation was found for this conversation and scope. Send a new question.'},{status:409});
 if(recovery&&recovery.retryAfterMs>0)return Response.json({error:`The provider cooldown has not finished. Retry in ${Math.ceil(recovery.retryAfterMs/1000)} seconds.`,retryAfterMs:recovery.retryAfterMs},{status:429,headers:{'Retry-After':String(Math.ceil(recovery.retryAfterMs/1000))}});
 if(recovery){
  const latest=input;input=assistantInputSchema.parse({...recovery.checkpoint.input,conversationId:latest.conversationId,requestId:latest.requestId,revision:latest.revision,geminiModel:latest.geminiModel,resumeRequestId:latest.resumeRequestId});
  input.geminiModel='deepseek-flash';
  recovery.checkpoint.plan=fedPlanSchema.parse(recovery.checkpoint.plan);
  if(recovery.checkpoint.client)recovery.checkpoint.client=familySnapshotSchema.parse(recovery.checkpoint.client);
 }
 const state=store.state(key),history=store.context(key,input.message);
 if(!recovery)input.history=history; // Only server-owned, scope-keyed history is trusted.
 if(!recovery&&!input.researchContext&&state.research)input.researchContext=state.research.analysis.plan;
 if(!recovery&&!input.stockContext){const last=state.topics.findLast(t=>t.kind==='stock_analysis')?.result as {range:'1mo'|'3mo'|'6mo'|'1y';data:{quote?:{symbol:string}}}|undefined;if(last?.data.quote)input.stockContext={symbol:last.data.quote.symbol,range:last.range};}
 if(!recovery&&!input.fedContext){const last=state.topics.findLast(t=>t.kind==='analysis')?.result as {plan:{meetingMonth:string;historyDays:30|90|180}}|undefined;if(last)input.fedContext={question:'Previous rate analysis',meetingMonth:last.plan.meetingMonth,historyDays:last.plan.historyDays};}
 try{store.begin(key,input);}catch{return Response.json({error:'This request has already been recorded. Send a new message to continue.'},{status:409});}
 running.add(key);
 const controller=new AbortController(),encoder=new TextEncoder();let open=true,reply='',failed=false,hasResult=false,persisted=false;
 const cancel=()=>controller.abort();request.signal.addEventListener('abort',cancel,{once:true});
 const context:WealthRuntime={input,state,skills:['mercury-response-ui'],depth:'medium',client:recovery?.checkpoint.client,resume:recovery,onPlan:plan=>store.setPlan(key,plan),saveCheckpoint:(plan,model)=>store.saveCheckpoint(key,input,plan,model,context.client,recovery?recovery.checkpoint.research:state.research)};
 let timer:ReturnType<typeof setTimeout>;
 const stream=new ReadableStream({async start(sink){
  const push=(event:AssistantEvent)=>{
   if(event.type==='done')return;
   if(event.type==='reply')reply=event.text||'';
   if(event.type==='error'){failed=true;if(event.stage==='explanation'&&['SERVICE_BUSY','TIMEOUT','PROVIDER_FAILED','EVIDENCE_INVALID','SCHEMA_INVALID','RATE_LIMIT'].includes(event.code||'')&&store.checkpoint(key,input.requestId))event.resumeAvailable=true;}
   if(['research_analysis','stock_analysis','analysis','portfolio_impact','wealth_scenario'].includes(event.type))hasResult=true;
   store.record(key,input,event);
   if(open)try{sink.enqueue(encoder.encode(JSON.stringify(event)+'\n'));}catch{open=false;controller.abort();}
  };
  timer=setTimeout(()=>{failed=true;push({type:'error',code:'WORKFLOW_TIMEOUT',message:'The analysis reached its time limit. Completed results have been retained.',requestId:input.requestId,revision:input.revision});controller.abort();},AI_TIMEOUTS.workflow);
  try{
   await withWealthRuntime(context,async()=>{
    if(input.portfolioScope&&!context.client){
     push({type:'progress',text:'Restoring your conversation and selected portfolio context…',requestId:input.requestId,revision:input.revision});
     try{context.client=await loadWealthClient(input.portfolioScope,controller.signal,/refresh|更新|重新查/i.test(input.message));}catch{context.clientError='The selected portfolio source is unavailable; public research can continue, but do not invent holdings.';}
    }
    const run=()=>runPlannedAssistant(input,controller.signal,push,recovery?recovery.checkpoint.research:state.research);
    await (input.geminiModel?withGeminiModel(input.geminiModel,run):run());
   });
  }catch{failed=true;if(open)push({type:'error',code:'ANALYSIS_FAILED',message:'The analysis did not complete. Previously completed results remain available.',requestId:input.requestId,revision:input.revision});}
  finally{
   clearTimeout(timer);running.delete(key);request.signal.removeEventListener('abort',cancel);
   try{store.finish(key,input,reply,failed?(reply||hasResult?'partial':'failed'):'complete');persisted=true;}catch{if(open)sink.enqueue(encoder.encode(JSON.stringify({type:'error',code:'MEMORY_WRITE_FAILED',message:'This response could not be saved for recall.',requestId:input.requestId,revision:input.revision})+'\n'));}
   if(open){sink.enqueue(encoder.encode(JSON.stringify({type:'done',requestId:input.requestId,revision:input.revision,memorySaved:persisted})+'\n'));open=false;sink.close();}
  }
 },cancel(){open=false;failed=true;controller.abort();}});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'}});
}
