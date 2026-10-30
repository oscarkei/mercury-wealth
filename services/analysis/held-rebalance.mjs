import {z} from 'zod';
import {activeResults} from './conversation-policy.mjs';
const category=z.enum(['equity','bond','alternative','note','cash']);
export const rebalanceSchema=z.object({result_id:z.string().regex(/^R\d+$/),target_turn:z.number().int().min(0).max(5).default(0).describe('User message containing target percentages: 0 = current question, 1 = most recent previous user question. Server reads the actual message; never supply or paraphrase consent text.'),targets:z.array(z.object({category,weight_pct:z.number().min(0).max(100)}).strict()).min(1).max(5),unspecified:z.enum(['keep_relative','zero']).describe('keep_relative redistributes the remaining weight proportionately across unspecified current categories; zero requires all positive target categories explicitly specified. Do not infer a target objective.')}).strict();
export function blockProxyForHeldContext(name,run){
 if(['strategy_backtest','optimize_allocation'].includes(name)&&activeResults(run).some(r=>r.scope_key===run.portfolio_scope?.key&&r.kind?.startsWith('portfolio_')))throw Error('Active task uses actual scoped holdings. This tool substitutes a public model/equal-weight reference and cannot rebalance these holdings. Use rebalance_portfolio after the user supplies target weights. If targets are missing, ask one concise clarification. Do not silently replace held assets with ETF proxies. A separately requested public model must be a separate new-topic analysis.');
}
export function calculateHeldRebalance(raw,run){
 const args=rebalanceSchema.parse(raw),base=run.results.find(r=>r.id===args.result_id&&r.kind==='portfolio_snapshot'&&r.scope_key===run.portfolio_scope?.key);
 if(!base||base.data.query||!base.data.holdings.length)throw Error('Use a complete active get_portfolio snapshot in the authorized scope, not a searched subset.');
 const statements=[run.question,...(run.history||[]).slice().reverse().map(h=>h.question)],instruction=statements[args.target_turn];
 if(!instruction)throw Error('Target user message does not exist. Ask the user for the target.');
 const percentages=[...instruction.matchAll(/(\d+(?:\.\d+)?)\s*[%％]/g)].map(m=>Number(m[1]));
 if(args.targets.some(t=>!percentages.includes(t.weight_pct)))throw Error('Each explicit target must be a percentage supplied by the user. Ask for numeric target percentages if missing.');
 if(new Set(args.targets.map(t=>t.category)).size!==args.targets.length)throw Error('Duplicate target category.');
 const d=base.data,groups=new Map();for(const h of d.holdings){if(!Number.isFinite(h.value)||h.value<0)throw Error('Only nonnegative valued holdings are supported.');groups.set(h.category,(groups.get(h.category)||0)+h.value);}
 if(!(d.total>0)||Math.abs([...groups.values()].reduce((a,b)=>a+b,0)-d.total)>.02)throw Error('Full snapshot value does not reconcile.');
 const specified=new Map(args.targets.map(t=>[t.category,t.weight_pct])),sum=args.targets.reduce((a,t)=>a+t.weight_pct,0);
 if(sum>100+1e-8||(args.unspecified==='zero'&&Math.abs(sum-100)>1e-8))throw Error('Target weights must total 100%, or explicitly redistribute the remaining weight.');
 for(const [key,value] of specified)if(value>0&&!(groups.get(key)>0))throw Error('Requested category has no existing holdings. Do not invent a new product or substitute an ETF; ask which product to add.');
 const remainder=[...groups].filter(([key])=>!specified.has(key)).reduce((a,[,v])=>a+v,0);
 if(args.unspecified==='keep_relative'&&sum<100&&!remainder)throw Error('No unspecified holdings to receive the remaining weight.');
 const categories=[...groups].map(([category,value])=>{const target_pct=specified.get(category)??(args.unspecified==='keep_relative'&&remainder?(100-sum)*value/remainder:0);const target_value=d.total*target_pct/100;return {category,current_pct:value/d.total*100,target_pct,value,target_value,change:target_value-value};});
 const rows=d.holdings.map(h=>{const c=categories.find(c=>c.category===h.category),target_value=c.value?h.value/c.value*c.target_value:0;return {id:h.id,name:h.name,category:h.category,bank:h.bank,book:h.book,value:h.value,current_pct:h.value/d.total*100,target_pct:target_value/d.total*100,target_value,change:target_value-h.value};});
 const after=rows.reduce((a,h)=>a+h.target_value,0);if(Math.abs(after-d.total)>.02)throw Error('Rebalance does not conserve portfolio value.');
 if(!activeResults(run).some(r=>r.id===base.id)){run.context_selection={relation:'follow_up',reuse_result_ids:[...new Set([...(run.context_selection?.reuse_result_ids||[]),base.id])],reuse_source_ids:run.context_selection?.reuse_source_ids||[]};}
 return {asOf:d.asOf,retrievedAt:d.retrievedAt,base_result_id:base.id,total:d.total,after,categories,rows,target_instruction:instruction,method:'Existing holdings only. Within each asset category, maintain current relative position weights; unspecified categories follow the chosen remainder rule.',classification:'hypothetical_held_snapshot_allocation',execution_ready:false,assumptions:['Snapshot valuation, not live execution prices. No new assets or ETF proxies.','Within-category position weights stay proportional. Cross-account transfers and product tradability are not verified.','Value differences only: quantities, fees, taxes, lot sizes, liquidity, returns and risk are not computed. No orders or portfolio writes.']};
}
