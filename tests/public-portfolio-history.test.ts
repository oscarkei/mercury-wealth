import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectPublicHistory,type PublicHistoryDataset} from '../src/lib/public-portfolio-history.ts';
import {family,scopedHoldings,summarize} from '../src/lib/family-portfolio.ts';
const data=JSON.parse(readFileSync(new URL('../public/demo/portfolio-history.json',import.meta.url),'utf8')) as PublicHistoryDataset;
test('every public demo scope matches its displayed holdings and valuation total',()=>{
 for(const item of data.histories){
  const rows=scopedHoldings(family.holdings,item.scope);
  const history=selectPublicHistory(data,rows,item.scope);
  assert.equal(history.savedDemo,true);
  assert.ok(history.points.length>=200);
  assert.ok(Math.abs(history.points.at(-1)!.value-summarize(rows).value)<.01);
  assert.ok(history.coveragePct>0&&history.coveragePct<100);
  assert.ok(history.priceAsOf!<=history.valuationAsOf);
 }
});
test('custodian curves are distinct and aggregate to the family on every date',()=>{
 const get=(bank:string)=>selectPublicHistory(data,scopedHoldings(family.holdings,{bank,book:'all'}),{bank,book:'all'});
 const all=get('all'),ubs=get('UBS'),jb=get('Julius Baer');
 for(let i=0;i<all.points.length;i++)assert.ok(Math.abs(all.points[i].value-ubs.points[i].value-jb.points[i].value)<.02);
 assert.ok(Math.abs(ubs.points[0].value/ubs.total-jb.points[0].value/jb.total)>.001);
});
test('public curves cannot silently substitute for changed holdings or another account scope',()=>{
 const scope={bank:'all',book:'all'};
 assert.throws(()=>selectPublicHistory(data,[],scope));
 assert.throws(()=>selectPublicHistory(data,family.holdings,{bank:'another bank',book:'all'}));
 assert.throws(()=>selectPublicHistory(data,family.holdings.map((h,i)=>i? h:{...h,value:h.value+1}),scope));
});
