export function activeResults(run){
 const selected=new Set(run.context_selection?.reuse_result_ids||[]);
 const candidates=run.results.filter((r,i)=>i>=(run.result_start_index||0)||selected.has(r.id));
 return candidates.filter(r=>r.kind!=='portfolio_snapshot'||!candidates.some(other=>other!==r&&other.kind==='portfolio_snapshot'&&other.scope_key===r.scope_key&&other.data?.query===''&&run.results.indexOf(other)>run.results.indexOf(r))); 
}
export function selectContext(run,args){
 const sourceIds=args.relation==='follow_up'?[...new Set(args.reuse_source_ids||[])]:[];
 const ids=args.relation==='follow_up'?[...new Set(args.reuse_result_ids||[])]:[];
 if(args.relation!=='follow_up'&&(args.reuse_result_ids?.length||args.reuse_source_ids?.length))throw Error('A new topic cannot reuse prior results.');
 for(const id of ids){const r=run.results.find(r=>r.id===id);if(!r)throw Error('Unknown retained result.');if(r.scope_key&&r.scope_key!==run.portfolio_scope?.key)throw Error('Retained portfolio result belongs to another scope. Refresh this scope.');}
 for(const id of sourceIds){const source=run.sources.find(s=>s.id===id);if(!source||source.access==='private_demo')throw Error('Retain portfolio evidence through its scoped result ID, not a bare source ID.');}
 run.context_selection={relation:args.relation||'new_topic',reuse_result_ids:ids,reuse_source_ids:sourceIds};
 const results=run.results.filter(r=>ids.includes(r.id)),sources=run.sources.filter(s=>results.some(r=>r.source_id===s.id)||sourceIds.includes(s.id));
 return {results,numeric_facts:run.facts.filter(f=>ids.includes(f.result_id)||(!f.result_id&&sourceIds.includes(f.source_id))),sources};
}
export function contextIssues(answer,run){
 const active=new Set(activeResults(run).map(r=>r.id));const cited=[...answer.matchAll(/\[(R\d+)\]/g)].map(m=>m[1]);
 for(const m of answer.matchAll(/\{\{(F\d+)\}\}/g)){const f=run.facts.find(f=>f.id===m[1]);if(f?.result_id)cited.push(f.result_id);}
 const tokenSources=[...answer.matchAll(/\{\{(F\d+)\}\}/g)].map(m=>run.facts.find(f=>f.id===m[1])).filter(f=>f&&!f.result_id).map(f=>f.source_id);
 const staleSources=[...tokenSources,...[...answer.matchAll(/\[(S\d+)\]/g)].map(m=>m[1])].filter(id=>!activeSources(run).some(s=>s.id===id));
 const sourceIssues=[...new Set(staleSources)].map(id=>({code:'unselected_previous_source',message:`${id} is not selected for this topic; remove that citation/claim.`}));
 const scoped=activeResults(run);if(scoped.some(r=>r.kind==='portfolio_snapshot')&&!scoped.some(r=>r.kind==='portfolio_scenario')&&/影響.{0,15}(?:為|是|為\*\*|为).{0,5}(?:零|0)|市值變動.{0,8}(?:零|0)|不承受.{0,20}(?:beta|敏感度)|(?:impact|sensitivity).{0,20}(?:is zero|of zero|=\s*0)/i.test(answer))sourceIssues.push({code:'uncomputed_zero_portfolio_impact',message:'No scenario calculation establishes zero portfolio impact. No identified direct energy holding is not zero portfolio sensitivity. State the matched holdings/coverage and explicitly leave indirect and macro sensitivity unquantified; remove numerical impact claims.'});
 return [...sourceIssues,...[...new Set(cited)].filter(id=>run.results.some(r=>r.id===id)&&!active.has(id)).map(id=>({code:'unselected_previous_result',message:`${id} is previous-turn data not selected for this topic. Omit that claim and chart. Use only current-turn or explicitly reused results.`}))];
}
export function checkedFollowups(items,run){
 const allowed=new Set(activeResults(run).map(r=>r.id));
 for(const item of items){if(item.result_ids.some(id=>!allowed.has(id)))throw Error('Follow-up references unavailable or unrelated results.');}
 return items.map(item=>({...item,result_ids:[...new Set(item.result_ids)]}));
}

export function activeSources(run){const rs=activeResults(run),ids=new Set(run.context_selection?.reuse_source_ids||[]);return run.sources.filter((s,i)=>i>=(run.source_start_index||0)||s.active_turn===run.id||ids.has(s.id)||rs.some(r=>r.source_id===s.id));}
