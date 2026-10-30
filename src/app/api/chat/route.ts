import { decision, gemini, hasSession, localRequest, requestSchema, sameOrigin, scenarioFor } from '../../../lib/server';
import { infer, compose, mockReply } from '../../../lib/domain';
export const runtime='nodejs';
export const maxDuration=60;
const slots=new Map<string,number>();
export async function POST(request:Request) {
  if(!sameOrigin(request)||!hasSession(request))return Response.json({error:'SESSION_OR_ORIGIN_INVALID'},{status:403});
  if(!localRequest(request))return Response.json({error:'REMOTE_TRIAL_NOT_PROVISIONED'},{status:503});
  let input;
  try{const text=await request.text();if(text.length>25000)throw new Error();input=requestSchema.parse(JSON.parse(text));scenarioFor(input);}catch{return Response.json({error:'訊息或情境格式無效；情境範圍為 -100% 至 +30%。'},{status:400});}
  const key=request.headers.get('cookie')||'';
  if((slots.get(key)||0)>=1)return Response.json({error:'請先等目前對話完成。'},{status:429});
  const mode=request.headers.get('x-mercury-mode')==='live'?'live':'mock';
  if(mode==='live')return Response.json({error:'This legacy live endpoint is disabled. Use the Qwen chat endpoint.'},{status:503});
  slots.set(key,1);
  const id=input.requestId,revision=input.revision,controller=new AbortController();
  const deadline=setTimeout(()=>controller.abort(),35000);
  request.signal.addEventListener('abort',()=>controller.abort(),{once:true});
  const encoder=new TextEncoder();
  const stream=new ReadableStream({
    async start(sink) {
      let open=true;
      const emit=(event:Record<string,unknown>)=>{if(open&&!controller.signal.aborted){try{sink.enqueue(encoder.encode(JSON.stringify({...event,requestId:id,revision})+'\n'));}catch{open=false;controller.abort();}}};
      try {
        emit({type:'start',mode});
        if(mode==='mock'){
          const result=infer(input.message,input.context),scenario=scenarioFor(input);
          emit({type:'decision',route:result.route,spec:result.route==='clarify'?null:compose(result.route,result.focus),scenario,elapsed_ms:0,model:'local-rules-v1'});
          emit({type:'reply',text:mockReply(result.route,scenario.shock),scenario,model:'reviewed-demo-copy',elapsed_ms:0});
        }else{
          const branch=async(name:string,run:()=>Promise<Record<string,unknown>>)=>{try{emit(await run());}catch{emit({type:'error',provider:name,message:controller.signal.aborted?'供應商逾時或請求已取消。':'供應商未能完成。請檢查模型權限、額度或連線；原工作區保留。'});}};
          await Promise.all([branch('Jev',()=>decision(input,controller.signal)),branch('Gemini',()=>gemini(input,controller.signal,emit))]);
        }
        emit({type:'done'});
      }finally{clearTimeout(deadline);slots.delete(key);if(open){try{sink.close();}catch{}}}
    },cancel(){controller.abort();slots.delete(key);clearTimeout(deadline);}
  });
  return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'}});
}
