import {evidenceBindings,bindEvidenceText,bindWithOneRepair} from '../src/lib/evidence-text.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryKey,readResearchMemory,saveResearchMemory,clearResearchMemory,publicResearchPlan,publicEvidence} from '../src/lib/research-memory.ts';
import {comparisonRows,richResponseSchema,buildRichResponse} from '../src/lib/rich-response.ts';
import {canReuseResearch,researchToolLoop} from '../src/lib/research-loop.ts';
import type {ResearchAnalysis,ResearchData} from '../src/lib/research-contract.ts';
const analysis:ResearchAnalysis={plan:{task:'history',symbols:['NVDA','META','AMD'],includeVolume:false,startDate:'2026-01-01',endDate:'2026-10-01',objective:'min_variance',cashPct:10,maxAssetPct:60,capital:1000000,costBps:10},data:{kind:'market_history',engine:'mercury-research-1.0.0',requested:{},histories:['NVDA','META','AMD'].map((symbol,i)=>({symbol,provider:'OpenBB / Cboe',currency:'USD',basis:'provider_close_adjustment_unverified',retrieved_at:'2026-10-01T00:00:00Z',points:[{date:'2026-01-02',close:100,open:null,high:null,low:null,volume:null},{date:'2026-10-01',close:110+i*10,open:null,high:null,low:null,volume:null}],first_date:'2026-01-02',last_date:'2026-10-01',observations:2,price_change_pct:10+i*10,snapshot_id:'a'.repeat(64),status:'observed',cache_hit:true,stale:false})),warnings:[],storage:'local_sqlite',retrieved_at:'2026-10-01T00:00:00Z',trace:[]},modules:['history_comparison'],composer:{provider:'Laya',model:'test',elapsed_ms:1,suggested:'history_comparison'},plannerModel:'test'};
test('research memory is isolated by session/conversation, expires, and reset removes it',()=>{
 const key=memoryKey('session-a','thread-a')!;saveResearchMemory(key,analysis,'Public evidence',100);
 assert.equal(readResearchMemory(key,101)?.reply,'Public evidence');assert.equal(readResearchMemory(memoryKey('session-b','thread-a'),101),undefined);assert.equal(readResearchMemory(memoryKey('session-a','thread-b'),101),undefined);
 assert.equal(readResearchMemory(key,7200101),undefined);saveResearchMemory(key,analysis);clearResearchMemory(key);assert.equal(readResearchMemory(key),undefined);
});
test('why reuses identical evidence but adding a symbol or changing dates cannot reuse it',()=>{
 const memory={analysis,reply:'',savedAt:Date.now()};assert.ok(canReuseResearch({...analysis.plan},memory));
 assert.equal(canReuseResearch({...analysis.plan,symbols:[...analysis.plan.symbols,'MSFT']},memory),false);assert.equal(canReuseResearch({...analysis.plan,startDate:'2026-04-01'},memory),false);
});
test('common-date returns match chart math even when individual histories have different first dates',()=>{
 const copy=structuredClone(analysis);copy.data.histories[0].points.unshift({date:'2026-01-01',close:50,open:null,high:null,low:null,volume:null});
 const rows=comparisonRows(copy);assert.ok(Math.abs(rows[0].priceChangePct-10)<1e-10);assert.equal(rows[0].firstDate,'2026-01-02');assert.equal(rows[0].observations,2);
});
test('rich schema rejects invented components, arbitrary data refs and raw HTML properties',()=>{
 const response=buildRichResponse(analysis,true,[{heading:'Why',text:'Supported explanation'}]);assert.equal(response.blocks[0].type,'comparison_table');
 for(const block of [{type:'execute_js',code:'evil()'},{type:'research_panel',dataRef:'private-holdings'},{type:'narrative',heading:'x',text:'x',html:'<script>'}])assert.equal(richResponseSchema.safeParse({version:'1',blocks:[block]}).success,false);
});
test('tool loop observes history then finishes; history cannot escalate into an unsolicited allocation',async()=>{
 let calls=0;const signal=new AbortController().signal;const execute=async()=>{calls++;return analysis.data;};
 const result=await researchToolLoop(analysis.plan,signal,execute,()=>{},async()=>({action:'finish',reason:'Sufficient history'}));assert.deepEqual(result.trace,['market_history']);assert.equal(calls,1);
 await assert.rejects(()=>researchToolLoop(analysis.plan,signal,execute,()=>{},async()=>({action:'optimize_allocation',reason:'Unsolicited'})),/unsupported/);
});
test('requested allocation loops from history to calculation and stops after observing result',async()=>{
 const plan={...analysis.plan,task:'optimize' as const};const calls:string[]=[];
 const result=await researchToolLoop(plan,new AbortController().signal,async p=>{calls.push(p.task);return p.task==='history'?analysis.data:{...analysis.data,optimization:{} as NonNullable<ResearchData['optimization']>};},()=>{},async data=>data.optimization?{action:'finish',reason:'Calculated'}:{action:'optimize_allocation',reason:'Need allocation'});
 assert.deepEqual(calls,['history','optimize']);assert.deepEqual(result.trace,['market_history','optimize_allocation']);
});
test('tool loop blocks stale optimization and repeated calls',async()=>{
 const plan={...analysis.plan,task:'optimize' as const};const stale=structuredClone(analysis.data);stale.histories[0].stale=true;
 await assert.rejects(()=>researchToolLoop(plan,new AbortController().signal,async()=>stale,()=>{},async()=>({action:'optimize_allocation',reason:'Calculate'})),/non-stale/);
 const data={...analysis.data,optimization:{} as NonNullable<ResearchData['optimization']>};
 await assert.rejects(()=>researchToolLoop(plan,new AbortController().signal,async()=>data,()=>{},async()=>({action:'optimize_allocation',reason:'Repeat'})),/repeated/);
});

