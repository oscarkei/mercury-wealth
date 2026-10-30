import test from 'node:test';
import assert from 'node:assert/strict';
import { allocation, holdings, changes, TOTAL, payoff, cashScenario, compose, validSpec, infer, parseShock, mockReply, FX } from '../src/lib/domain.ts';

test('snapshot reconciles holdings, categories and total',()=>{
 assert.equal(holdings.reduce((n,h)=>n+h.value,0),TOTAL);
 assert.equal(allocation.reduce((n,a)=>n+a.value,0),TOTAL);
 assert.equal(allocation.reduce((n,a)=>n+a.percent,0),100);
 for(const a of allocation){assert.equal(holdings.filter(h=>h.category===a.id).reduce((n,h)=>n+h.value,0),a.value);assert.ok(Math.abs(a.value/TOTAL*100-a.percent)<1e-10);}
});
test('wealth change separates deposits from market performance',()=>{
 assert.equal(changes.opening+changes.market+changes.fx+changes.flow+changes.unclassified,changes.closing);
 assert.equal(changes.closing-changes.opening,120000);assert.equal(changes.market+changes.fx,90000);
});
test('SP golden cases at zero, strike, negative and positive prices',()=>{
 for(const [shock,principal,total,net] of [[-100,0,4000,-96000],[-40,75000,79000,-21000],[-20,100000,104000,4000],[-15,100000,104000,4000],[0,100000,104000,4000],[10,100000,104000,4000]]){
  const p=payoff(shock);assert.equal(p.principal,principal);assert.equal(p.total,total);assert.equal(p.net,net);assert.equal(p.coupon,4000);
 }
});
test('SP is continuous across strike and rejects invalid scenarios',()=>{
 assert.ok(Math.abs(payoff(-20.001).total-payoff(-20).total)<2);
 for(const x of [NaN,Infinity,-101,31])assert.throws(()=>payoff(x));
});
test('conditional proceeds never mutate currently available cash',()=>{
 assert.equal(cashScenario(false).available,1515600);assert.equal(cashScenario(true).available,1515600);
 assert.equal(cashScenario(false).projected,1775600);assert.equal(cashScenario(true).projected,1925600);
});
test('one SP route supports genuinely different approved component compositions',()=>{
 const specs=['balanced','downside','income','portfolio'].map(f=>compose('sp',f as 'balanced'));
 assert.equal(new Set(specs.map(s=>JSON.stringify(s.components))).size,4);
 for(const s of specs){assert.ok(validSpec(s));for(const c of ['Terms','ScenarioControl','Payoff','Risk','QuoteDraft','Source'])assert.ok(s.components.includes(c as 'Terms'));}
});
test('composer rejects injection, missing risk, duplicates and unknown references',()=>{
 const s=compose('sp');
 for(const value of [{...s,components:s.components.filter(x=>x!=='Risk')},{...s,components:[...s.components,'Risk']},{...s,components:['Source','<script>']},{...s,snapshot:'another-household'},null,{...s,focus:'execute'}])assert.equal(validSpec(value),false);
});
test('stock drawdown and denial do not automatically route to a structured note',()=>{
 assert.equal(infer('我股票跌咗40%','overview').route,'allocation');
 assert.equal(infer('唔係note，我講股票跌咗','note').route,'allocation');
 assert.equal(infer('跌咗40%點算','overview').route,'clarify');
 assert.equal(infer('我張note跌40%會點','overview').route,'sp');
 assert.equal(infer('跌20%會點','note').route,'sp');
});
test('mixed Cantonese and English route to appropriate workspaces',()=>{
 for(const [m,r] of [['半年唔用，定存之外點收息','liquidity'],['英鎊學費點安排','liquidity'],['想交棒，要唔要trust','family'],['搬去英國前要做咩','tax'],['show my adviser proposal','proposal'],['research同我有咩關係','research']])assert.equal(infer(m,'overview').route,r);
});
test('scenario extraction is shared with written explanation, never hard-coded to -40',()=>{
 assert.equal(parseShock('我張note跌20%'),-20);assert.equal(parseShock('note down 40%'),-40);
 assert.equal(parseShock('升10%'),10);assert.equal(parseShock('點解',-15),-15);
 assert.match(mockReply('sp',-20),/104,000/);assert.doesNotMatch(mockReply('sp',-20),/79,000/);
 assert.throws(()=>parseShock('跌110%'));
});
test('reporting conversions preserve the same underlying snapshot',()=>{
 assert.equal(TOTAL*FX.HKD,65676000);assert.equal(Math.round(TOTAL*FX.GBP),6483400);
});
