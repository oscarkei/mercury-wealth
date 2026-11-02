import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionTask,guardTaskTool} from '../task-state.mjs';
import {calculateHeldRebalance} from '../held-rebalance.mjs';
import {resolveFollowup} from '../followup-actions.mjs';
const run=(question,id='t1',key='scope')=>({id,question,portfolio_scope:{key}});
const patch=(updates=[],extra={})=>({relation:'follow_up',task_patch:{updates,...extra}});
test('confirmed conditions survive six exchanges, single-field edit and language change',()=>{
 let state=transitionTask(null,run('現金 10%，MSFT 不變'),patch([{key:'cash_target',value:'10',quote:'現金 10%'},{key:'locked_symbols',value:'MSFT',quote:'MSFT 不變'}]));
 for(let i=0;i<6;i++)state=transitionTask(state,run('Explain the assumptions','t'+i),patch());
 state=transitionTask(state,run('現金改 15%','last'),patch([{key:'cash_target',value:'15',quote:'現金改 15%'}]));
 assert.equal(state.conditions.cash_target.value,'15');assert.equal(state.conditions.locked_symbols.value,'MSFT');
 assert.equal(state.conditions.locked_symbols.turn_id,'t1');
});
test('topic and scope changes reset conditions; invented quotes and removals rejected',()=>{
 const old=transitionTask(null,run('現金 10%'),patch([{key:'cash_target',value:'10',quote:'現金 10%'}]));
 assert.deepEqual(transitionTask(old,run('Intel'),{relation:'new_topic'}).conditions,{});
 assert.deepEqual(transitionTask(old,run('持倉','new','another'),patch()).conditions,{});
 assert.throws(()=>transitionTask(old,run('more'),patch([{key:'cash_target',value:'50',quote:'50%'}])));
 assert.throws(()=>transitionTask(old,run('more'),patch([],{clear:['cash_target']})));
});
test('display-only rejects computation, preserved shock/cash must match tool params',()=>{
 assert.throws(()=>guardTaskTool('get_portfolio',{}, {task_state:{operation:'presentation_only'}}));
 assert.throws(()=>guardTaskTool('portfolio_scenario',{shock_pct:-20},{task_state:{conditions:{shock_pct:{value:'-10'}}}}));
 assert.throws(()=>guardTaskTool('rebalance_portfolio',{targets:[{category:'cash',weight_pct:5}]},{task_state:{conditions:{cash_target:{value:'10'}}}}));
});
test('held rebalance keeps locked MSFT value, totals reconcile, infeasible targets fail',()=>{
 const r={...run('再試'),history:[],context_selection:{reuse_result_ids:['R1']},results:[{id:'R1',kind:'portfolio_snapshot',scope_key:'scope',data:{query:'',total:1000,holdings:[{id:'a',symbol:'MSFT',category:'equity',value:400},{id:'b',symbol:'AAPL',category:'equity',value:500},{id:'c',category:'cash',value:100}]}}],task_state:{conditions:{cash_target:{value:'20'},locked_symbols:{value:'MSFT'}}}};
 const calc=calculateHeldRebalance({result_id:'R1',targets:[{category:'cash',weight_pct:20}],unspecified:'keep_relative'},r);
 assert.equal(calc.rows[0].target_value,400);assert.equal(calc.rows[1].target_value,400);assert.equal(calc.after,1000);
 r.task_state.conditions.cash_target.value='90';assert.throws(()=>calculateHeldRebalance({result_id:'R1',targets:[{category:'cash',weight_pct:90}],unspecified:'keep_relative'},r),/locked/);
});
test('signed CTA accepts only bounded numeric input; no forged extra field',()=>{
 const item={question:'改為 {value}%',input:{min:-80,max:80}};
 assert.equal(resolveFollowup(item,-15).question,'改為 -15%');
 for(const value of [NaN,Infinity,-81,'-10'])assert.throws(()=>resolveFollowup(item,value));
 assert.throws(()=>resolveFollowup({question:'解釋'},10));
});

test('cash-only target scales unlocked holdings equally across categories',()=>{
 const r={...run('現金 20%'),history:[],context_selection:{reuse_result_ids:['R1']},results:[{id:'R1',kind:'portfolio_snapshot',scope_key:'scope',data:{query:'',total:1000,holdings:[{id:'a',symbol:'MSFT',category:'equity',value:400},{id:'b',symbol:'AAPL',category:'equity',value:200},{id:'d',category:'bond',value:300},{id:'c',category:'cash',value:100}]}}],task_state:{conditions:{locked_symbols:{value:'MSFT'}}}};
 const c=calculateHeldRebalance({result_id:'R1',targets:[{category:'cash',weight_pct:20}],unspecified:'keep_relative'},r);
 assert.equal(c.rows[0].target_value,400);assert.equal(c.rows[1].target_value,160);assert.equal(c.rows[2].target_value,240);assert.equal(c.after,1000);
});
