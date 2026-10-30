import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ConversationStore,conversationStore} from '../src/lib/conversation-store.ts';
import {withWealthRuntime,applyWealthPlan,wealthInstructions} from '../src/lib/wealth-runtime.ts';
import {geminiJSON,retryFitsBudget} from '../src/lib/gemini-json.ts';
import {AI_TIMEOUTS} from '../src/lib/ai-timeouts.ts';
import {newSession,newDemoOwner,signSession} from '../src/lib/server.ts';
import type {AssistantInput,AssistantEvent} from '../src/lib/assistant-contract.ts';
import {composeFed} from '../src/lib/fed-engine.ts';
import {composeResearch} from '../src/lib/research-engine.ts';

const directory=mkdtempSync(join(tmpdir(),'mercury-wealth-tests-'));
process.env.MERCURY_STATE_DIR=directory;
const originalFetch=globalThis.fetch;
const scope={household:'hh_okonkwo' as const,bank:'all',book:'all'};
const base:AssistantInput={conversationId:randomUUID(),requestId:randomUUID(),revision:1,message:'Review my portfolio',context:'Your whole portfolio',view:'overview',product:'phoenix',path:[100,98,96,94,97,95,92],history:[],portfolioScope:scope};
test.afterEach(()=>{globalThis.fetch=originalFetch;delete process.env.MERCURY_UI_CLASSIFIER;delete process.env.MERCURY_TOOL_REVIEW;});
test.after(()=>{conversationStore().close();rmSync(directory,{recursive:true,force:true});});
test('conversation survives database reopen, retains local assistant replies and isolates scopes',()=>{
 const file=join(directory,'reopen.sqlite');let db=new ConversationStore(file);
 const key=db.key('owner',base.conversationId!,scope);db.begin(key,base);db.finish(key,base,'Local portfolio result: AAPL exposure is measured.','complete');db.close();
 db=new ConversationStore(file);assert.equal(db.messages(key).length,2);assert.match(db.context(key,'AAPL')[1].text,/Local portfolio result/);
 assert.notEqual(key,db.key('owner',base.conversationId!,{...scope,bank:'other'}));assert.equal(db.messages(db.key('another-owner',base.conversationId!,scope)).length,0);db.close();
});
test('long history recalls relevant older turns and reset cannot be undone by a late response',()=>{
 const db=new ConversationStore(join(directory,'long.sqlite')),key=db.key('owner','long',scope);
 for(let i=0;i<24;i++){const input={...base,requestId:randomUUID(),message:i===0?'Discuss the semiconductor benchmark':'Unrelated topic '+i};db.begin(key,input);db.finish(key,input,i===0?'Benchmark: NASDAQ; reference window six months.':'Reply '+i,'complete');}
 assert.ok(db.context(key,'Return to the semiconductor benchmark').some(t=>t.text.includes('NASDAQ')));
 const pending={...base,requestId:randomUUID()};db.begin(key,pending);db.clear(key);db.finish(key,pending,'Late reply','complete');assert.equal(db.messages(key).length,0);assert.deepEqual(db.state(key),{topics:[]});assert.throws(()=>db.begin(key,pending),/RESET/);db.close();
});
test('cache has explicit expiry and a changed input key does not reuse another result',()=>{
 const db=new ConversationStore(join(directory,'cache.sqlite'));db.cache('scenario:snapshot-a:shock-20',{pnl:-20},1000);
 assert.equal(db.cached<{pnl:number}>('scenario:snapshot-a:shock-20')?.pnl,-20);assert.equal(db.cached('scenario:snapshot-b:shock-20'),undefined);assert.equal(db.cached('scenario:snapshot-a:shock-40'),undefined);assert.equal(db.cached('scenario:snapshot-a:shock-20',Date.now()+2000),undefined);db.close();
});
test('the signed demo identity survives a separate Node process restart',()=>{
 const expected=signSession('continuity-test');
 const script='import {signSession} from '+JSON.stringify(new URL('../src/lib/server.ts',import.meta.url).href)+';console.log(signSession("continuity-test"));';
 const actual=execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,MERCURY_STATE_DIR:directory}}).trim();
 assert.equal(actual,expected);
});
test('a thirty-second provider cooldown leaves a full explanation retry attempt',()=>{
 assert.equal(retryFitsBudget(50000-20000,30000,25000),false);
 assert.equal(retryFitsBudget(AI_TIMEOUTS.explanation-20000,30000,AI_TIMEOUTS.explanationAttempt),true);
 assert.equal(retryFitsBudget(1000,30000,25000),false);
});
test('resume checkpoints respect cooldown, request status and scope isolation',t=>{
 let now=100000;t.mock.method(Date,'now',()=>now);
 const db=new ConversationStore(join(directory,'resume.sqlite')),key=db.key('owner','conversation',scope);
 const input={...base,requestId:randomUUID()};db.begin(key,input);
 const plan={workflow:'portfolio' as const,portfolioFocus:'overview' as const,tools:['portfolio_context' as const],focus:'expectations' as const,meetingMonth:'nearest',historyDays:90 as const,goal:'Portfolio overview'};
 db.saveCheckpoint(key,input,plan,'gemini-3.6-flash');
 db.record(key,input,{type:'error',requestId:input.requestId,revision:1,stage:'explanation',code:'SERVICE_BUSY',retryAfterMs:30000,message:'Busy'});
 assert.equal(db.resume(key,input.requestId),undefined);
 db.finish(key,input,'','failed');assert.equal(db.resume(key,input.requestId)?.retryAfterMs,30000);
 assert.equal(db.resume(db.key('another-owner','conversation',scope),input.requestId),undefined);
 now+=30001;assert.equal(db.resume(key,input.requestId)?.retryAfterMs,0);
 now+=2*60*60*1000;assert.equal(db.resume(key,input.requestId),undefined);
 db.clear(key);assert.equal(db.resume(key,input.requestId),undefined);db.close();
});
test('skills are loaded on demand and high thinking has a sufficient output budget',async()=>{
 process.env.GEMINI_API_KEY='synthetic-wealth-key';let payload:any;
 globalThis.fetch=async(_url,init)=>{payload=JSON.parse(String(init?.body));return Response.json({status:'completed',model:'fixture-model',steps:[{type:'model_output',content:[{type:'text',text:'{"ok":true}'}]}]});};
 await withWealthRuntime({input:base,state:{topics:[]},skills:['mercury-response-ui'],depth:'medium'},async()=>{
  assert.doesNotMatch(wealthInstructions(),/# Mercury Product and Scenario Analysis/);
  applyWealthPlan({workflow:'portfolio',skills:['mercury-client-portfolio','mercury-product-scenario'],analysisDepth:'high'});
  await geminiJSON('Analyze the scenario',{}, {},new AbortController().signal,1400);
 });
 assert.equal(payload.generation_config.thinking_level,'high');assert.ok(payload.generation_config.max_output_tokens>=12288);assert.match(payload.system_instruction,/# Mercury Product and Scenario Analysis/);assert.match(payload.input,/demoData/);
});
test('default panel composition uses the validated plan without a Laya or extra model call',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No network expected');};
 const plan={workflow:'fed' as const,tools:['fed_rates' as const,'fed_markets' as const],focus:'history' as const,meetingMonth:'all',historyDays:90 as const,goal:'History and expected meetings'};
 const fed=await composeFed(base,plan,{rates:[],meetings:[],warnings:[],retrievedAt:'2026-10-28',ratesFetchedAt:null,marketsFetchedAt:null,ratesStale:false,marketsStale:false},new AbortController().signal);
 assert.deepEqual(fed.modules,['rate_history','meeting_comparison']);assert.equal(fed.composer.provider,'Local');
 const research=await composeResearch(base,{task:'history',symbols:['NVDA','AMD'],includeVolume:true,startDate:null,endDate:null,objective:'min_variance',cashPct:10,maxAssetPct:60,capital:1000000,costBps:10},{} as any,new AbortController().signal);
 assert.deepEqual(research.modules,['history_volume']);assert.equal(calls,0);
});

function tables(){return {imports:[],household:[{id:'hh_okonkwo',name:'Runtime Test Household'}],account:[{id:'account_one',household_id:'hh_okonkwo',custodian_id:'bank_one',account_number:'masked'}],portfolio:[{id:'book_one',account_id:'account_one',name:'Test Book'}],account_owner:[{id:'owner_one',account_id:'account_one',client_id:'client_one'}],client:[{id:'client_one',household_id:'hh_okonkwo',name:'Test Client'}],custodian:[{id:'bank_one',name:'Test Bank'}],position_valuation:[{id:'position_one',portfolio_id:'book_one',instrument_id:'inst_sn_aq_aapl',quantity:40,market_value_base_amount:1000,market_value_base_currency:'USD',market_value_amount:1000,market_value_currency:'USD',unrealized_pnl_amount:0,unrealized_pnl_currency:'USD',valued_at:'2026-06-19'}],instrument:[{id:'inst_sn_aq_aapl',name:'Apple accumulator',short_name:'Apple accumulator',type_id:'note_type',primary_ticker:'AAPL'}],instrument_type:[{id:'note_type',code:'Accumulator',category:'Structured Note',label:'Accumulator'}],instrument_classification:[],classification_value:[]};}
function request(path:string,body:unknown,cookie:string){return new Request('http://127.0.0.1:3001'+path,{method:'POST',headers:{host:'127.0.0.1:3001',origin:'http://127.0.0.1:3001','x-mercury-client':'portal','content-type':'application/json',cookie},body:JSON.stringify(body)});}
test('integrated streamed route retains approved context across long chats, model switch and scenarios',async()=>{
 process.env.ENABLE_LIVE_AI='true';process.env.GEMINI_API_KEY='synthetic-wealth-key';process.env.DEEPSEEK_API_KEY='synthetic-deepseek-key';process.env.SUPABASE_URL='https://ljrnllkklsumizsxhpwu.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';
 const {POST}=await import('../src/app/api/assistant/route.ts');
 const {POST:conversation}=await import('../src/app/api/conversation/route.ts');
 const cookie='mw_session='+newSession()+'; mw_owner='+newDemoOwner();const conversationId=randomUUID();let revision=0;const planningContexts:any[]=[];
 globalThis.fetch=async(url,init)=>{
  const target=String(url);if(target.includes('supabase.co'))return Response.json(tables()[target.split('mercury_v1_')[1].split('?')[0] as keyof ReturnType<typeof tables>]);
  assert.match(target,/api.deepseek.com/);const body=JSON.parse(String(init?.body));assert.equal(body.model,'deepseek-flash');const payload=JSON.parse(body.messages[1].content),task=payload.task;
  let result:unknown;
  if(body.messages[0].content.startsWith('Plan tasks')){
   planningContexts.push(payload.wealthContext);const scenario=/underlying|instead/i.test(task.message);
   result={workflow:'portfolio',tools:['portfolio_context'],goal:'Review selected client',analysisQuestions:['Analyze supplied portfolio'],portfolioFocus:scenario?'scenario':'overview',skills:scenario?['mercury-product-scenario']:['mercury-client-portfolio'],analysisDepth:'high',...(task.message.includes('40%')?{shockPct:-40,scenarioDays:20}:task.message.includes('20%')?{shockPct:-20}:{})};
  }else result={sections:[{heading:'Portfolio interpretation',text:task.task?.scenario?'The scenario accumulates {{scenario.shares}} shares, with a marked difference of {{scenario.pnl}}. The guaranteed period is excluded.':'The selected portfolio is {{portfolio.total}}. Its concentration should be assessed against the stated client objective.'}]};
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]});
 };
 async function send(message:string,model:'gemini-3.6-flash'|'gemini-3.1-flash-lite'='gemini-3.6-flash'){
  const response=await POST(request('/api/assistant',{...base,conversationId,requestId:randomUUID(),revision:++revision,message,history:[],geminiModel:model},cookie));assert.equal(response.status,200);
  const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));assert.equal(events.filter(e=>e.type==='error').length,0,JSON.stringify(events.filter(e=>e.type==='error')));assert.equal(events.at(-1).memorySaved,true);return events;
 }
 await send('Review my portfolio and remember the income objective.');for(let i=0;i<12;i++)await send('Continue this portfolio discussion, topic '+i);
 await send('Return to the income objective.','gemini-3.1-flash-lite');assert.ok(planningContexts.at(-1).recentConversation.some((m:any)=>m.text.includes('income objective')));assert.equal(planningContexts.at(-1).client.totalUSD,1000);
 const first=await send('Model my accumulator underlying down 40% over 20 trading days.');assert.equal(first.find(e=>e.type==='wealth_scenario').wealthScenario.shockPct,-40);
 const second=await send('Use 20% instead.');const scenario=second.find(e=>e.type==='wealth_scenario').wealthScenario;assert.equal(scenario.shockPct,-20);assert.equal(scenario.days,20);assert.equal(scenario.shares,1600);
 const read=await conversation(request('/api/conversation',{action:'read',conversationId,scope},cookie));assert.equal(read.status,200);assert.ok((await read.json()).messages.length>=32);
 const reset=await conversation(request('/api/conversation',{action:'reset',conversationId,scope},cookie));assert.equal(reset.status,200);
 const cleared=await conversation(request('/api/conversation',{action:'read',conversationId,scope},cookie));assert.equal((await cleared.json()).messages.length,0);
});
test('503 explanation recovery reuses the saved plan and client instead of repeating planning or source reads',async()=>{
 process.env.ENABLE_LIVE_AI='true';process.env.GEMINI_API_KEY='synthetic-wealth-key';process.env.DEEPSEEK_API_KEY='synthetic-deepseek-key';process.env.SUPABASE_URL='https://ljrnllkklsumizsxhpwu.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';
 const {POST}=await import('../src/app/api/assistant/route.ts');
 const cookie='mw_session='+newSession()+'; mw_owner='+newDemoOwner(),conversationId=randomUUID(),firstId=randomUUID();
 let plans=0,explanations=0,sourceReads=0,fail=true;
 globalThis.fetch=async(url,init)=>{
  const target=String(url);if(target.includes('supabase.co')){sourceReads++;return Response.json(tables()[target.split('mercury_v1_')[1].split('?')[0] as keyof ReturnType<typeof tables>]);}
  const body=JSON.parse(String(init?.body));
  if(body.messages[0].content.startsWith('Plan tasks')){plans++;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({workflow:'portfolio',portfolioFocus:'overview',tools:['portfolio_context'],goal:'Review holdings',analysisQuestions:['Review holdings']})}}]});}
  explanations++;if(fail)return new Response('{}',{status:503,headers:{'Retry-After':'0'}});
  assert.match(body.messages[1].content,/"resumingExplanation":true/);assert.equal(body.model,'deepseek-flash');
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({sections:[{heading:'Your portfolio',text:'The saved snapshot has a value of {{portfolio.total}}. The exposure should be assessed against your objective.'}]})}}]});
 };
 const initial=await POST(request('/api/assistant',{...base,conversationId,requestId:firstId,geminiModel:'gemini-3.6-flash'},cookie));
 const failed=(await initial.text()).trim().split('\n').map(line=>JSON.parse(line));
 const error=failed.find(e=>e.type==='error');assert.equal(error.code,'SERVICE_BUSY');assert.equal(error.stage,'explanation');assert.equal(error.resumeAvailable,true);assert.equal(plans,1);assert.equal(explanations,1);
 const previousReads=sourceReads;fail=false;
 const resumed=await POST(request('/api/assistant',{...base,conversationId,requestId:randomUUID(),resumeRequestId:firstId,geminiModel:'gemini-3.1-flash-lite'},cookie));
 assert.equal(resumed.status,200);const events=(await resumed.text()).trim().split('\n').map(line=>JSON.parse(line));
 assert.equal(events.filter(e=>e.type==='error').length,0,JSON.stringify(events));assert.match(events.find(e=>e.type==='reply').text,/\$1,000/);assert.equal(plans,1);assert.equal(explanations,2);assert.equal(sourceReads,previousReads);
});
