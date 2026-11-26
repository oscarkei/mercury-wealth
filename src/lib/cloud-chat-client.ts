'use client';
import type {HybridRun} from '../components/hybrid-chat-result';
export async function cloudChatResponse(payload:unknown,signal:AbortSignal):Promise<Response>{
 const headers={'Content-Type':'application/json','x-mercury-client':'portal'};
 const value=payload as {conversationId:string;previousId?:string;scope:{bank:string;book:string}};
 const prior=readCloudTurns().find(t=>t.run.id===value.previousId&&t.conversationId===value.conversationId);
 const body={...value,...(prior?.continuation?{continuation:prior.continuation}:{})};
 const initial=await fetch('/api/cloud-chat',{method:'POST',headers,body:JSON.stringify(body),credentials:'same-origin',signal});
 if(!initial.ok)return initial;
 if(initial.headers.get('Content-Type')?.includes('application/x-ndjson')){
  if(!initial.body)return initial;
  let pending='';const decoder=new TextDecoder(),encoder=new TextEncoder();
  const process=(line:string)=>{if(!line.trim())return '';const event=JSON.parse(line);if(event.type==='done'&&event.run){saveCloudTurn({conversationId:value.conversationId,scope:value.scope,run:event.run,continuation:event.continuation,at:Date.now()});delete event.continuation;}return JSON.stringify(event)+'\n';};
  return new Response(initial.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
   transform(chunk,controller){pending+=decoder.decode(chunk,{stream:true});if(pending.length>4000000)throw Error('Response too large.');let i;while((i=pending.indexOf('\n'))!==-1){controller.enqueue(encoder.encode(process(pending.slice(0,i))));pending=pending.slice(i+1);}},
   flush(controller){pending+=decoder.decode();if(pending.trim())controller.enqueue(encoder.encode(process(pending)));}
  })),{headers:{'Content-Type':'application/x-ndjson'}});
 }
 const {jobId}=await initial.json();if(typeof jobId!=='string')throw Error('Cloud service returned no job ID.');
 const encoder=new TextEncoder();
 const cancel=()=>{void fetch('/api/cloud-chat?job='+encodeURIComponent(jobId),{method:'DELETE',headers:{'x-mercury-client':'portal'},credentials:'same-origin',keepalive:true}).catch(()=>{});};
 const wait=()=>new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason);};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},1500);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
 const stream=new ReadableStream<Uint8Array>({async start(controller){
  signal.addEventListener('abort',cancel,{once:true});
  try{
   const end=Date.now()+8*60000;let failures=0;
   while(Date.now()<end){
    signal.throwIfAborted();let response:Response;
    try{response=await fetch('/api/cloud-chat?job='+encodeURIComponent(jobId),{credentials:'same-origin',cache:'no-store',signal});}catch(error){if(signal.aborted||++failures>3)throw error;await wait();continue;}
    const data=await response.json();if(!response.ok){if(response.status>=500&&++failures<=3){await wait();continue;}throw Error(data.error||'Cloud analysis is unavailable.');}failures=0;
    if(data.status==='failed')throw Error(data.error||'Analysis failed.');
    if(data.run)controller.enqueue(encoder.encode(JSON.stringify({type:data.status==='complete'?'done':'analysis',run:data.run})+'\n'));
    else controller.enqueue(encoder.encode(JSON.stringify({type:'progress',text:data.progress||'Analysis queued…'})+'\n'));
    if(data.status==='complete'){controller.close();return;}
    await wait();
   }
   cancel();throw Error('Analysis exceeded the waiting limit.');
  }catch(error){controller.error(error);}finally{signal.removeEventListener('abort',cancel);}
 },cancel});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson'}});
}

// JSON only, 12 completed turns and 2 MB per browser; no images or provider credentials.
const HISTORY_KEY='mercury-v05-cloud-turns-v1';
type CloudTurn={conversationId:string;scope:{bank:string;book:string};run:HybridRun;continuation?:string|null;at:number};
let volatileTurns:CloudTurn[]|null=null;
export function readCloudTurns():CloudTurn[]{
 if(volatileTurns)return volatileTurns;
 try{const saved=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(saved)?saved.filter(t=>t?.run?.id&&t?.conversationId&&Date.now()-t.at<7*86400000).slice(-12):[];}catch{return volatileTurns||[];}
}
function saveCloudTurn(turn:CloudTurn){
 // Validation attempts and trace duplicate source bodies; keep only the rendered result.
 const run={...turn.run,trace:[],usage:[],validation:undefined,raw_answer:undefined};
 const saved=[...readCloudTurns().filter(t=>t.run.id!==turn.run.id),{...turn,run}].slice(-12);
 while(saved.length&&new TextEncoder().encode(JSON.stringify(saved)).length>2000000)saved.shift();
 volatileTurns=saved;try{localStorage.setItem(HISTORY_KEY,JSON.stringify(saved));}catch{/* Browsing restrictions: current-tab history still works. */}
}
export function clearCloudTurns(conversationId:string){volatileTurns=readCloudTurns().filter(t=>t.conversationId!==conversationId);try{localStorage.setItem(HISTORY_KEY,JSON.stringify(volatileTurns));}catch{}}
export async function cloudChatRead(path:string,_init:RequestInit={}):Promise<Response>{
 // Saved public-demo results are local JSON: viewing them needs no model/session connection.
 const q=new URL(path,window.location.origin).searchParams,cid=q.get('conversationId'),id=q.get('run'),all=readCloudTurns();
 const conversationId=cid||all.at(-1)?.conversationId||null,turns=all.filter(t=>t.conversationId===conversationId);
 if(id){const turn=turns.find(t=>t.run.id===id);return Response.json(turn?{run:turn.run}:{error:'Saved result unavailable.'},{status:turn?200:404});}
 return Response.json({conversationId,turns:turns.map(({scope,run})=>({scope,run}))});
}
