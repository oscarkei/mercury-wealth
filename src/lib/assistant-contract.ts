import {inputRequestSchema,interactionSchema,uiLanguageSchema,type InputRequest} from './interactive-ui.ts';
import type {WealthScenario} from './wealth-scenario-contract.ts';
import type {PortfolioImpact} from './portfolio-impact.ts';
import {geminiModelSchema} from './gemini-model.ts';
import type {RichResponse} from './rich-response.ts';
import {stockContextSchema,type StockAnalysis} from './stock-contract.ts';
import type {StageDetails} from './analysis-stage.ts';
import {researchPlanSchema,type ResearchAnalysis} from './research-contract.ts';
import {z} from 'zod';
import {fedContextSchema,type FedAnalysis} from './fed-contract.ts';
export const destinations=['overview','portfolio','products','cash','proposal','brief','clarify'] as const;
export const focuses=['balanced','downside','income','portfolio'] as const;
export const assistantInputSchema=z.object({
 language:uiLanguageSchema.optional(),interaction:interactionSchema.optional(),conversationId:z.string().uuid().optional(),resumeRequestId:z.string().uuid().optional(),requestId:z.string().uuid(),revision:z.number().int().nonnegative(),message:z.string().trim().min(1).max(500),geminiModel:geminiModelSchema.optional(),
 context:z.string().max(220),view:z.enum(['overview','portfolio','products','insights','documents']),
 product:z.enum(['phoenix','note-a','fcn']),path:z.array(z.number().finite().min(0).max(150)).length(7),
 history:z.array(z.object({role:z.enum(['user','assistant']),text:z.string().max(6000)}).strict()).max(40)
,fedContext:fedContextSchema.optional(),stockContext:stockContextSchema.optional(),researchContext:researchPlanSchema.optional(),portfolioScope:z.object({household:z.literal('hh_okonkwo'),bank:z.string().max(60),book:z.string().max(80)}).strict().optional()
}).strict();
export type AssistantInput=z.infer<typeof assistantInputSchema>;
export const generatedSchema=z.object({reply:z.string().trim().min(1).max(6000),destination:z.enum(destinations),focus:z.enum(focuses)}).strict();
export const decisionSchema=z.object({destination:z.enum(destinations),focus:z.enum(focuses)}).strict();
export type Destination=typeof destinations[number];
export type Provider='Gemini'|'Qwen'|'DeepSeek'|'Jev'|'Laya'|'Local';
export const actionLabels:Record<Destination,string>={overview:'Open your overview',portfolio:'Review allocation and holdings',products:'Open this product scenario',cash:'Plan the maturity proceeds',proposal:'Review the adviser proposal',brief:'Prepare a discussion brief',clarify:'Continue the conversation'};
export type ConnectionStatus={server:boolean;enabled:boolean;ready:boolean;gemini:{configured:boolean;model:string};router:{provider:Provider;configured:boolean;model:string};verified:boolean;wealth?:{application?:string;library:string;memory:string;composition:string}};
export type AssistantEvent=Partial<StageDetails> & {inputRequest?:InputRequest;type:'input_request'|'wealth_scenario'|'portfolio_impact'|'rich_response'|'start'|'reply'|'local_account'|'decision'|'analysis'|'stock_analysis'|'research_analysis'|'progress'|'error'|'done';requestId:string;revision:number;richResponse?:RichResponse;wealthScenario?:WealthScenario;portfolioImpact?:PortfolioImpact;toolCalls?:string[];provider?:Provider;status?:'started'|'completed'|'failed';analysis?:FedAnalysis;stockAnalysis?:StockAnalysis;researchAnalysis?:ResearchAnalysis;text?:string;model?:string;elapsed_ms?:number;destination?:Destination;focus?:typeof focuses[number];product?:AssistantInput['product'];path?:number[];message?:string;code?:string;retryAfterMs?:number;resumeAvailable?:boolean};
