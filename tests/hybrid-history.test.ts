import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {HybridStore} from '../src/lib/hybrid-store.ts';
import {reconstructHistory} from '../src/lib/portfolio-history-server.ts';
import type {FamilySnapshot} from '../src/lib/family-contract.ts';
test('hybrid SQLite survives reopen, isolates owners and rejects late completion after reset',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hybrid-store-')),path=join(dir,'conversations.sqlite');try{let store=new HybridStore(path);const run={id:'run1',question:'Test',answer:'Answer',status:'completed'},scope={bank:'all',book:'all'};store.save('owner1','chat1',scope,run);store.close();store=new HybridStore(path);assert.equal(store.history('owner1').turns.length,1);assert.equal(store.run('owner2','run1'),undefined);store.reset('owner1','chat1');store.save('owner1','chat1',scope,{...run,id:'late'});assert.equal(store.history('owner1','chat1').turns.length,0);store.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
test('price reconstruction anchors the selected snapshot, holds unpriced values flat and never mixes banks',()=>{
 const snapshot={asOf:'2026-06-19',holdings:[{name:'Stock',symbol:'MSFT',instrumentType:'ORD',currency:'USD',value:100,bank:'UBS',bookId:'u'},{name:'Bond',symbol:'BOND',instrumentType:'GOVT_BOND',currency:'USD',value:100,bank:'UBS',bookId:'u'},{name:'Other',symbol:'MSFT',instrumentType:'ORD',currency:'USD',value:900,bank:'JB',bookId:'j'}]} as FamilySnapshot;
 const history={symbol:'MSFT',status:'observed',stale:false,provider:'test',points:Array.from({length:20},(_,i)=>({date:'2026-05-'+String(i+1).padStart(2,'0'),close:100+i}))};
 const result=reconstructHistory(snapshot,[history],{bank:'UBS',book:'all'});assert.equal(result.total,200);assert.equal(result.coveragePct,50);assert.equal(result.points.at(-1)!.value,200);assert.ok(Math.abs(result.points[0].value-(100+100*100/119))<1e-8);assert.deepEqual(result.unpriced,['Bond']);
 assert.equal(reconstructHistory(snapshot,[{...history,stale:true}],{bank:'UBS',book:'all'}).points.length,0);
 assert.equal(reconstructHistory(snapshot,[{...history,points:history.points.map((p,i)=>({...p,close:i===10?1000:p.close}))}],{bank:'UBS',book:'all'}).points.length,0);
});
