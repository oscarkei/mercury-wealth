// Fixed local-demo read capability; never accepts URLs, SQL, credentials or household IDs from a model.
import {createHash} from 'node:crypto';
export const HOUSEHOLD='hh_okonkwo';
export function capability(owner,book='all',bank='all'){if(!owner)throw Error('Signed prototype session required.');return {household:HOUSEHOLD,book,bank,key:HOUSEHOLD+':'+book+(bank==='all'?'':':'+bank),mode:'authorized_demo_read_only'};}
export function sanitizeSnapshot(raw,scope){
 if(scope?.household!==HOUSEHOLD||raw?.householdId!==HOUSEHOLD||raw?.source!=='supabase'||raw?.dataMode!=='mock'||!Array.isArray(raw.holdings))throw Error('Expected the authorized Supabase Okonkwo mock snapshot; no substitute data accepted.');
 if(scope.book!=='all'&&!raw.holdings.some(h=>h.bookId===scope.book))throw Error('Book is outside the authorized household.');
 if((scope.bank||'all')!=='all'&&!raw.holdings.some(h=>h.bank===scope.bank))throw Error('Bank is outside the authorized household.');
 if(scope.book!=='all'&&(scope.bank||'all')!=='all'&&!raw.holdings.some(h=>h.bookId===scope.book&&h.bank===scope.bank))throw Error('Book and bank do not belong to the same scope.');
 const holdings=raw.holdings.filter(h=>(scope.book==='all'||h.bookId===scope.book)&&((scope.bank||'all')==='all'||h.bank===scope.bank)).map(h=>{
  if(!h.id||!h.bookId||!Number.isFinite(h.value)||!Number.isFinite(h.cost))throw Error('Incomplete portfolio valuation.');
  return {id:h.id,name:h.name,category:h.category,value:h.value,cost:h.cost,pnl:h.value-h.cost,symbol:h.symbol||null,book:h.book,bookId:h.bookId,bank:h.bank,instrumentType:h.instrumentType,valuedAt:h.valuedAt};
 });
 const total=holdings.reduce((s,h)=>s+h.value,0),cost=holdings.reduce((s,h)=>s+h.cost,0);
 if(scope.book==='all'&&(scope.bank||'all')==='all'&&Math.abs(total-raw.total)>0.02)throw Error('Portfolio total does not reconcile.');
 return {source:'supabase',dataMode:'mock',householdId:HOUSEHOLD,household:raw.household,scope_key:scope.key,book:scope.book,asOf:raw.asOf,retrievedAt:raw.retrievedAt,version:raw.version||createHash('sha256').update(JSON.stringify(holdings)).digest('hex'),holdings,total,cost,pnl:total-cost,warnings:raw.warnings||[],books:[...new Map(raw.holdings.map(h=>[h.bookId,{id:h.bookId,name:h.book,bank:h.bank}])).values()]};
}
export function createPortfolioBridge(fetcher=fetch){
 let cookie='',expires=0,pending=null;const base='http://127.0.0.1:3001';
 const headers=()=>({'Origin':base,'x-mercury-client':'portal','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})});
 async function connect(signal){if(cookie&&Date.now()<expires)return;if(pending)return pending;pending=(async()=>{const r=await fetcher(base+'/api/session',{method:'POST',headers:headers(),body:'{}',redirect:'error',signal});if(!r.ok)throw Error('Existing portfolio session unavailable.');cookie=r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');if(!cookie)throw Error('Portfolio session was not issued.');expires=Date.now()+7*3600000;})();try{await pending;}finally{pending=null;}}
 return async(scope,signal)=>{if(scope?.household!==HOUSEHOLD)throw Error('Household not authorized.');const deadline=AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(25000)]);await connect(deadline);const response=await fetcher(base+'/api/portfolio/okonkwo',{method:'POST',headers:headers(),body:'{}',redirect:'error',signal:deadline});if(!response.ok)throw Error('Supabase portfolio is unavailable; no cached/demo substitution.');return sanitizeSnapshot(await response.json(),scope);};
}
export const loadPortfolio=createPortfolioBridge();
