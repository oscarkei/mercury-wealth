import {currentAIProvider} from './gemini-model-server.ts';
import {AI_TIMEOUTS} from './ai-timeouts.ts';
import {calculatePortfolioExposure} from './portfolio-impact.ts';
import {loadWealthClient} from './wealth-client.ts';
import {currentWealthRuntime} from './wealth-runtime.ts';
import {explainWealth} from './wealth-explanation.ts';
import {analysisStage} from './analysis-stage.ts';
import type {AssistantInput,AssistantEvent} from './assistant-contract.ts';
import type {ResearchMemory} from './research-memory.ts';
import type {FedPlan} from './fed-contract.ts';
export async function runPortfolioImpact(input:AssistantInput,memory:ResearchMemory|undefined,signal:AbortSignal,send:(e:Omit<AssistantEvent,'requestId'|'revision'>)=>void,plan?:FedPlan){
 if(!input.portfolioScope)throw Error('Select a client portfolio before requesting impact.');
 const symbols=plan?.selectedSymbols||input.researchContext?.symbols||memory?.analysis.plan.symbols||[];
 const client=currentWealthRuntime()?.client||await loadWealthClient(input.portfolioScope,signal);
 const impact=calculatePortfolioExposure(client,symbols,input.portfolioScope);
 impact.composer={provider:'Local',model:'Mercury presentation policy',module:/detail|position|holding|明細|持倉/i.test(input.message)?'holding_details':'exposure_summary'};
 send({type:'portfolio_impact',portfolioImpact:impact});
 const bindings:Record<string,string>={'portfolio.total':impact.total.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}),'exposure.weight':impact.directWeightPct.toFixed(2)+'%','exposure.value':impact.directValue.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}),'portfolio.asOf':impact.asOf,'portfolio.count':String(impact.holdingCount)};
 for(const row of impact.rows){bindings[row.symbol+'.weight']=row.weightPct.toFixed(2)+'%';bindings[row.symbol+'.value']=row.value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});}
 const result=await analysisStage({stage:'explanation',service:currentAIProvider(),timeout_ms:AI_TIMEOUTS.explanation},signal,send,s=>explainWealth('Explain the relationship between this public research and the selected client portfolio. Direct holdings are measured, indirect fund/structured-product exposure is not calculated. Explain the economic relevance using the prior sourced research where available; do not multiply past stock returns by a current snapshot to invent historical account P&L. With no requested tickers, explain the overall holdings context and suggest a specific available analysis.',{question:input.message,impact,previousPublicResearch:memory?.reply||null},bindings,s,delay=>send({type:'progress',text:`The explanation service requested a retry. Waiting ${Math.ceil(delay/1000)}s; your portfolio snapshot is retained.`})));
 send({type:'reply',provider:currentAIProvider(),model:result.model,text:result.text,elapsed_ms:result.elapsed_ms});
}
