import type {ResearchAnalysis,ResearchPlan} from './research-contract.ts';
// Only validated public tool output and its generated explanation enter this store.
// Never store user history, account facts or portfolio scope for model replay.
export type ResearchMemory={analysis:ResearchAnalysis;reply:string;savedAt:number};
const entries=new Map<string,ResearchMemory>();
const TTL=2*60*60*1000,MAX=100;
export function memoryKey(session:string,conversationId?:string){return conversationId?session+'|'+conversationId:undefined;}
export function readResearchMemory(key?:string,now=Date.now()){
 if(!key)return undefined;const value=entries.get(key);
 if(value&&now-value.savedAt<TTL)return value;
 entries.delete(key);return undefined;
}
export function saveResearchMemory(key:string|undefined,analysis:ResearchAnalysis,reply='',now=Date.now()){
 if(!key)return;
 for(const [k,v] of entries)if(now-v.savedAt>=TTL)entries.delete(k);
 entries.delete(key);entries.set(key,{analysis,reply,savedAt:now});
 while(entries.size>MAX)entries.delete(entries.keys().next().value!);
}
export function clearResearchMemory(key?:string){if(key)entries.delete(key);}
// Calculation-only defaults must not read as a requested proposal in price explanations.
export function publicResearchPlan(plan:ResearchPlan){
 if(plan.task==='optimize')return plan;
 const {task,symbols,includeVolume,startDate,endDate}=plan;
 return {task,symbols,includeVolume,startDate,endDate};
}
export function publicEvidence(analysis:ResearchAnalysis){
 return {plan:publicResearchPlan(analysis.plan),sourceWindows:analysis.data.histories.map(h=>({symbol:h.symbol,first:h.first_date,last:h.last_date,observations:h.observations,priceChangePct:h.price_change_pct,source:h.provider,snapshot:h.snapshot_id,stale:h.stale,status:h.status})),optimization:analysis.data.optimization||null,warnings:analysis.data.warnings};
}
