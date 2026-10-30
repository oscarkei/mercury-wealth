import {activeResults} from './conversation-policy.mjs';
import {schemas,validateComponents} from './catalog.mjs';
const sourceIds=(text,run)=>[...new Set([...text.matchAll(/\[([SR]\d+)\]/g)].map(m=>m[1].startsWith('R')?run.results.find(r=>r.id===m[1])?.source_id:m[1]).filter(id=>run.sources.some(s=>s.id===id)))].slice(0,8);
export function preparePresentation(run){
 const sections=[];let current={title:'研究摘要',lines:[]};
 for(const line of run.answer.split('\n')){const h=line.match(/^#{1,4}\s+(.+)/);if(h){if(current.lines.some(l=>l.trim()))sections.push(current);current={title:h[1].replace(/\*\*/g,''),lines:[]};}else current.lines.push(line);}if(current.lines.some(l=>l.trim()))sections.push(current);
 const tables=[],transmissions=[];
 for(const s of sections){let block=[];const flush=()=>{if(block.length>=3&&/^\s*\|?\s*:?-{3}/.test(block[1])){const split=l=>l.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());const headers=split(block[0]),rows=block.slice(2).map(split).filter(r=>r.length===headers.length);if(rows.length>=2)tables.push({type:'research_table',title:s.title,headers,rows,source_ids:sourceIds(block.join('\n'),run)});}block=[];};
  for(const l of s.lines){if(l.trim().startsWith('|'))block.push(l);else flush();}flush();
  if(/傳導|傳遞|機制|transmission|mechanism/i.test(s.title)){const items=s.lines.filter(l=>/^\s*(?:[-*]|\d+[.)、])\s+/.test(l)).map(l=>l.replace(/^\s*(?:[-*]|\d+[.)、])\s+/,''));if(items.length>=2)transmissions.push({type:'research_drivers',title:s.title,items:items.slice(0,5),source_ids:sourceIds(items.join('\n'),run)});}
 }
 const viewResults=activeResults(run);
 let charts=viewResults.filter(r=>r.points?.length>=2).map(r=>({type:'chart',title:r.title,result_id:r.id}));
 const prices=viewResults.filter(r=>r.kind==='observed_price'&&r.points?.length>=2).slice(0,6);
 if(prices.length>=2){const ids=new Set(prices.map(r=>r.id));charts=[{type:'price_comparison',title:'股價表現比較',result_ids:[...ids]},...charts.filter(c=>!ids.has(c.result_id))];}
 const summaries=sections.filter(s=>s.lines.some(l=>l.trim()&&!l.trim().startsWith('|'))).map(s=>({type:'research_section',title:s.title,text:s.lines.filter(l=>!l.trim().startsWith('|')).join('\n').trim(),source_ids:sourceIds(s.lines.join('\n'),run)})).filter(s=>s.text);
 const state={question:run.question,available:{charts:charts.length,comparison:tables.length,transmission:transmissions.length},research:summaries.slice(0,6).map(s=>({title:s.title,summary:s.text.slice(0,160)})),series:viewResults.map(r=>({id:r.id,title:r.title,unit:r.unit,observations:r.observations,first:r.first?.date,last:r.last?.date})),tables:tables.map(t=>({title:t.title,columns:t.headers,rows:t.rows.length})),instructions:'只選擇有現成內容及數據支持的畫面，不新增研究、數字或必填追問。'};
 const fundamentals=viewResults.filter(r=>r.kind==='sec_facts'&&r.data?.rows?.length).slice(0,8);
 const hasScenario=viewResults.some(r=>['portfolio_scenario','portfolio_rebalance'].includes(r.kind));
 const financial=viewResults.filter(r=>['adviser_variation','adviser_proposals','allocation','performance','backtest','official_table','outlook','portfolio_snapshot','portfolio_scenario','portfolio_rebalance'].includes(r.kind)&&!(hasScenario&&r.kind==='portfolio_snapshot')&&!(r.kind==='adviser_proposals'&&viewResults.some(x=>x.kind==='adviser_variation'))).sort((a,b)=>({adviser_variation:-2,adviser_proposals:-1,portfolio_scenario:0,portfolio_rebalance:0,portfolio_snapshot:1,allocation:2,backtest:2,performance:3}[a.kind]??4)-({adviser_variation:-2,adviser_proposals:-1,portfolio_scenario:0,portfolio_rebalance:0,portfolio_snapshot:1,allocation:2,backtest:2,performance:3}[b.kind]??4)).map(r=>({type:'financial_result',title:r.title,result_id:r.id}));
 if(fundamentals.length)financial.push({type:'key_items',title:'基本面重點',result_ids:fundamentals.map(r=>r.id)});
 const uniqueTables=tables.filter(t=>!financial.some(f=>t.rows.flat().join(' ').includes('['+f.result_id+']')));
 state.available.comparison=uniqueTables.length+financial.length;state.tables.push(...financial.map(f=>({title:f.title,result_id:f.result_id})));
 state.depth=run.research_depth?.depth||'deep';state.instructions+=' 快速回答優先最相關圖表及精簡重點；保留必要證據，次要內容可展開，不按卡片數刪除；基本面採一張關鍵指標列表，不逐項建立卡片。';
 return {sections:summaries,charts,tables:uniqueTables,transmissions,financial,state};
}
export function assemblePresentation(prepared,decision,run){
 const v=decision.values,components=[];const accepted={charts:!!v.charts&&prepared.charts.length>0,comparison:!!v.comparison&&(prepared.tables.length>0||prepared.financial?.length>0),transmission:!!v.transmission&&prepared.transmissions.length>0};
 if(prepared.sections[0])components.push(prepared.sections[0]);
 const quick=run.research_depth?.depth==='quick';
 if(accepted.charts)components.push(...prepared.charts);
 if(accepted.comparison)components.push(...(prepared.financial||[]));
 if(accepted.transmission)components.push(...prepared.transmissions);
 if(accepted.comparison)components.push(...prepared.tables);
 for(const s of prepared.sections.slice(1)){if(accepted.transmission&&prepared.transmissions.some(t=>t.title===s.title))continue;components.push(s);}
 const hasPrivate=prepared.financial?.some(c=>run.results.find(r=>r.id===c.result_id)?.kind.startsWith('portfolio_'));
 if(hasPrivate){const visuals=components.splice(1);components.push(...visuals.filter(c=>c.type==='financial_result'),...visuals.filter(c=>c.type!=='financial_result'));}
 const result=components.slice(0,14);schemas.render_ui.parse({components:result});validateComponents(result,run);
 return {components:result,accepted,blocked:Object.keys(accepted).filter(k=>v[k]&&!accepted[k])};
}
