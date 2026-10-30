import type {ResearchAnalysis} from './research-contract.ts';
export type ResultVersion={id:string;scopeKey:string;analysis:ResearchAnalysis};
export function compareResults(a:ResultVersion,b:ResultVersion,scopeKey:string,now=Date.now()){
 if(a.id===b.id)return {issue:'Choose two different result versions.'} as const;
 if(a.scopeKey!==scopeKey||b.scopeKey!==scopeKey)return {issue:'These results belong to a different portfolio scope.'} as const;
 const x=a.analysis.data.optimization,y=b.analysis.data.optimization;
 if(!x||!y)return {issue:'Both versions need completed model allocations.'} as const;
 if(!Number.isFinite(Date.parse(a.analysis.data.retrieved_at))||!Number.isFinite(Date.parse(b.analysis.data.retrieved_at))||[a,b].some(v=>v.analysis.data.histories.some(h=>h.stale||h.status!=='observed')||Date.parse(v.analysis.data.retrieved_at)>now+60000||now-Date.parse(v.analysis.data.retrieved_at)>=7200000))return {issue:'A result is stale or incomplete. Refresh before comparing.'} as const;
 if(x.capital!==y.capital||x.first_date!==y.first_date||x.last_date!==y.last_date||[...a.analysis.plan.symbols].sort().join()!==[...b.analysis.plan.symbols].sort().join())return {issue:'Use the same capital, assets and observation period to compare versions.'} as const;
 const validRows=(v:ResultVersion)=>{const opt=v.analysis.data.optimization!;const symbols=v.analysis.plan.symbols;return opt.rows.length===symbols.length&&new Set(opt.rows.map(r=>r.symbol)).size===symbols.length&&opt.rows.every(r=>symbols.includes(r.symbol)&&Number.isFinite(r.target_pct))&&Math.abs(opt.rows.reduce((n,r)=>n+r.target_pct,0)+opt.cash_pct-100)<.05;};
 if(!validRows(a)||!validRows(b))return {issue:'Allocation evidence is incomplete or does not reconcile.'} as const;
 if(x.method!==y.method||a.analysis.plan.costBps!==b.analysis.plan.costBps)return {issue:'Use matching return methods and cost assumptions.'} as const;
 return {rows:x.rows.map(r=>({symbol:r.symbol,a:r.target_pct,b:y.rows.find(s=>s.symbol===r.symbol)!.target_pct})),cash:{a:x.cash_pct,b:y.cash_pct},risk:{a:x.target_volatility_pct,b:y.target_volatility_pct},cost:{a:x.estimated_cost,b:y.estimated_cost}};
}
