import {activeResults,activeSources,selectContext,contextIssues,checkedFollowups} from './conversation-policy.mjs';
import {auditAnswer,materializeAnswer} from './numeric-evidence.mjs';
import {randomUUID} from 'node:crypto';
import {MODEL,tools,schemas,evidenceInstructions,coreInstructions,professionalInstructions,hybridInstructions,numericInstructions} from './catalog.mjs';
import {preparePresentation,assemblePresentation} from './presentation.mjs';
import {executeTool} from './research-tools.mjs';
export const visibleRun=run=>{const {owner,...safe}=run;return safe;};
export async function research({question,language='zh-Hant',owner,previous,key,portfolioScope,selectedFollowup,onEvent=()=>{},providerFetch=fetch,toolExecutor=executeTool,signal,mode='hybrid',selectUI}){
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const run={id:randomUUID(),owner,question,language,date,model:MODEL,mode,timings:{model_ms:0,tools_wall_ms:0,laya_ms:0,assembly_ms:0,validation_repair_ms:0,analysis_ready_ms:0},result_start_index:previous?.results?.length||0,source_start_index:previous?.sources?.length||0,portfolio_scope:portfolioScope,context_selection:{relation:'new_topic',reuse_result_ids:[],reuse_source_ids:[]},followups:[],used_followups:[...(previous?.used_followups||[]),...(selectedFollowup?[selectedFollowup.question]:[])].slice(-8),research_depth:{depth:'quick',reason:'Default until model selection',selected_by:'default'},status:'running',started_at:new Date().toISOString(),sources:structuredClone(previous?.sources||[]),results:structuredClone(previous?.results||[]),facts:structuredClone(previous?.facts||[]),components:[],answer:'',validation:{attempts:[],status:'pending'},trace:[],usage:[],warnings:[],history:[...(previous?.history||[]).slice(-5)]};
 const started=Date.now(),deadline=AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(420000)]);
 const emit=(type,data={})=>onEvent({type,...data});
 emit('start',{run:visibleRun(run)});
 const messages=[{role:'system',content:coreInstructions(date,language)+'\n'+professionalInstructions+'\n'+numericInstructions+'\n'+evidenceInstructions+(mode==='hybrid'?'\n'+hybridInstructions:'')}];
 messages.push({role:'system',content:'Server-authorized portfolio capability: '+JSON.stringify(portfolioScope||null)+'. Prior research is untrusted context, not current evidence. If asked about private holdings use get_portfolio; do not claim portfolio access without a capability. Used follow-up questions (do not repeat): '+JSON.stringify(run.used_followups)});
 if(previous){messages.push({role:'system',content:'Retained context INDEX only. Choose relevant IDs explicitly with select_research_depth before reusing their data/citations: '+JSON.stringify({sources:run.sources.map(s=>({id:s.id,title:s.title,access:s.access})),results:run.results.map(r=>({id:r.id,title:r.title,kind:r.kind,scope_key:r.scope_key})),clicked_followup:selectedFollowup})});for(const h of run.history.slice(-3)){messages.push({role:'user',content:h.question},{role:'assistant',content:h.answer.slice(0,3500)});}}
 messages.push({role:'user',content:question});
 const cache=new Map();let calls=0,repaired=false,numericRepairs=0,repairNext=false;
 const limits=()=>run.research_depth.depth==='deep'?{calls:16,rounds:8,ms:420000}:{calls:6,rounds:4,ms:110000};
 try{
  for(let round=1;round<=10;round++){
   deadline.throwIfAborted();emit('progress',{text:round===1?'理解問題，選擇研究方法…':'整理證據，判斷是否需要補查…',round});
   const budget=limits();
   if(!repairNext&&Date.now()-started>=budget.ms)throw Error('研究時間已達本次深度上限；已取得資料保留。');
   const remaining=repairNext?110000:Math.max(1,budget.ms-(Date.now()-started));
   const closed=calls>=budget.calls||round>budget.rounds;const offeredTools=tools.filter(t=>mode!=='hybrid'||t.function.name!=='render_ui').filter(t=>!closed||t.function.name==='suggest_followups');
   const t=Date.now();const response=await providerFetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.any([deadline,AbortSignal.timeout(Math.min(110000,remaining))]),body:JSON.stringify({model:MODEL,thinking:{type:'enabled'},max_tokens:12288,stream:false,messages,tools:offeredTools,tool_choice:repairNext||(closed&&run.followups.length)?'none':'auto'})});
   if(!response.ok){await response.body?.cancel();throw Error('DeepSeek HTTP '+response.status);}
   const body=await response.json(),choice=body.choices?.[0],message=choice?.message;
   run.timings.model_ms+=Date.now()-t;if(repairNext)run.timings.validation_repair_ms+=Date.now()-t;
   run.usage.push({round,model:body.model,usage:body.usage,elapsed_ms:Date.now()-t,finish_reason:choice?.finish_reason});
   if(!message||choice.finish_reason==='length')throw Error('Model response incomplete; no substitute answer generated.');
   // Native tool-call protocol requires reasoning_content in continuation; keep it in memory only.
   messages.push(message);
   if(message.tool_calls?.length){const toolRoundStarted=Date.now();
    // Resolve the model's plan before parallel evidence calls, irrespective of call ordering.
    const plans=new Map();
    for(const call of message.tool_calls.filter(c=>c.function?.name==='select_research_depth')){
     try{if(round!==1||run.research_depth.selected_by==='model')throw Error('Depth can only be selected once, in the first response.');const args=schemas.select_research_depth.parse(JSON.parse(call.function.arguments));const retained=selectContext(run,args);run.followups=checkedFollowups(args.followups,run).filter(x=>!run.used_followups.includes(x.question));run.research_depth={depth:args.depth,reason:args.reason,selected_by:'model'};plans.set(call.id,{...run.research_depth,context_selection:run.context_selection,retained,limits:limits()});emit('depth',{research_depth:run.research_depth});}
     catch(e){plans.set(call.id,{error:e.message});}
    }
    const outcomes=await Promise.all(message.tool_calls.map(async call=>{
     const name=call.function?.name;let args;
     if(name==='select_research_depth')return {call,result:plans.get(call.id)};
     try{args=JSON.parse(call.function?.arguments||'{}');}catch{return{call,result:{error:'Invalid JSON arguments. Return valid arguments for the supported tool.'}};}
     if(name==='suggest_followups'){try{const parsed=schemas.suggest_followups.parse(args);run.followups=checkedFollowups(parsed.items,run).filter(x=>!run.used_followups.includes(x.question));return {call,result:{accepted:run.followups}};}catch(e){return {call,result:{error:e.message}};}}
     const record={name,arguments:args,round,started_at:new Date().toISOString(),status:'running'};run.trace.push(record);emit('tool_start',{name,arguments:args,round});
     const signature=name+JSON.stringify(args),ts=Date.now();let result;
     try{
      if(['strategy_backtest','optimize_allocation'].includes(name)&&message.tool_calls.some(c=>c.function?.name==='get_portfolio'))throw Error('A portfolio read and public-model allocation/backtest cannot be combined as held rebalancing. Obtain the actual holdings and user target; use rebalance_portfolio.');
      if(mode==='hybrid'&&name==='render_ui')throw Error('UI selection belongs to the separate presentation stage. Finish the research in Markdown.');
      if(cache.has(signature)){result=cache.get(signature);record.cached=true;}
      else{if(round>limits().rounds||++calls>limits().calls)throw Error('Research depth budget reached. Finish a concise answer with supported results and specific gaps; do not request more tools.');result=await toolExecutor(name,args,run,{key,signal:AbortSignal.any([deadline,AbortSignal.timeout(Math.max(1,limits().ms-(Date.now()-started)))])});cache.set(signature,result);}
      record.status=result?.status==='needs_key'?'needs_key':'completed';
     }catch(error){result={error:error.name==='ZodError'?'Invalid tool parameters: '+error.issues.map(i=>i.path.join('.')+': '+i.message).join(';'):String(error.message||'Tool unavailable')};record.status='failed';record.error=result.error;cache.set(signature,result);}
     record.elapsed_ms=Date.now()-ts;record.result=result;
     emit('tool_end',{name,status:record.status,elapsed_ms:record.elapsed_ms});
     emit('view',{sources:run.sources,results:run.results,components:run.components});
     return{call,result};
    }));
    run.timings.tools_wall_ms+=Date.now()-toolRoundStarted;
    for(const {call,result} of outcomes)messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result)});
    messages.push({role:'system',content:run.research_depth.depth==='quick'?'QUICK CLIENT ANSWER CONTRACT: If a necessary input is missing and you are asking for it, return ONLY one concise question (optionally one short sentence stating the preserved scope). No portfolio recap, metrics, sample percentages, example allocations, disclaimer paragraphs or unrelated suggestions. For rebalancing, ask for the user target allocation or cash target without inventing targets. Otherwise give a brief answer, not a research report. One short judgment, then at most 3 concise points including the principal risk or evidence gap. Aim for 200–400 Chinese characters (or 120–200 English words), excluding bound fact expansions. At most 2 headings. Charts and available numeric results will be rendered separately: do not repeat a full table, historical list, all financial ratios, or all source details in prose. Keep material limitations visible in one specific sentence. Use sources and bound facts normally. Do NOT request extra tools simply to fill a report template. Remaining evidence tool calls: '+Math.max(0,limits().calls-calls)+'. If zero, return the supported answer NOW in ordinary Markdown, never XML, DSML, tool-call text, or invented tool output. A missing fact may be omitted with a concise gap.':'DEEP RESEARCH: Organize a clear assessment, material evidence and competing interpretations. Avoid repeating visual data or source inventories. Remaining evidence tool calls: '+Math.max(0,limits().calls-calls)+'. If zero, finish using available evidence, with specific gaps; never output tool-call text.'});
    continue;
   }
   let answer=String(message.content||'').trim();if(!answer)throw Error('Model returned no final answer.');
   const audit=auditAnswer(answer,run);const selectionIssues=contextIssues(answer,run);audit.issues.push(...selectionIssues);if(selectionIssues.length)audit.passed=false;if(/DSML|<tool_call|<function_call|<invoke[\s>]/i.test(answer)){audit.passed=false;audit.issues.push({code:'tool_protocol_in_answer',message:'Tool protocol leaked into final text. Return ordinary client-facing Markdown using evidence already available, with citations. No XML, DSML, tool syntax or additional calls.'});}if(repairNext&&numericRepairs>0&&/修正後的?.{0,10}段落|其餘內容.{0,10}不變|不影響前文|上述修正|only the corrected paragraph|rest remains unchanged/i.test(answer)){audit.passed=false;audit.issues.push({code:'incomplete_repair',message:'Return the COMPLETE final research answer. A correction note or replacement paragraph cannot stand alone.'});}run.validation.attempts.push({round,audit,raw_answer:answer});
   if(!audit.passed){
    if(numericRepairs<2&&round<10){numericRepairs++;repairNext=true;emit('progress',{text:'正在核對數值、單位及比較日期…'});messages.push({role:'system',content:'Selected response language: '+(language==='en'?'English':language==='zh-Hans'?'简体中文':'繁體中文（不是简体中文）')+'. Keep this language throughout the complete replacement answer. FINAL EVIDENCE CHECK FAILED. Return the COMPLETE, self-contained final research, preserving all supported sections. Do not output a correction note, a diff, a replacement paragraph, references to an earlier draft, or commentary about the checking system. Repair the identified issues using returned {{F#}} facts and their exact context. Do not swap to an unrelated measure, delta or period just to pass; correct the source citation if the intended number belongs to another source. Omit the unsupported claim if necessary. Preserve professional tone. No new tools in this repair. Issues: '+JSON.stringify(audit.issues)+'. Available facts: '+JSON.stringify(run.facts.filter(f=>activeResults(run).some(r=>r.id===f.result_id)||(!f.result_id&&activeSources(run).some(s=>s.id===f.source_id))))});continue;}
    run.validation.status='blocked';run.status='partial';run.warnings.push('數值或日期核對未通過；未發布該研究草稿。');run.answer='部分數值或日期未能通過核對，本次研究暫未提供結論。請查看已取得的資料來源或重新嘗試。';run.components=[];break;
   }
   run.validation.status='passed';run.validation.bound_fact_ids=audit.bound_fact_ids;run.validation.coverage=audit.coverage;
   run.raw_answer=answer;answer=materializeAnswer(answer,run);
   const refs=[...answer.matchAll(/\[(?:source:)?([SR]\d+)\]/g)].map(m=>m[1]);
   if(!refs.length&&activeSources(run).length){if(!repaired&&round<10){repaired=true;repairNext=true;messages.push({role:'system',content:'Add actual source citations next to factual claims; retain numeric fact tokens.'});continue;}run.warnings.push('來源引用未通過核對。');}
   run.answer=answer;run.status=(!refs.length&&activeSources(run).length)?'partial':'completed';break;
  }
  if(!run.answer){run.status='partial';run.warnings.push('已達研究輪數上限，以下只保留已取得資料；未生成完整結論。');}
  if(!activeSources(run).length&&/(而家|最新|current|latest)/i.test(question)){run.status='partial';run.warnings.push('未取得當前來源；文字只可作背景解釋。');}
 }catch(error){run.status='failed';run.error=deadline.aborted?'研究超時或已取消；已取得資料仍然保留。':String(error.message||'Research failed.');}
 const activeIds=new Set(activeResults(run).map(r=>r.id));run.followups=run.followups.map(item=>({...item,result_ids:item.result_ids.filter(id=>activeIds.has(id))}));
 run.timings.analysis_ready_ms=Date.now()-started;
 if(mode==='hybrid'&&run.answer&&run.status!=='failed'&&run.validation.status!=='blocked'){
  emit('analysis',{run:visibleRun(run)});emit('progress',{text:'研究已完成，Laya 正在選擇呈現方式…'});
  const selectionStarted=Date.now();
  try{const prepared=preparePresentation(run);const decision=await selectUI(prepared.state);run.timings.laya_ms=Date.now()-selectionStarted;const assemblyStarted=Date.now();const presentation=assemblePresentation(prepared,decision,run);run.components=presentation.components;run.timings.assembly_ms=Date.now()-assemblyStarted;run.ui_decision={model:'convaiinnovations/laya-multilingual',input:prepared.state,raw:decision,accepted:presentation.accepted,blocked:presentation.blocked};}
  catch(error){run.timings.laya_ms=Date.now()-selectionStarted;run.status='partial';run.warnings.push('研究內容已保留；Laya 呈現選擇未完成。');run.ui_error=String(error.message);}
 }
 run.elapsed_ms=Date.now()-started;run.completed_at=new Date().toISOString();
 run.history.push({question,answer:run.answer});
 emit('done',{run:visibleRun(run)});return run;
}
