import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_TIMEOUTS,MAX_BRANCH_BUDGET} from '../src/lib/ai-timeouts.ts';
import {normalizeAnalysisPlan,planningSchema,planningInstruction} from '../src/lib/analysis-planner.ts';
import {geminiJSON} from '../src/lib/gemini-json.ts';
import {ProviderError,publicProviderError} from '../src/lib/assistant-server.ts';
import type {AssistantInput} from '../src/lib/assistant-contract.ts';

const input:AssistantInput={requestId:'bcf4c0e7-f2fb-43df-bf4f-78df5564fb14',revision:1,message:'Compare NVDA META AMD',context:'Public market research',view:'overview',product:'phoenix',path:[100,98,96,94,97,95,92],history:[]};
const research={task:'optimize' as const,symbols:['SPY','TLT','GLD'],startDate:'2026-01-01',endDate:'2026-10-23',objective:'risk_parity' as const,cashPct:20,maxAssetPct:50,capital:2000000,costBps:15};
const finance={workflow:'finance',tools:['market_history'],goal:'Compare public stock paths',analysisQuestions:['Compare the requested stock price paths'],researchPlan:{task:'history',symbols:['NVDA','META','AMD']}};
const response=()=>Response.json({model:'gemini-3.1-flash-lite',status:'completed',steps:[{type:'model_output',content:[{type:'text',text:'{"ok":true}'}]}]});
const originalFetch=globalThis.fetch,originalKey=process.env.GEMINI_API_KEY;
test.beforeEach(()=>{process.env.GEMINI_API_KEY='synthetic-unit-test-key';});
test.afterEach(()=>{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;});

test('whole workflow budget covers every branch plus a safety margin',()=>{
 assert.equal(MAX_BRANCH_BUDGET,220000);
 assert.ok(AI_TIMEOUTS.workflow>=MAX_BRANCH_BUDGET+5000);
 assert.ok(AI_TIMEOUTS.planning>=AI_TIMEOUTS.planningAttempt+30000+10000);
 assert.ok(AI_TIMEOUTS.explanation>=AI_TIMEOUTS.explanationAttempt+30000+5000);
});
test('compact finance plans need no irrelevant stock or meeting output',()=>{
 assert.deepEqual(planningSchema.required,['workflow','tools','goal','analysisQuestions']);
 assert.ok(planningInstruction.length<6000);
 const result=normalizeAnalysisPlan(finance,input);
 assert.deepEqual(result.researchPlan?.symbols,['NVDA','META','AMD']);
 assert.equal(result.researchPlan?.cashPct,10);assert.equal(result.researchPlan?.capital,1000000);
 assert.equal(result.stockQuery,undefined);
});
test('matching-asset follow-ups preserve model constraints and explicit overrides',()=>{
 const plan=normalizeAnalysisPlan({...finance,tools:['market_history','optimize_allocation'],researchPlan:{task:'optimize',symbols:research.symbols,cashPct:25}},{...input,researchContext:research});
 assert.equal(plan.researchPlan?.cashPct,25);assert.equal(plan.researchPlan?.maxAssetPct,50);
 assert.equal(plan.researchPlan?.objective,'risk_parity');assert.equal(plan.researchPlan?.startDate,'2026-01-01');
 const switched=normalizeAnalysisPlan(finance,{...input,researchContext:research});
 assert.equal(switched.researchPlan?.cashPct,10);assert.equal(switched.researchPlan?.startDate,null);
});
test('compact plans retain tool allowlists and refuse invalid amounts or missing tickers',()=>{
 assert.throws(()=>normalizeAnalysisPlan({...finance,researchPlan:{task:'history'}},input));
 assert.throws(()=>normalizeAnalysisPlan({...finance,tools:['arbitrary_python']},input));
 assert.throws(()=>normalizeAnalysisPlan({...finance,researchPlan:{...finance.researchPlan,cashPct:90}},input));
 assert.throws(()=>normalizeAnalysisPlan({...finance,researchPlan:{...finance.researchPlan,externalURL:'https://bad.example'}},input));
});
test('compact Fed and stock plans have branch-specific defaults and explicit context',()=>{
 const fed=normalizeAnalysisPlan({workflow:'fed',tools:['fed_rates'],goal:'Actual rate history',analysisQuestions:['Show actual EFFR history']},input);
 assert.equal(fed.meetingMonth,'nearest');assert.equal(fed.historyDays,90);
 const stock=normalizeAnalysisPlan({workflow:'stocks',tools:['yahoo_finance'],goal:'Continue the price chart',analysisQuestions:['Show its price']},{...input,stockContext:{symbol:'AAPL',range:'6mo'}});
 assert.equal(stock.stockQuery,'AAPL');assert.equal(stock.stockRange,'6mo');
});
test('503 Retry-After is honored before the single recovery attempt',async()=>{
 let calls=0,delay=0;const started=Date.now();
 globalThis.fetch=async()=>++calls===1?new Response('{}',{status:503,headers:{'Retry-After':'0.025'}}):response();
 const result=await geminiJSON('Test public connectivity.',{}, {},new AbortController().signal,256,{onRetry:ms=>{delay=ms;}});
 assert.equal(calls,2);assert.equal(delay,25);assert.ok(Date.now()-started>=20);assert.equal(result.attempts,2);
});
test('provider cooldown beyond remaining budget fails without sleeping or retrying',async()=>{
 let calls=0,retried=false;globalThis.fetch=async()=>{calls++;return new Response('{}',{status:503,headers:{'Retry-After':'120'}});};
 await assert.rejects(()=>geminiJSON('Test',{}, {},new AbortController().signal,256,{timeoutMs:1000,onRetry:()=>{retried=true;}}),e=>e instanceof ProviderError&&e.retryAfterMs===120000);
 assert.equal(calls,1);assert.equal(retried,false);
});
test('daily quota is distinct from overload and never automatically retried',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:{details:[{violations:[{quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}]}},{status:429});};
 try{await geminiJSON('Test',{}, {},new AbortController().signal);assert.fail('Expected quota error');}catch(error){assert.equal(publicProviderError(error,new AbortController().signal).code,'DAILY_QUOTA');}
 assert.equal(calls,1);
});
test('Interactions quota_exceeded is recognized without legacy RPC violation details',async()=>{
 globalThis.fetch=async()=>Response.json({error:{code:'quota_exceeded',message:'Daily quota reached'}},{status:429});
 await assert.rejects(()=>geminiJSON('Test',{}, {},new AbortController().signal),error=>publicProviderError(error,new AbortController().signal).code==='DAILY_QUOTA');
});
test('a timed-out attempt can recover inside its overall budget',async()=>{
 let calls=0;
 globalThis.fetch=async(_url,options)=>{
  if(++calls>1)return response();
  return new Promise<Response>((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(options.signal?.reason),{once:true}));
 };
 const result=await geminiJSON('Test',{}, {},new AbortController().signal,256,{timeoutMs:3000,attemptTimeoutMs:10});
 assert.equal(calls,2);assert.deepEqual(result.data,{ok:true});
});
test('cancelling during retry prevents a later provider request',async()=>{
 const controller=new AbortController();let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('{}',{status:503,headers:{'Retry-After':'30'}});};
 await assert.rejects(()=>geminiJSON('Test',{}, {},controller.signal,256,{onRetry:()=>controller.abort()}));
 assert.equal(calls,1);
});

