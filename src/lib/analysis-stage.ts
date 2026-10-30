export type AnalysisStage='planning'|'company_data'|'portfolio_data'|'tool_review'|'research_data'|'fed_data'|'stock_data'|'composition'|'explanation'|'routing';
export type AnalysisService='Mercury'|'Gemini'|'Qwen'|'DeepSeek'|'Laya'|'Jev'|'Finance tools'|'Market data'|'Supabase';
export type StageDetails={stage:AnalysisStage;service:AnalysisService;timeout_ms:number};
export type StageProgress=StageDetails & {type:'progress';status:'started'|'completed'|'failed';elapsed_ms:number;text?:string};
export class StageFailure extends Error {
 details:StageDetails & {elapsed_ms:number};
 constructor(details:StageDetails & {elapsed_ms:number},cause:unknown){super('Analysis stage failed',{cause});this.details=details;}
}

// Keep stage ownership even when an SDK throws its own timeout/error type.
// Race the operation too: a non-cooperative SDK cannot keep the stream locked.
export async function analysisStage<T>(details:StageDetails,signal:AbortSignal,send:(event:StageProgress)=>void,operation:(signal:AbortSignal)=>Promise<T>):Promise<T>{
 const started=Date.now(),controller=new AbortController();
 const combined=AbortSignal.any([signal,controller.signal]);
 let timer:ReturnType<typeof setTimeout>|undefined;
 let abort:()=>void=()=>{};
 send({type:'progress',...details,status:'started',elapsed_ms:0});
 try{
  const cancelled=new Promise<never>((_,reject)=>{
   abort=()=>reject(combined.reason);
   if(combined.aborted)abort();else combined.addEventListener('abort',abort,{once:true});
   timer=setTimeout(()=>controller.abort(new DOMException('Stage timed out','TimeoutError')),details.timeout_ms);
  });
  if(combined.aborted)await cancelled;
  const value=await Promise.race([operation(combined),cancelled]);
  send({type:'progress',...details,status:'completed',elapsed_ms:Date.now()-started});
  return value;
 }catch(cause){
  const elapsed_ms=Date.now()-started;
  send({type:'progress',...details,status:'failed',elapsed_ms});
  throw new StageFailure({...details,elapsed_ms},cause);
 }finally{clearTimeout(timer);combined.removeEventListener('abort',abort);}
}
