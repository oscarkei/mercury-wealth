import {fedPlanSchema} from '../src/lib/fed-contract.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {researchPlanSchema,researchAnalysisSchema,type ResearchPlan} from '../src/lib/research-contract.ts';
import {runPlannedAssistant,planAnalysis} from '../src/lib/fed-engine.ts';
import {executeResearch,runResearchAnalysis} from '../src/lib/research-engine.ts';
import {scopedAssistantContext} from '../src/lib/assistant-context.ts';
import type {AssistantInput,AssistantEvent} from '../src/lib/assistant-contract.ts';
import {geminiJSON} from '../src/lib/gemini-json.ts';
import {generateReply} from '../src/lib/assistant-server.ts';

const input:AssistantInput={requestId:'bcf4c0e7-f2fb-43df-bf4f-78df5564fb14',revision:1,message:'Compare NVDA, META and AMD',context:'Public market research',view:'overview',product:'phoenix',path:[100,98,96,94,97,95,92],history:[]};
const research:ResearchPlan={task:'history',symbols:['NVDA','META','AMD'],startDate:'2026-01-01',endDate:'2026-10-23',objective:'min_variance',cashPct:10,maxAssetPct:60,capital:1000000,costBps:10};
const plan={workflow:'finance',tools:['market_history'],focus:'comparison',meetingMonth:'nearest',historyDays:90,meetingCount:3,analysisQuestions:['Compare historical stock price paths'],stockVolume:false,stockQuery:'',stockRange:'1y',goal:'Compare the supplied stock histories',researchPlan:research};
const gemini=(data:unknown)=>Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(data)}]}]});
const data={kind:'market_history',engine:'mercury-research-1.0.0',requested:{symbols:research.symbols},histories:research.symbols.map(symbol=>({symbol,provider:'OpenBB / Cboe',currency:'USD',basis:'provider_close_adjustment_unverified',retrieved_at:'2026-10-26T12:00:00Z',points:[{date:'2026-01-02',close:100,open:100,high:100,low:100,volume:1000},{date:'2026-10-23',close:110,open:110,high:110,low:110,volume:2000}],first_date:'2026-01-02',last_date:'2026-10-23',observations:2,price_change_pct:10,snapshot_id:'a'.repeat(64),status:'observed',cache_hit:false,stale:false})),warnings:['Synthetic unit-test fixture, not a live provider result.'],storage:'local_sqlite',retrieved_at:'2026-10-26T12:00:00Z',trace:[{tool:'market_history',library:'OpenBB',provider:'Cboe',status:'completed'}]};
const names=['GEMINI_API_KEY','GEMINI_MODEL','LAYA_BASE_URL','LAYA_API_KEY','FINANCE_BASE_URL','FINANCE_API_KEY'];
const saved=Object.fromEntries(names.map(k=>[k,process.env[k]])),fetcher=globalThis.fetch;
test.beforeEach(()=>{process.env.GEMINI_API_KEY='synthetic-key';process.env.LAYA_BASE_URL='http://127.0.0.1:8888';process.env.FINANCE_BASE_URL='http://127.0.0.1:8890';process.env.FINANCE_API_KEY='synthetic-private-finance-key-000000000000';});
test.afterEach(()=>{globalThis.fetch=fetcher;for(const k of names){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});

test('research parameters reject URLs, duplicate assets, unknown fields and infeasible targets',()=>{
 for(const invalid of [{...research,symbols:['https://bad.example']},{...research,symbols:['AAPL','AAPL']},{...research,providerURL:'https://bad.example'},{...research,task:'optimize',symbols:['SPY','TLT'],maxAssetPct:20}])assert.equal(researchPlanSchema.safeParse(invalid).success,false);
});
test('Gemini sees registered research tools and the active multi-asset context',async()=>{
 globalThis.fetch=async(_url,options)=>{const body=JSON.parse(String(options?.body));assert.match(body.system_instruction,/Riskfolio/);assert.match(body.input,/activeResearch/);return gemini(plan);};
 const result=await planAnalysis({...input,researchContext:research},new AbortController().signal);assert.equal(result.plan.workflow,'finance');assert.deepEqual(result.plan.researchPlan?.symbols,['NVDA','META','AMD']);
});
test('real research event is emitted before the explanation request, with Laya composition',async()=>{
 const events:AssistantEvent[]=[];let calls=0;
 globalThis.fetch=async(url,options)=>{
  if(String(url).includes(':8890')){assert.equal(new Headers(options?.headers).get('authorization'),'Bearer '+process.env.FINANCE_API_KEY);assert.deepEqual(JSON.parse(String(options?.body)).symbols,research.symbols);return Response.json(data);}
  if(String(url).includes(':8888'))return Response.json({model:'synthetic-laya',answers:{panel:{type:'choice',choice:'history_comparison',confidence:1}},usage:{input_tokens:100,output_tokens:0}});
  calls++;if(calls===1)return gemini(plan);if(calls===2)return gemini({action:'finish',reason:'History available'});assert.ok(events.some(e=>e.type==='research_analysis'));return gemini({sections:[{heading:'Observation',text:'Synthetic explanation of supplied evidence.'},{heading:'Limits',text:'Price history cannot prove causation.'}]});
 };
 await runPlannedAssistant(input,new AbortController().signal,e=>events.push(e));
 assert.equal(events.filter(e=>e.type==='done').length,1);const event=events.find(e=>e.type==='research_analysis');assert.ok(researchAnalysisSchema.safeParse(event?.researchAnalysis).success);assert.ok(events.findIndex(e=>e.type==='research_analysis')<events.findIndex(e=>e.type==='reply'));assert.equal(events.some(e=>e.type==='decision'),false);
});
test('a required volume panel survives a price-only local classifier preference',async()=>{
 const events:AssistantEvent[]=[];let calls=0;
 globalThis.fetch=async(url)=>{
  if(String(url).includes(':8890'))return Response.json(data);
  if(String(url).includes(':8888'))return Response.json({model:'synthetic-laya',answers:{panel:{type:'choice',choice:'history_comparison',confidence:.6}},usage:{input_tokens:100,output_tokens:0}});
  return gemini(++calls===1?{...plan,researchPlan:{...research,includeVolume:true}}:calls===2?{action:'finish',reason:'History available'}:{sections:[{heading:'Prices',text:'Price evidence.'},{heading:'Volume',text:'Volume evidence.'}]});
 };
 await runPlannedAssistant(input,new AbortController().signal,e=>events.push(e));const result=events.find(e=>e.type==='research_analysis')?.researchAnalysis;assert.deepEqual(result?.modules,['history_volume']);assert.equal(result?.composer.suggested,'history_comparison');
});
test('backend input failure gives a visible error and one done event, without synthetic results',async()=>{
 const events:AssistantEvent[]=[];globalThis.fetch=async(url)=>String(url).includes(':8890')?Response.json({error:'At least 90 common daily closes are required.'},{status:422}):gemini(plan);
 await runPlannedAssistant(input,new AbortController().signal,e=>events.push(e));assert.equal(events.some(e=>e.type==='research_analysis'),false);assert.equal(events.filter(e=>e.type==='done').length,1);assert.match(events.find(e=>e.type==='error')?.message||'',/90 common/);
});
test('research cannot send credentials or requests to a user-selected external endpoint',async()=>{
 process.env.FINANCE_BASE_URL='https://untrusted.example';let called=false;globalThis.fetch=async()=>{called=true;throw Error();};await assert.rejects(()=>executeResearch(research,new AbortController().signal));assert.equal(called,false);
});
test('live client facts use the selected imported household instead of the old Chan snapshot',()=>{
 const facts=scopedAssistantContext({...input,portfolioScope:{household:'hh_okonkwo',bank:'all',book:'all'}});assert.equal(facts.snapshot,'Okonkwo Family');assert.equal(facts.asOf,'2026-06-19');assert.ok(facts.total>28000000);assert.equal(facts.scenario,null);assert.equal(facts.holdings.length,23);
 assert.throws(()=>scopedAssistantContext({...input,portfolioScope:{household:'hh_okonkwo',bank:'unknown-bank',book:'all'}}));
});
test('account facts cannot be automatically forwarded by the generic Gemini reply tool',async()=>{
 let called=false;globalThis.fetch=async()=>{called=true;throw Error();};
 await assert.rejects(()=>generateReply({...input,portfolioScope:{household:'hh_okonkwo',bank:'all',book:'all'}},new AbortController().signal));assert.equal(called,false);
});
test('a temporary Gemini overload is retried only once within the same request',async()=>{
 let calls=0;globalThis.fetch=async()=>++calls===1?Response.json({error:'overloaded'},{status:503}):gemini({reply:'Recovered provider response'});
 const result=await geminiJSON('Use supplied evidence only.',{symbol:'SPY'},{type:'object'},new AbortController().signal);assert.equal(calls,2);assert.deepEqual(result.data,{reply:'Recovered provider response'});
 calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:'rate limited'},{status:429});};await assert.rejects(()=>geminiJSON('Test',{}, {},new AbortController().signal));assert.equal(calls,1);
});

