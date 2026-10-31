'use client';
export async function cloudChatResponse(payload:unknown,signal:AbortSignal):Promise<Response>{
 const headers={'Content-Type':'application/json','x-mercury-client':'portal'};
 const initial=await fetch('/api/cloud-chat',{method:'POST',headers,body:JSON.stringify(payload),credentials:'same-origin',signal});
 if(!initial.ok)return initial;
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
