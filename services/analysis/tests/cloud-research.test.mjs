import test from 'node:test';
import assert from 'node:assert/strict';
import {research as engine} from '../engine.mjs';
import {executePortfolio,portfolioSchemas} from '../portfolio-tools.mjs';
import {publicPortfolio} from '../cloud/portfolio.mjs';
const createCloudResearch=({key,providerFetch,publicToolExecutor=executeTool})=>args=>engine({...args,key,providerFetch,mode:'deepseek',selectUI:undefined,toolExecutor:(name,raw,run,options)=>Object.hasOwn(portfolioSchemas,name)?executePortfolio(name,raw,run,{...options,portfolioLoader:async scope=>publicPortfolio(scope)}):publicToolExecutor(name,raw,run,options)});
import {executeTool} from '../research-tools.mjs';
import {capability} from '../portfolio-bridge.mjs';

const call=(name,args)=>({id:crypto.randomUUID(),type:'function',function:{name,arguments:JSON.stringify(args)}});
const plan=(extra={})=>call('select_research_depth',{depth:'quick',reason:'Focused overview',followups:[],...extra});
function provider(steps){
 let index=0;
 return async(url,options)=>{
  const body=JSON.parse(options.body);assert.equal(body.model,'deepseek-flash');
  if(index===0)assert.ok(body.tools.some(t=>t.function.name==='render_ui'));
  assert.ok(!body.messages[0].content.includes('UI selection is handled separately by Laya'));
  assert.ok(index<steps.length,'Unexpected provider round');
  const step=steps[index++],value=typeof step==='function'?step(body):step;
  return Response.json({model:'deepseek-flash',choices:[{finish_reason:Array.isArray(value)?'tool_calls':'stop',message:Array.isArray(value)?{role:'assistant',content:null,tool_calls:value}:{role:'assistant',content:value}}]});
 };
}
const args={key:'test-only',owner:'cloud-test',portfolioScope:capability('cloud-test'),mode:'hybrid',selectUI:()=>{throw Error('Cloud must not call Laya');}};

test('cloud energy flow binds oil and gas charts with DeepSeek-native UI',async()=>{
 const research=createCloudResearch({key:'test-only',providerFetch:provider([
  [plan(),...['DCOILWTICO','DHHNGSP'].map(series_id=>call('get_economic_series',{series_id,start_date:'2026-01-01',end_date:'2026-02-01'}))],
  [call('render_ui',{components:[{type:'chart',title:'Oil',result_id:'R1'},{type:'chart',title:'Gas',result_id:'R2'}]})],
  '原油與天然氣須分開觀察；價格序列本身不能證明供需變動的原因。[S1][S2]'
 ]),publicToolExecutor:(name,raw,run,options)=>executeTool(name,raw,run,{...options,fetcher:async url=>{
  const id=new URL(url).searchParams.get('id');
  return new Response(`observation_date,${id}\n2026-01-02,2\n2026-01-30,3\n`);
 }})});
 const result=await research({...args,question:'美國能源市場而家點睇'});
 assert.equal(result.status,'completed');assert.equal(result.mode,'deepseek');
 assert.deepEqual(result.components.map(c=>c.result_id),['R1','R2']);
 assert.equal(result.timings.laya_ms,0);assert.equal(result.ui_decision,undefined);
 assert.ok(result.trace.every(t=>t.status==='completed'));
});

test('cloud holdings and follow-up retain authorized results and financial cards',async()=>{
 const research=createCloudResearch({key:'test-only',providerFetch:provider([
  [plan(),call('get_portfolio',{})],
  [call('render_ui',{components:[{type:'financial_result',title:'持倉概覽',result_id:'R1'}]})],
  '以下為公開示範持倉快照；基金穿透風險尚未量化。[S1]',
  [plan({relation:'follow_up',reuse_result_ids:['R1']})],
  [call('render_ui',{components:[{type:'financial_result',title:'持倉與資料缺口',result_id:'R1'}]})],
  '持倉快照可辨認直接資產，但不能單憑快照量化能源價格的間接影響。[S1]'
 ])});
 const first=await research({...args,question:'持倉概覽'});
 assert.equal(first.status,'completed');assert.equal(first.results[0].data.source,'public-demo');
 assert.equal(first.results[0].data.holdings.length,23);
 const second=await research({...args,previous:first,question:'能源市場對這些持倉有咩影響'});
 assert.equal(second.status,'completed');assert.equal(second.components[0].result_id,'R1');
 assert.equal(second.results.length,1);assert.equal(second.context_selection.relation,'follow_up');
});

test('cloud adviser proposals retain the existing visual result type',async()=>{
 const research=createCloudResearch({key:'test-only',providerFetch:provider([
  [plan(),call('get_adviser_proposals',{})],
  [call('render_ui',{components:[{type:'financial_result',title:'顧問方案',result_id:'R1'}]})],
  '方案顯示提出時的配置與變動，並不代表目前或成交後的實際持倉。[S1]'
 ])});
 const result=await research({...args,question:'查看顧問方案'});
 assert.equal(result.status,'completed');assert.equal(result.results[0].kind,'adviser_proposals');
 assert.equal(result.results[0].data.records.length,2);
 assert.equal(result.components[0].type,'financial_result');
});

test('UI remains available after all six quick evidence calls without granting extra evidence',async()=>{
 let evidence=0;
 const research=createCloudResearch({key:'test-only',publicToolExecutor:(name,raw,run,options)=>{
  if(name==='get_analysis_guide'){evidence++;return {note:'Test method reference'};}
  return executeTool(name,raw,run,options);
 },providerFetch:provider([
  [plan(),...Array.from({length:6},(_,n)=>call('get_analysis_guide',{name:'test-'+n}))],
  body=>{assert.ok(!body.tools.some(t=>t.function.name==='get_economic_series'));return [call('render_ui',{components:[{type:'insight',title:'概念',text:'分散配置仍涉及風險。',kind:'background',source_ids:[]}]})];},
  '分散配置有助分散單一資產風險，但不代表消除所有風險。'
 ])});
 const result=await research({...args,question:'解釋分散配置'});
 assert.equal(evidence,6);assert.equal(result.status,'completed');assert.equal(result.components.length,1);
 assert.equal(result.trace.at(-1).status,'completed');
});

test('cloud rejects invented UI bindings and permits a valid retry',async()=>{
 const research=createCloudResearch({key:'test-only',providerFetch:provider([
  [plan(),call('get_portfolio',{})],
  [call('render_ui',{components:[{type:'financial_result',title:'Invented',result_id:'R999'}]})],
  [call('render_ui',{components:[{type:'financial_result',title:'持倉',result_id:'R1'}]})],
  '此處顯示示範持倉，並非即時報價。[S1]'
 ])});
 const result=await research({...args,question:'持倉概覽'});
 assert.equal(result.status,'completed');assert.equal(result.components[0].result_id,'R1');
 assert.equal(result.trace.find(t=>t.name==='render_ui').status,'failed');
});

test('DeepSeek failure is reported with no other provider or Laya fallback',async()=>{
 let calls=0;
 const research=createCloudResearch({key:'test-only',providerFetch:async()=>{calls++;return new Response('',{status:503});}});
 const result=await research({...args,question:'概念'});
 assert.equal(calls,1);assert.equal(result.status,'failed');assert.equal(result.error,'DeepSeek HTTP 503');
 assert.equal(result.components.length,0);
});