test('reused research accepts date-only or equivalent midnight UTC dates and can omit fetch tools',()=>{
 const prior={...research,startDate:'2025-10-27',endDate:'2026-10-27'};
 const result=normalizeAnalysisPlan({...finance,researchMode:'reuse',tools:[],researchPlan:{task:prior.task,symbols:prior.symbols,startDate:'2025-10-27T00:00:00.000Z'}},{...input,researchContext:prior});
 assert.equal(result.researchPlan?.startDate,'2025-10-27');assert.equal(result.researchPlan?.endDate,'2026-10-27');
 const omitted=normalizeAnalysisPlan({...finance,researchMode:'reuse',tools:[],researchPlan:undefined},{...input,researchContext:prior});assert.deepEqual(omitted.researchPlan,prior);
});


test('adding an asset preserves the previous date window and allocation constraints',()=>{
 const plan=normalizeAnalysisPlan({...finance,tools:['market_history','optimize_allocation'],researchPlan:{task:'optimize',symbols:[...research.symbols,'MSFT']}},{...input,message:'Add MSFT',researchContext:research});
 assert.equal(plan.researchPlan?.startDate,research.startDate);assert.equal(plan.researchPlan?.cashPct,research.cashPct);assert.equal(plan.researchPlan?.maxAssetPct,research.maxAssetPct);assert.deepEqual(plan.researchPlan?.symbols,[...research.symbols,'MSFT']);
});

test('plain explanation follow-up preserves the existing research without requesting company news',()=>{
 const prior={...research,task:'history' as const,symbols:['XLE']};
 const plan=normalizeAnalysisPlan({...finance,researchMode:'investigate',tools:['company_news'],researchPlan:{task:'history',symbols:['XLE'],startDate:'2025-01-01'}},{...input,message:'Can you explain more?',researchContext:prior});
 assert.equal(plan.researchMode,'reuse');assert.deepEqual(plan.tools,[]);assert.deepEqual(plan.researchPlan,prior);
 const news=normalizeAnalysisPlan({...finance,researchMode:'investigate',tools:['company_news']},{...input,message:'Which news caused this move?',researchContext:prior});
 assert.equal(news.researchMode,'investigate');assert.deepEqual(news.tools,['company_news']);
});

test('plain single-stock elaboration keeps the same symbol and range instead of inventing news research',()=>{
 const plan=normalizeAnalysisPlan({...finance,researchMode:'investigate',tools:['company_news']},{...input,message:'Can you explain more?',stockContext:{symbol:'XLE',range:'6mo'}});
 assert.equal(plan.workflow,'stocks');assert.equal(plan.stockQuery,'XLE');assert.equal(plan.stockRange,'6mo');assert.equal(plan.researchPlan,undefined);
 const newQuestion=normalizeAnalysisPlan(finance,{...input,message:'Compare NVDA and META',stockContext:{symbol:'XLE',range:'6mo'}});
 assert.equal(newQuestion.workflow,'finance');
});