for(const failureStage of ['planning','research_data','composition','explanation'] as const){
 test(`timeouts identify ${failureStage} and preserve any completed chart`,async()=>{
  const events:AssistantEvent[]=[];let modelCalls=0;
  globalThis.fetch=async(url,options)=>{
   const target=String(url);
   if(!target.includes(':8890')&&!target.includes(':8888')&&JSON.parse(String(options?.body)).response_format.schema.properties.action)return gemini({action:'finish',reason:'Evidence available'});
   const stage=target.includes(':8890')?'research_data':target.includes(':8888')?'composition':(JSON.parse(String(options?.body)).response_format.schema.properties.workflow?'planning':'explanation');
   if(stage===failureStage)throw new DOMException('Internal timeout contains secret-provider-details','TimeoutError');
   if(stage==='research_data')return Response.json(data);
   if(stage==='composition')return Response.json({model:'synthetic-laya',answers:{panel:{type:'choice',choice:'history_comparison',confidence:1}},usage:{input_tokens:10,output_tokens:0}});
   return gemini(stage==='planning'?plan:{reply:'Evidence explanation'});
  };
  await runPlannedAssistant(input,new AbortController().signal,e=>events.push(e));
  const error=events.find(e=>e.type==='error');
  assert.equal(error?.stage,failureStage);
  assert.equal(error?.service,failureStage==='composition'?'Laya':failureStage==='research_data'?'Finance tools':'Gemini');
  assert.equal(error?.code,'TIMEOUT');assert.doesNotMatch(error?.message||'',/secret-provider-details/);
  if(failureStage==='research_data'||failureStage==='composition')assert.doesNotMatch(error?.message||'',/Gemini/);
  assert.equal(events.some(e=>e.type==='research_analysis'),failureStage==='explanation');
  assert.equal(events.filter(e=>e.type==='done').length,1);
  assert.ok(events.some(e=>e.stage===failureStage&&e.status==='failed'));
 });
}
test('finance capacity failure is distinct from Gemini quota',async()=>{
 const events:AssistantEvent[]=[];
 globalThis.fetch=async url=>String(url).includes(':8890')?Response.json({error:'Busy'},{status:429}):gemini(plan);
 await runPlannedAssistant(input,new AbortController().signal,e=>events.push(e));
 const error=events.find(e=>e.type==='error');assert.equal(error?.code,'FINANCE_BUSY');assert.equal(error?.service,'Finance tools');assert.doesNotMatch(error?.message||'',/quota|Gemini/);
});

