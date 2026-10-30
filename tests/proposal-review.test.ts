import test from 'node:test';
import assert from 'node:assert/strict';
import {compareResults,type ResultVersion} from '../src/lib/proposal-review.ts';
// Narrow fixture: comparison consumes only allocation and evidence metadata.
const now=Date.now();
function version(id:string):ResultVersion{return {id,scopeKey:'all',analysis:{plan:{symbols:['SPY','BND']},data:{retrieved_at:new Date(now).toISOString(),histories:[{stale:false,status:'observed'}],optimization:{capital:100000,first_date:'2025-01-01',last_date:'2026-01-01',rows:[{symbol:'SPY',target_pct:60},{symbol:'BND',target_pct:30}],cash_pct:10,target_volatility_pct:8,estimated_cost:100}}} as ResultVersion['analysis']};}
test('comparison refuses mixed scopes, stale evidence and incompatible baselines',()=>{
 const a=version('a'),b=version('b');
 assert.ok('issue' in compareResults(a,b,'other',now));
 b.analysis.data.histories[0].stale=true;assert.ok('issue' in compareResults(a,b,'all',now));
 b.analysis.data.histories[0].stale=false;b.analysis.data.retrieved_at=new Date(now-7200001).toISOString();assert.ok('issue' in compareResults(a,b,'all',now));
 b.analysis.data.retrieved_at=new Date(now).toISOString();b.analysis.data.optimization!.capital=200000;assert.ok('issue' in compareResults(a,b,'all',now));
});
test('comparison binds each weight to its symbol rather than row order',()=>{
 const a=version('a'),b=version('b');b.analysis.data.optimization!.rows.reverse();
 b.analysis.data.optimization!.rows[0].target_pct=40; b.analysis.data.optimization!.cash_pct=0;
 const r=compareResults(a,b,'all',now);assert.ok(!('issue' in r));assert.deepEqual(r.rows,[{symbol:'SPY',a:60,b:60},{symbol:'BND',a:30,b:40}]);
 assert.ok('issue' in compareResults(a,a,'all',now));
});

test('missing or duplicate allocation evidence cannot become a zero weight',()=>{const a=version('a'),b=version('b');b.analysis.data.optimization!.rows[0].symbol='GLD';assert.ok('issue' in compareResults(a,b,'all',now));b.analysis.data.optimization!.rows[0].symbol='BND';assert.ok('issue' in compareResults(a,b,'all',now));});
