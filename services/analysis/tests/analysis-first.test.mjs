import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudResearch} from '../cloud/research.mjs';
import {capability} from '../portfolio-bridge.mjs';
const call=(name,args)=>({id:crypto.randomUUID(),type:'function',function:{name,arguments:JSON.stringify(args)}});
const plan=(extra={})=>call('select_research_depth',{depth:'quick',reason:'Question scope',followups:[],...extra});
function provider(steps){let i=0;return async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.model,'deepseek-flash');assert.ok(i<steps.length,'Unexpected request');const s=steps[i++],value=typeof s==='function'?s(body):s;return Response.json({choices:[{finish_reason:Array.isArray(value)?'tool_calls':'stop',message:Array.isArray(value)?{role:'assistant',content:null,tool_calls:value}:{role:'assistant',content:value}}]});};}
const args={owner:'test',portfolioScope:capability('test'),question:'持倉概覽',language:'zh-Hant'};
test('analysis finishes before selection; portfolio chart binds actual result, no Laya or research-time render_ui',async()=>{
 const research=createCloudResearch({key:'test',providerFetch:provider([
 b=>{assert.ok(!b.tools.some(t=>t.function.name==='render_ui'));return [plan(),call('get_portfolio',{})];},
 '以下為示範持倉快照，基金穿透風險未量化。[S1]',
 b=>{assert.equal(b.tools.length,1);assert.equal(b.tools[0].function.name,'select_presentation');return [call('select_presentation',{component_ids:['V1'],followups:[]})];}
 ])});
 const r=await research(args);assert.equal(r.status,'completed');assert.equal(r.mode,'analysis-first');assert.equal(r.timings.laya_ms,0);assert.equal(r.components.find(c=>c.type==='financial_result').result_id,'R1');assert.equal(r.results[0].data.source,'public-demo');
});
test('missing target stops with a question and no selector/optional CTA',async()=>{
 let count=0;const fetch=provider([[plan({task_patch:{operation:'clarify',missing:['target allocation']}})],'你希望將現金比例調整至多少？']);
 const research=createCloudResearch({key:'test',providerFetch:(...args)=>{count++;return fetch(...args);}});
 const r=await research({...args,question:'幫我 rebalancing'});assert.equal(count,2);assert.equal(r.status,'completed');assert.equal(r.components.length,0);assert.equal(r.followups.length,0);
});
test('unsupported candidate cannot fabricate UI and preserves analysed answer',async()=>{
 const r=await createCloudResearch({key:'test',providerFetch:provider([[plan()],'分散配置並不能消除風險。',[call('select_presentation',{component_ids:['V999'],followups:[]})]])})({...args,question:'解釋分散配置'});
 assert.equal(r.status,'partial');assert.match(r.answer,/分散/);assert.equal(r.components.length,0);
});
test('invalid state blocks evidence calls in the same model response',async()=>{
 let evidence=0;const r=await createCloudResearch({key:'test',publicToolExecutor:()=>{evidence++;},providerFetch:provider([[plan({task_patch:{updates:[{key:'cash_target',value:'50',quote:'50%'}]}}),call('get_analysis_guide',{name:'market'})],'請提供目標比例。',[call('select_presentation',{component_ids:[],followups:[]})]])})({...args,question:'rebalance'});
 assert.equal(evidence,0);assert.equal(r.trace[0].status,'failed');
});
test('a failed task plan can be corrected on a later round before calculation',async()=>{
 const r=await createCloudResearch({key:'test',providerFetch:provider([
  [plan({task_patch:{updates:[{key:'cash_target',value:'10',quote:'not in user message'}]}})],
  [plan({task_patch:{updates:[{key:'cash_target',value:'10',quote:'現金 10%'}]}}),call('get_portfolio',{})],
  '以下為示範持倉快照。[S1]',
  [call('select_presentation',{component_ids:['V1'],followups:[]})]
 ])})({...args,question:'現金 10%'});
 assert.equal(r.status,'completed');assert.equal(r.task_state.conditions.cash_target.value,'10');assert.equal(r.trace.find(t=>t.name==='get_portfolio').status,'completed');
});
test('derived held calculation retains public-demo provenance, never localhost Supabase label',async()=>{
 const r=await createCloudResearch({key:'test',providerFetch:provider([
 [plan({task_patch:{operation:'calculate',updates:[{key:'cash_target',value:'10',quote:'現金 10%'}]}}),call('get_portfolio',{})],
 [call('rebalance_portfolio',{result_id:'R1',targets:[{category:'cash',weight_pct:10}],unspecified:'keep_relative'})],
 '以下為示範配置差額，並非交易指示。[R2]',
 [call('select_presentation',{component_ids:['V1'],followups:[]})]
 ])})({...args,question:'現金 10%，其他按比例'});
 const calculated=r.results.find(x=>x.kind==='portfolio_rebalance'),source=r.sources.find(s=>s.id===calculated.source_id);
 assert.equal(calculated.data.source,'public-demo');assert.ok(source.url.startsWith('https://mercury-wealth-mu.vercel.app/'));assert.ok(!source.title.includes('Supabase'));
});