test('scoped demo follow-up retains server research and approved conversation history',async()=>{
 const analysis=researchAnalysisSchema.parse({plan:research,data,modules:['history_comparison'],composer:{provider:'Laya',model:'fixture',elapsed_ms:1,suggested:'history_comparison'},plannerModel:'fixture'});
 globalThis.fetch=async(_url,options)=>{const body=JSON.parse(String(options?.body));assert.match(body.input,/PRIVATE_HISTORY_MARKER/);assert.doesNotMatch(body.input,/PRIVATE_CONTEXT_MARKER/);const payload=JSON.parse(body.input);assert.deepEqual(payload.history,[{role:'assistant',text:'PRIVATE_HISTORY_MARKER'}]);assert.equal(payload.rememberedResearch.previousExplanation,'Prior public explanation');assert.deepEqual(payload.rememberedResearch.plan.symbols,['NVDA','META','AMD']);return gemini({...plan,researchMode:'reuse'});};
 const result=await planAnalysis({...input,message:'Why?',context:'PRIVATE_CONTEXT_MARKER',portfolioScope:{household:'hh_okonkwo',bank:'all',book:'all'},history:[{role:'assistant',text:'PRIVATE_HISTORY_MARKER'}]},new AbortController().signal,undefined,{analysis,reply:'Prior public explanation',savedAt:Date.now()});assert.equal(result.plan.researchMode,'reuse');
});
test('tool decision schema removes already-completed allocation from the model choices',async()=>{
 const {researchToolLoop}=await import('../src/lib/research-loop.ts');let decisions=0;
 globalThis.fetch=async(_url,options)=>{const body=JSON.parse(String(options?.body));const actions=body.response_format.schema.properties.action.enum;decisions++;assert.deepEqual(actions,decisions===1?['optimize_allocation','stop']:['finish','stop']);return gemini({action:decisions===1?'optimize_allocation':'finish',reason:'Observed result state'});};
 const result=await researchToolLoop({...research,task:'optimize'},new AbortController().signal,async p=>({...data,...(p.task==='optimize'?{optimization:{}}:{})}) as never,()=>{});assert.deepEqual(result.trace,['market_history','optimize_allocation']);assert.equal(decisions,2);
});

