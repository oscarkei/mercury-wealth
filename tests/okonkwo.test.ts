import {test} from 'node:test';
import assert from 'node:assert/strict';
import {family,scopedHoldings,summarize,allocationFor} from '../src/lib/family-portfolio.ts';
import {accumulatorModel} from '../src/lib/accumulator-model.ts';
import {loadOkonkwo} from '../src/lib/okonkwo-server.ts';
import verification from '../src/lib/okonkwo-verification.json' with {type:'json'};

test('Okonkwo reconciles to imported valuations; custodians and books are disjoint partitions',()=>{
 assert.equal(family.holdings.length,23);assert.ok(Math.abs(summarize(family.holdings).value-28469027.34)<.01);
 const grouped=family.books.map(b=>summarize(scopedHoldings(family.holdings,{bank:'all',book:b.id})).value);
 assert.ok(Math.abs(grouped.reduce((a,b)=>a+b,0)-family.total)<.01);
 assert.equal(scopedHoldings(family.holdings,{bank:'Julius Baer',book:'pf_okonkwo_global'}).length,0);
 assert.equal(scopedHoldings(family.holdings,{bank:'UBS',book:'all'}).length,18);
 assert.equal(scopedHoldings(family.holdings,{bank:'Julius Baer',book:'all'}).length,5);
 assert.ok(Math.abs(summarize(family.holdings).cost-21512747.11)<.01);
 for(const group of ['asset','custodian','book'] as const)assert.ok(Math.abs(allocationFor(family.holdings,group).reduce((n,a)=>n+a.percent,0)-100)<1e-8);
 assert.equal(family.holdings.find(h=>h.instrumentId==='inst_sgld_l')!.category,'alternative');
});
test('accumulator has strike / KO boundary rules and a purchase obligation, not guaranteed income',()=>{
 assert.equal(accumulatorModel(88,20).at(-1)!.shares,800);
 assert.equal(accumulatorModel(87,20).at(-1)!.shares,1600);
 assert.equal(accumulatorModel(104,20).at(-1)!.shares,800);
 assert.equal(accumulatorModel(105,20).at(-1)!.shares,0);
 const down=accumulatorModel(50,20).at(-1)!;assert.ok(down.value<down.cost);
 assert.equal(accumulatorModel(0,20).at(-1)!.value,0);
 assert.throws(()=>accumulatorModel(NaN,20));assert.throws(()=>accumulatorModel(95,0));
});
