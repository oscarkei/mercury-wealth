import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultReferencePlan,submittedPlan,interactionSchema,inputRequestSchema,patchReferenceFollowup,wantsRiskDisplay} from '../src/lib/interactive-ui.ts';
import {researchPlanSchema} from '../src/lib/research-contract.ts';
import {normalizeAnalysisPlan} from '../src/lib/analysis-planner.ts';
import {assistantInputSchema} from '../src/lib/assistant-contract.ts';
const plan={...defaultReferencePlan(),symbols:['AAPL','MSFT'],startDate:'2025-10-01',endDate:'2026-10-01',costBps:12};
test('only supported actions can submit; executable markup is rejected',()=>{
 assert.equal(interactionSchema.safeParse({kind:'trade',plan}).success,false);
 assert.equal(inputRequestSchema.safeParse({version:'1',kind:'html',question:'x',html:'<script/>'}).success,false);
 assert.equal(inputRequestSchema.safeParse({version:'1',kind:'rebalance',question:'x',url:'https://evil.invalid'}).success,false);
});
test('submission preserves the complete confirmed plan without a model rewrite',()=>{
 const result=submittedPlan({kind:'rebalance',plan});assert.deepEqual(result.researchPlan,plan);assert.deepEqual(result.tools,['market_history','optimize_allocation']);
});
test('one-field follow-up retains every other parameter',()=>{
 assert.deepEqual(patchReferenceFollowup('現金改 20%',plan),{...plan,cashPct:20});
 assert.equal(patchReferenceFollowup('cash 20% and add TSLA',plan),undefined);
 assert.throws(()=>patchReferenceFollowup('cash 90%',plan));
});
test('reject infeasible allocations, duplicated tickers and invalid calendar ranges',()=>{
 for(const p of [{...plan,cashPct:0,maxAssetPct:10},{...plan,symbols:['SPY','SPY']},{...plan,startDate:'2026-02-30'},{...plan,startDate:'2026-10-02'}])assert.equal(researchPlanSchema.safeParse(p).success,false);
});
test('presentation intent is narrowly recognized without catching financial changes',()=>{
 assert.equal(wantsRiskDisplay('顯示風險貢獻'),true);assert.equal(wantsRiskDisplay('show risk contributions and cash 30%'),false);
});
test('completed analysis cannot also request unsupported input',()=>{
 const input=assistantInputSchema.parse({requestId:'00000000-0000-4000-8000-000000000001',revision:0,message:'test',context:'public',view:'portfolio',product:'fcn',path:[100,100,100,100,100,100,100],history:[]});
 assert.throws(()=>normalizeAnalysisPlan({...submittedPlan({kind:'rebalance',plan}),inputKind:'rebalance'},input));
});

test('clarification emits an approved form and does not fetch prices or run optimization',async()=>{
 const {runPlannedAssistant}=await import('../src/lib/fed-engine.ts');
 const {withGeminiModel}=await import('../src/lib/gemini-model-server.ts');
 const oldFetch=globalThis.fetch,oldKey=process.env.DEEPSEEK_API_KEY;let calls=0;
 process.env.DEEPSEEK_API_KEY='fixture-key-never-sent';
 globalThis.fetch=async(url)=>{assert.equal(String(url),'https://api.deepseek.com/chat/completions');calls++;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({workflow:'clarify',tools:[],inputKind:'rebalance',goal:'Clarify allocation',analysisQuestions:['Which constraints?']})}}]});};
 try{
  const input=assistantInputSchema.parse({requestId:'00000000-0000-4000-8000-000000000002',revision:0,message:'幫我 rebalance',context:'public',view:'portfolio',product:'fcn',path:[100,100,100,100,100,100,100],history:[],language:'zh-Hant'});
  const events:import('../src/lib/assistant-contract.ts').AssistantEvent[]=[];
  await withGeminiModel('deepseek-flash',()=>runPlannedAssistant(input,new AbortController().signal,e=>events.push(e)));
  assert.equal(calls,1);assert.equal(events.find(e=>e.type==='input_request')?.inputRequest?.kind,'rebalance');assert.equal(events.some(e=>e.type==='research_analysis'),false);assert.equal(events.at(-1)?.type,'done');
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=oldKey;}
});

test('a single-stock history can prefill a form without pretending it is a feasible allocation',()=>{const p=defaultReferencePlan({...plan,task:'history',symbols:['AAPL']});assert.equal(inputRequestSchema.safeParse({version:'1',kind:'rebalance',question:'rebalance',plan:p}).success,true);assert.equal(interactionSchema.safeParse({kind:'rebalance',plan:p}).success,false);});