test('narrative numeric/date claims bind to authoritative values; unsupported figures are rejected',()=>{
 const bindings=evidenceBindings(analysis);
 assert.equal(bindEvidenceText('From {{window.start}} to {{window.end}}, NVDA changed {{NVDA.change}}.',bindings),'From 2026-01-02 to 2026-10-01, NVDA changed 10.00%.');
 assert.throws(()=>bindEvidenceText('End date 2025-10-01',bindings),/Unbound/);
 assert.throws(()=>bindEvidenceText('Return {{NVDA.madeUp}}',bindings),/Unknown/);
});

test('one schema repair fixes an unbound numerical claim but repeated invalid output fails closed',async()=>{
 let repairs=0;const parse=(v:unknown)=>bindEvidenceText(String(v),{rate:'10.00%'});
 assert.equal(await bindWithOneRepair('Return 10%',parse,async()=>{repairs++;return 'Return {{rate}}';}),'Return 10.00%');assert.equal(repairs,1);
 repairs=0;await assert.rejects(()=>bindWithOneRepair('Return 10%',parse,async()=>{repairs++;return 'Return 999%';}),/Unbound/);assert.equal(repairs,1);
});

test('price evidence excludes unused allocation defaults but optimization retains its constraints',()=>{
 const snapshot=publicEvidence(analysis);
 assert.deepEqual(Object.keys(snapshot.plan).sort(),['endDate','includeVolume','startDate','symbols','task']);
 const optimization={...analysis.plan,task:'optimize' as const};
 assert.deepEqual(publicResearchPlan(optimization),optimization);
 assert.equal(analysis.plan.objective,'min_variance');
});
test('single-asset evidence has price metrics without a fabricated ranking against itself',()=>{
 const single=structuredClone(analysis);single.plan.symbols=['NVDA'];single.data.histories=single.data.histories.slice(0,1);
 const bindings=evidenceBindings(single);
 assert.equal(bindings.leader,undefined);assert.equal(bindings['NVDA.gapToLeader'],undefined);
 assert.equal(bindings['NVDA.change'],'10.00%');
 assert.equal(evidenceBindings(analysis).leader,'AMD');
});

test('documented metric namespace resolves only verified evidence keys',()=>{
 const bindings={'XLE.change':'49.95%','XLE.startClose':'$45.65'};
 assert.equal(bindEvidenceText('From {{metric.XLE.startClose}}; {{metric.XLE.change}}.',bindings),'From $45.65; 49.95%.');
 assert.throws(()=>bindEvidenceText('{{metric.XLE.invented}}',bindings),/Unknown evidence reference/);
 assert.throws(()=>bindEvidenceText('50%',bindings),/Unbound numerical claim/);
});
