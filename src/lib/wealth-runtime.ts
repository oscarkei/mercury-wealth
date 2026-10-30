import {uiCatalog} from './interactive-ui.ts';
import {AsyncLocalStorage} from 'node:async_hooks';
import {skillContent,sharedPolicy,skillCatalog} from './wealth-skill-content.ts';
import type {AssistantInput} from './assistant-contract.ts';
import type {ConversationState,AnalysisCheckpoint} from './conversation-store.ts';
import type {FedPlan} from './fed-contract.ts';
import type {AssistantEvent} from './assistant-contract.ts';
import type {FamilySnapshot} from './family-contract.ts';

export type WealthRuntime={input:AssistantInput;state:ConversationState;client?:FamilySnapshot;clientError?:string;uiComponents?:string[];skills:string[];depth:'medium'|'high';onPlan?:(plan:unknown)=>void;saveCheckpoint?:(plan:FedPlan,model:string)=>void;resume?:{checkpoint:AnalysisCheckpoint;events:AssistantEvent[]};};
const runtime=new AsyncLocalStorage<WealthRuntime>();
export function withWealthRuntime<T>(context:WealthRuntime,run:()=>T){return runtime.run(context,run);}
export function currentWealthRuntime(){return runtime.getStore();}
export function applyWealthPlan(plan:{skills?:string[];analysisDepth?:'medium'|'high';workflow:string;uiComponents?:string[]}){
 const context=runtime.getStore();if(!context)return;
 const defaults=plan.workflow==='finance'||plan.workflow==='stocks'||plan.workflow==='fed'?['mercury-market-research']:['mercury-client-portfolio'];
 context.skills=[...new Set([...(plan.skills?.length?plan.skills:defaults),'mercury-response-ui','mercury-interactive-wealth-ui'])].filter(s=>s in skillContent);
 context.uiComponents=plan.uiComponents;
 context.depth=plan.analysisDepth||'medium';
 if(plan.workflow==='portfolio'){context.onPlan?.(plan);}
}
export function wealthInstructions(){
 const context=runtime.getStore();if(!context)return '';
 return '\n\nResponse language: '+(context.input.language||'en')+'. An explicit request for another language overrides this preference for that turn only. This preference overrides English-only response instructions. Use one key finding and one to three explanatory sentences unless more detail is requested. Completed answers need no follow-up.\nApproved UI catalog: '+JSON.stringify(uiCatalog)+'\n\n'+sharedPolicy+'\n\nAvailable Mercury skills (load by semantic task):\n'+JSON.stringify(skillCatalog)+'\n\n'+context.skills.map(s=>skillContent[s as keyof typeof skillContent]).join('\n\n');
}
export function wealthContext(){
 const context=runtime.getStore();if(!context)return undefined;
 const client=context.client,total=client?.total||0;
 return {language:context.input.language||'en',libraryVersion:'0.4.0',demoData:true,selectedScope:context.input.portfolioScope,client:client?{household:client.household,asOf:client.asOf,snapshot:client.version,totalUSD:total,holdingCount:client.holdings.length,
  holdings:client.holdings.map((h,index)=>({metricPrefix:'holding'+index,id:h.id,instrumentId:h.instrumentId,symbol:h.symbol,name:h.name,category:h.category,valueUSD:h.value,weightPct:total?h.value/total*100:0,currency:h.currency,book:h.book,valuedAt:h.valuedAt})),warnings:client.warnings}:null,
  capabilities:{actualHistoricalPortfolioReturns:false,valuationCoverage:"single imported snapshot",transactionCoverage:"some dividends, coupons, fees and trades; incomplete reconciled external flows",fundLookThrough:false},clientDataIssue:context.clientError||null,resumingExplanation:!!context.resume,topics:(context.resume?[]:context.state.topics).map(t=>({kind:t.kind,question:t.question,updatedAt:t.updatedAt,...(t.kind==='research_analysis'?{plan:(t.result as {plan:unknown}).plan}:{})})),
  recentConversation:context.input.history,declinedInputs:context.state.declinedInputs||[],selectedHeldProductId:context.state.selectedInstrumentId,selectedProduct:context.resume?context.input.product:context.state.product||context.input.product,selectedPath:context.resume?context.input.path:context.state.path||context.input.path};
}