test('planner repairs one invalid structured plan and preserves public follow-up scope',async()=>{
 let calls=0,repairs=0;
 globalThis.fetch=async(_url,options)=>{calls++;const body=JSON.parse(String(options?.body));if(calls===1)return gemini({...plan,meetingMonth:'invalid'});assert.ok(JSON.parse(body.input).validationIssues.length);return gemini(plan);};
 const result=await planAnalysis(input,new AbortController().signal,undefined,undefined,()=>repairs++);assert.equal(result.plan.workflow,'finance');assert.equal(calls,2);assert.equal(repairs,1);
 calls=0;globalThis.fetch=async()=>{calls++;return gemini({...plan,meetingMonth:'invalid'});};await assert.rejects(()=>planAnalysis(input,new AbortController().signal));assert.equal(calls,2);
});

// Keep coverage for the explicitly optional legacy classifier.
test.beforeEach(()=>{process.env.MERCURY_UI_CLASSIFIER='laya';process.env.MERCURY_TOOL_REVIEW='model';});
test.afterEach(()=>{delete process.env.MERCURY_UI_CLASSIFIER;delete process.env.MERCURY_TOOL_REVIEW;});


test('resuming a research explanation reuses saved data without history, evidence or classifier calls',async()=>{
 const {withWealthRuntime}=await import('../src/lib/wealth-runtime.ts');
 const analysis=researchAnalysisSchema.parse({plan:research,data,modules:['history_comparison'],composer:{provider:'Local',model:'saved',elapsed_ms:0,suggested:'history_comparison'},plannerModel:'saved-model'});
 let calls=0;globalThis.fetch=async(url)=>{calls++;assert.match(String(url),/generativelanguage/);return gemini({sections:[{heading:'Comparison',text:'NVDA changed {{NVDA.change}} over the shared observation window.'},{heading:'Method',text:'This is a price comparison rather than a measure of total portfolio return.'}]});};
 const events:any[]=[];
 await withWealthRuntime({input,state:{topics:[]},skills:['mercury-market-research','mercury-response-ui'],depth:'medium',resume:{checkpoint:{input,plan:fedPlanSchema.parse({...plan,researchPlan:research}),model:'saved-model',createdAt:Date.now()},events:[{type:'research_analysis',requestId:input.requestId,revision:input.revision,researchAnalysis:analysis}]}},()=>runResearchAnalysis(input,research,'saved-model',AbortSignal.timeout(5000),e=>events.push(e),undefined,'refresh',['market_history']));
 assert.equal(calls,1);assert.equal(events.filter(e=>e.type==='error').length,0);assert.match(events.find(e=>e.type==='reply').text,/10.00%/);assert.deepEqual(events.find(e=>e.type==='research_analysis').researchAnalysis.data,data);
});
