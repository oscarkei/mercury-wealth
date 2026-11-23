import test from 'node:test';
import assert from 'node:assert/strict';
import {demoHistory} from '../demo-history.mjs';
import {blockProxyForHeldContext} from '../held-rebalance.mjs';
import {evidenceIssues} from '../evidence-review.mjs';
import {guardTaskTool} from '../task-state.mjs';

const scope = 'household:book';
const snapshot = {id:'R1',kind:'portfolio_snapshot',scope_key:scope,data:{holdings:[{symbol:'MSFT'},{symbol:'AAPL'}]}};
const bundle = {id:'R2',kind:'market_bundle',scope_key:scope,data:{portfolio_result_id:'R1',requested:{symbols:['MSFT','AAPL']}}};
const run = {results:[snapshot,bundle],portfolio_scope:{key:scope}};

test('held model requires a bound price bundle and cannot append other tickers', () => {
 assert.doesNotThrow(()=>blockProxyForHeldContext('optimize_allocation',run,{history_result_id:'R2'}));
 assert.throws(()=>blockProxyForHeldContext('optimize_allocation',run,{}));
 const conditions = {universe:{value:'MSFT',quote:'只看 MSFT'}};
 assert.throws(()=>guardTaskTool('optimize_allocation',{history_result_id:'R2'},{...run,task_state:{conditions}}));
});

test('foreign holding rejected before price access; damaged release fails verification', async () => {
 await assert.rejects(demoHistory({symbols:['GLD'],portfolio_result_id:'R1'},run),/active portfolio/);
 await assert.rejects(demoHistory({symbols:['MSFT']},run,{fetcher:async()=>new Response('{}')}),/verified release/);
});

test('locked whole-portfolio weight is preserved when other holdings fund cash', () => {
 const result={kind:'portfolio_rebalance',data:{locked_symbols:['MSFT']}};
 const state={results:[result]};
 assert.ok(evidenceIssues('MSFT 在整體組合的權重上升。',state).some(i=>i.code==='locked_weight_change'));
 assert.deepEqual(evidenceIssues('MSFT 在整體組合的權重不變，但在股票類別佔比上升。',state),[]);
});

test('sector membership cannot establish high correlation in the generated sample', () => {
 const run={results:[{kind:'allocation',data:{pairwise_daily_correlation:{min:-0.077,max:0.095}}}]};
 assert.ok(evidenceIssues('五隻同屬科技股，樣本內相關性偏高。',run).some(i=>i.code==='unsupported_high_sample_correlation'));
 assert.deepEqual(evidenceIssues('同屬科技股不代表樣本內相關性偏高。',run),[]);
});
