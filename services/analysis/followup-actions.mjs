import {activeResults} from './conversation-policy.mjs';
const tr=(run,en,tc,sc)=>run.language==='en'?en:run.language==='zh-Hans'?sc:tc;
export function availableActions(run){
 const results=activeResults(run),actions=[];
 const scenario=results.findLast(r=>r.kind==='portfolio_scenario');
 if(scenario)actions.push({id:'change-shock',label:tr(run,'Change assumption','改假設再試','改假设再试'),question:tr(run,'Keep the same holdings and constraints; change the price shock to {value}% and recalculate.','保留相同持倉及限制，將價格衝擊改為 {value}%，再試算。','保留相同持仓及限制，将价格冲击改为 {value}%，再试算。'),result_ids:[scenario.id,scenario.data.base_result_id],input:{name:'shock_pct',label:tr(run,'Price change (%)','價格變動（%）','价格变动（%）'),min:-80,max:80,value:scenario.data.shock_pct}});
 const rebalance=results.findLast(r=>r.kind==='portfolio_rebalance');
 if(rebalance){const cash=rebalance.data.categories.find(c=>c.category==='cash');if(cash)actions.push({id:'change-cash',label:tr(run,'Try another allocation','試算另一種配置','试算另一种配置'),question:tr(run,'Keep the same holdings and locked positions; set cash to {value}%, distribute the remainder proportionally and recalculate.','保留相同持倉及鎖定資產，將現金改為 {value}%，其餘按原有比例分配，再試算。','保留相同持仓及锁定资产，将现金改为 {value}%，其余按原有比例分配，再试算。'),result_ids:[rebalance.id,rebalance.data.base_result_id],input:{name:'cash_target',label:tr(run,'Cash target (%)','現金目標（%）','现金目标（%）'),min:0,max:100,value:cash.target_pct}});}
 return actions;
}
export function resolveFollowup(item,value){
 if(!item)throw Error('Follow-up unavailable.');
 if(!item.input){if(value!==undefined)throw Error('This follow-up has no input.');return item;}
 if(!Number.isFinite(value)||value<item.input.min||value>item.input.max)throw Error('Follow-up value is outside the allowed range.');
 return {...item,question:item.question.replace('{value}',String(value))};
}
