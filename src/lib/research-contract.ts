import {companyEvidenceSchema} from './company-evidence-contract.ts';
import {z} from 'zod';
const symbol=z.string().regex(/^[A-Z][A-Z0-9]{0,9}(?:[.-][A-Z])?$/);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const researchPlanSchema=z.object({
 task:z.enum(['history','optimize']),includeVolume:z.boolean().optional(),symbols:z.array(symbol).min(1).max(6),
 startDate:day.nullable(),endDate:day.nullable(),objective:z.enum(['min_variance','min_cvar','risk_parity']),
 cashPct:z.number().finite().min(0).max(40),maxAssetPct:z.number().finite().min(10).max(100),
 capital:z.number().finite().min(1000).max(100000000),costBps:z.number().finite().min(0).max(100)
}).strict().superRefine((p,c)=>{
 for(const d of [p.startDate,p.endDate])if(d&&(!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))c.addIssue({code:'custom',message:'Invalid calendar date'});
 if(p.startDate&&p.endDate&&p.startDate>=p.endDate)c.addIssue({code:'custom',message:'Start date must precede end date'});
 if(new Set(p.symbols).size!==p.symbols.length)c.addIssue({code:'custom',message:'Duplicate tickers'});
 if(p.task==='optimize'&&(p.symbols.length<2||p.maxAssetPct*p.symbols.length<100-p.cashPct))c.addIssue({code:'custom',message:'Infeasible model allocation'});
});
export type ResearchPlan=z.infer<typeof researchPlanSchema>;
export const researchModules=['history_comparison','history_volume','allocation_changes','risk_contributions'] as const;
const point=z.object({date:day,close:z.number().finite().positive(),open:z.number().finite().nonnegative().nullable(),high:z.number().finite().nonnegative().nullable(),low:z.number().finite().nonnegative().nullable(),volume:z.number().finite().nonnegative().nullable()});
const history=z.object({symbol,provider:z.literal('OpenBB / Cboe'),currency:z.literal('USD'),basis:z.literal('provider_close_adjustment_unverified'),retrieved_at:z.string().datetime(),points:z.array(point).max(800),first_date:day.nullable(),last_date:day.nullable(),observations:z.number().int().min(0).max(800),price_change_pct:z.number().finite().nullable(),snapshot_id:z.string().regex(/^[a-f0-9]{64}$/).nullable(),status:z.enum(['observed','unavailable']),cache_hit:z.boolean(),stale:z.boolean()});
const allocation=z.object({symbol,reference_pct:z.number().finite().min(0).max(100),target_pct:z.number().finite().min(0).max(100),change_pp:z.number().finite(),notional:z.number().finite().nonnegative(),side:z.enum(['buy','sell','hold']),risk_contribution_pct:z.number().finite()});
const optimization=z.object({objective:z.enum(['min_variance','min_cvar','risk_parity']),library:z.literal('Riskfolio-Lib'),version:z.string(),solver:z.literal('CLARABEL'),reference:z.string(),rows:z.array(allocation).min(2).max(6),cash_pct:z.number().min(0).max(40),capital:z.number().positive(),estimated_cost:z.number().nonnegative(),post_cost_nav:z.number().positive(),reference_volatility_pct:z.number().nonnegative(),target_volatility_pct:z.number().nonnegative(),observations:z.number().int().min(89),first_date:day,last_date:day,method:z.string(),out_of_sample:z.literal(false),execution_ready:z.literal(false),suitability_status:z.literal('not_assessed')});
export const researchDataSchema=z.object({kind:z.enum(['market_history','portfolio_optimization']),engine:z.literal('mercury-research-1.0.0'),requested:z.record(z.string(),z.unknown()),histories:z.array(history).min(1).max(6),warnings:z.array(z.string().max(500)).max(30),storage:z.literal('local_sqlite'),retrieved_at:z.string().datetime(),trace:z.array(z.object({tool:z.enum(['market_history','optimize_allocation']),library:z.string().max(80),provider:z.string().max(80),status:z.enum(['completed','partial'])})).max(2),optimization:optimization.optional(),run_id:z.string().uuid().optional()}).strict().superRefine((p,c)=>{
 if(p.kind==='portfolio_optimization'&&!p.optimization)c.addIssue({code:'custom',message:'Missing optimization result'});
});
export const researchAnalysisSchema=z.object({companyEvidence:companyEvidenceSchema.optional(),plan:researchPlanSchema,data:researchDataSchema,modules:z.array(z.enum(researchModules)).min(1).max(3),composer:z.object({provider:z.enum(['Laya','Gemini','Local']),model:z.string(),elapsed_ms:z.number().nonnegative(),suggested:z.enum(researchModules)}),plannerModel:z.string()}).strict();
export type ResearchAnalysis=z.infer<typeof researchAnalysisSchema>;
export type ResearchData=z.infer<typeof researchDataSchema>;
