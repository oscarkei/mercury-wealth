import {z} from 'zod';
import type {FamilySnapshot} from './family-contract.ts';
export const proposalInputSchema=z.object({kind:z.literal('portfolio_proposal'),goal:z.string().trim().min(3).max(200),cashPct:z.number().finite().min(0).max(50),maxHoldingPct:z.number().finite().min(1).max(100),horizonMonths:z.number().int().min(1).max(120),costBps:z.number().finite().min(0).max(100)}).strict();
export type ProposalInput=z.infer<typeof proposalInputSchema>;
export function buildPortfolioProposal(client:FamilySnapshot,raw:ProposalInput){
 const input=proposalInputSchema.parse(raw);if(client.total<=0)throw Error('EMPTY_PORTFOLIO');
 const holdings=client.holdings.filter(h=>h.category!=='cash'),cash=client.holdings.filter(h=>h.category==='cash').reduce((n,h)=>n+h.value,0),total=client.total,cap=total*input.maxHoldingPct/100,targetCash=total*input.cashPct/100;
 // Structured products stay unchanged: no executable derivative sale price is available.
 const locked=holdings.filter(h=>h.category==='note'),liquid=holdings.filter(h=>h.category!=='note');
 if(locked.some(h=>h.value>cap))throw Error('LOCKED_PRODUCT_EXCEEDS_CAP');
 const lockedValue=locked.reduce((n,h)=>n+h.value,0),investable=total-targetCash-lockedValue;
 if(investable<0||!liquid.length||cap*liquid.length+0.01<investable)throw Error('INFEASIBLE_CONSTRAINTS');
 function allocate(equal:boolean){let weights=liquid.map(h=>equal?0:Math.min(h.value,cap)),remaining=investable-weights.reduce((n,v)=>n+v,0);
  if(remaining<0){const scale=investable/weights.reduce((n,v)=>n+v,0);weights=weights.map(v=>v*scale);remaining=0;}
  for(let iteration=0;remaining>.0001&&iteration<100;iteration++){const indices=weights.flatMap((v,i)=>v<cap-.0001?[i]:[]);if(!indices.length)throw Error('INFEASIBLE_CONSTRAINTS');const share=remaining/indices.length;for(const i of indices){const add=Math.min(share,cap-weights[i]);weights[i]+=add;remaining-=add;}}
  const rows=holdings.map(h=>{const i=liquid.findIndex(l=>l.id===h.id),target=i<0?h.value:weights[i];return {id:h.id,name:h.name,category:h.category,currentValue:h.value,targetValue:target,currentPct:h.value/total*100,targetPct:target/total*100,change:target-h.value,locked:i<0};});
  const grossTurnover=rows.reduce((n,r)=>n+Math.abs(r.change),0),estimatedCost=grossTurnover*input.costBps/10000,postCostTotal=total-estimatedCost;
  if(targetCash+0.01<estimatedCost)throw Error('CASH_INSUFFICIENT_FOR_COST');
  return {rows,cashBefore:cash,cashTargetBeforeCosts:targetCash,cashAfterCosts:targetCash-estimatedCost,estimatedCost,postCostTotal,turnoverPct:grossTurnover/total*100,concentration:{before:holdings.reduce((n,h)=>n+(h.value/total)**2,0),after:rows.reduce((n,r)=>n+(r.targetValue/total)**2,0)},largestHoldingPct:Math.max(...rows.map(r=>r.targetPct)),method:equal?'equalise_eligible_holdings':'retain_capped_holdings'};
 }
 return {kind:'portfolio_proposal' as const,currency:'USD' as const,snapshot:client.version||client.asOf,asOf:client.asOf,total,input,versions:[{label:'A',...allocate(false)},{label:'B',...allocate(true)}],riskMethod:'Concentration index = sum of squared holding weights; not volatility or a forecast.',limitations:['Hypothetical allocation using existing holdings; no trade is sent.','Structured products are held fixed because executable valuations are unavailable.','Trading cost is an assumption; tax, market impact and suitability are not assessed.','No historical covariance or expected-return model has been calculated.'],executionReady:false as const};
}
export type PortfolioProposal=ReturnType<typeof buildPortfolioProposal>;
