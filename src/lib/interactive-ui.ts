import {z} from 'zod';
import {researchPlanSchema,type ResearchPlan} from './research-contract.ts';
export const uiLanguageSchema=z.enum(['en','zh-Hant','zh-Hans']);
export type UILanguage=z.infer<typeof uiLanguageSchema>;
export const inputKindSchema=z.enum(['rebalance','shock_meaning','held_product','portfolio_proposal','fcn_scenario']);
export const interactionSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('held_product'),instrumentId:z.string().min(1).max(120),intent:z.enum(['product','scenario'])}).strict(),
 z.object({kind:z.literal('rebalance'),plan:researchPlanSchema.refine(p=>p.task==='optimize')}).strict(),
]);
export type UIInteraction=z.infer<typeof interactionSchema>;
export const inputRequestSchema=z.object({version:z.literal('1'),kind:inputKindSchema,question:z.string().max(800),plan:researchPlanSchema.optional(),products:z.array(z.object({id:z.string(),label:z.string()})).max(25).optional(),intent:z.enum(['product','scenario']).optional(),shockPct:z.number().min(-100).max(30).optional()}).strict();
export type InputRequest=z.infer<typeof inputRequestSchema>;
export const uiCatalog=[
 {id:'ClarificationForm',version:'1',inputs:['rebalance','shock_meaning'],action:'submit_validated_analysis'},
 {id:'WealthDecision',version:'1',inputs:['portfolio_proposal','fcn_scenario'],evidence:'owned_immutable_result_id_and_scope',action:'calculate_or_save_private_draft'},
 {id:'ResearchAnalysis',version:'1',result:'research_analysis'},
 {id:'ProductScenario',version:'1',result:'wealth_scenario'},
 {id:'ExposureInsight',version:'1',result:'portfolio_impact'},
 {id:'EvidenceDrawer',version:'1',result:'research_analysis'},
 {id:'HomeSummary',version:'1',evidence:'selected_snapshot',action:'local_scope_selection'},
 {id:'PortfolioHoldings',version:'1',evidence:'position_ids',action:'local_holding_review'},
 {id:'HeldProductPicker',version:'1',evidence:'selected_scope_positions',action:'verified_terms_only'},
 {id:'StockAnalysis',version:'1',result:'stock_analysis'},
 {id:'FedAnalysis',version:'1',result:'analysis'},
 {id:'ProposalReview',version:'1',evidence:'completed_scoped_results',action:'local_draft_only'},
 {id:'Documents',version:'1',evidence:'local_drafts_and_saved_research',action:'export_or_open_source'},
 {id:'Notifications',version:'1',evidence:'imported_snapshot_observations',action:'local_review_or_dismiss'},
] as const;
export function defaultReferencePlan(previous?:ResearchPlan):ResearchPlan {
 return previous?{...previous,task:previous.symbols.length>1?'optimize':'history'}:{task:'optimize',symbols:['SPY','BND'],includeVolume:false,startDate:null,endDate:null,objective:'min_variance',cashPct:10,maxAssetPct:60,capital:1000000,costBps:10};
}
export function submittedPlan(value:unknown){
 const submission=interactionSchema.parse(value);
 if(submission.kind==='held_product')return {workflow:'portfolio' as const,tools:['portfolio_context'],portfolioFocus:submission.intent,instrumentId:submission.instrumentId,goal:'Review the explicitly selected held product',focus:'comparison' as const,meetingMonth:'nearest',historyDays:90 as const};
 return {workflow:'finance' as const,tools:['market_history','optimize_allocation'],researchMode:'refresh' as const,researchPlan:submission.plan,goal:'Compare the submitted reference allocation',analysisQuestions:['Compare the submitted reference allocation'],focus:'comparison' as const,meetingMonth:'nearest',historyDays:90 as const};
}

// Only unambiguous, single-field edits bypass planning. All other messages use the model.
export function patchReferenceFollowup(message:string,previous?:ResearchPlan):ResearchPlan|undefined {
 if(!previous||previous.task!=='optimize')return;
 const cash=message.trim().match(/^(?:cash(?: reserve)?|現金|现金)(?:\s*(?:to|改(?:為|成)?|改为|设为|設定為|=))?\s*(\d+(?:\.\d+)?)\s*[%％]?[.!。]?$/i);
 if(cash)return researchPlanSchema.parse({...previous,cashPct:Number(cash[1])});
 const cap=message.trim().match(/^(?:asset cap|單一資產上限|单一资产上限)(?:\s*(?:to|改(?:為|成)?|改为|=))?\s*(\d+(?:\.\d+)?)\s*[%％]?[.!。]?$/i);
 if(cap)return researchPlanSchema.parse({...previous,maxAssetPct:Number(cap[1])});
}
export function wantsRiskDisplay(message:string){return /^(?:show (?:the )?risk contributions?|顯示風險貢獻|显示风险贡献)[.!。]?$/i.test(message.trim());}

export function isCompletionMessage(message:string){return /^(?:(?:thanks|thank you|done|finished|all done|no further questions|that's all|no next step needed)[,.! ]*)+$|^(?:(?:謝謝|谢谢|多謝|多谢|完成了|完成|已完成|不需要下一步|唔需要下一步|不用繼續|不用继续|到此為止|到此为止)[，。！、\s]*)+$/i.test(message.trim());}
