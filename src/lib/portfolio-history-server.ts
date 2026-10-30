import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {conversationStore} from './conversation-store.ts';
import type {FamilySnapshot} from './family-contract';
export type PriceHistory={symbol:string;status:string;stale:boolean;provider:string;points:{date:string;close:number}[]};
const pending=new Map<string,Promise<PriceHistory[]>>();
export async function holdingHistories(snapshot:FamilySnapshot):Promise<PriceHistory[]>{
 const symbols=[...new Set(snapshot.holdings.filter(h=>h.currency==='USD'&&['ORD','ETF'].includes(h.instrumentType||'')&&/^[A-Z]{1,6}$/.test(h.symbol||'')).map(h=>h.symbol!))].sort();
 const end=snapshot.asOf,start=new Date(end+'T00:00:00Z');start.setUTCFullYear(start.getUTCFullYear()-1);
 const key='held-history-v1:'+createHash('sha256').update(JSON.stringify([symbols,end])).digest('hex'),store=conversationStore();
 const cached=store.cached<PriceHistory[]>(key);if(cached)return cached;if(pending.has(key))return pending.get(key)!;
 const job=(async()=>{const histories:PriceHistory[]=[];for(let i=0;i<symbols.length;i+=6){const batch=await new Promise<{histories:PriceHistory[]}>((resolve,reject)=>{
  const child=spawn(process.env.MERCURY_FINANCE_PYTHON||process.cwd()+'/.venv-finance/bin/python',['-B','scripts/portfolio-history-worker.py'],{cwd:process.cwd(),env:{NODE_ENV:process.env.NODE_ENV,PATH:'/usr/bin:/bin',HOME:process.env.HOME,OPENBLAS_NUM_THREADS:'1'},stdio:['pipe','pipe','ignore']});let output='';const timer=setTimeout(()=>{child.kill();reject(Error('History source timed out.'));},60000);
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>4000000){child.kill();reject(Error('History response too large.'));}});child.on('error',()=>{clearTimeout(timer);reject(Error('History service unavailable.'));});child.on('close',code=>{clearTimeout(timer);try{if(code!==0)throw Error();resolve(JSON.parse(output));}catch{reject(Error('History source unavailable.'));}});child.stdin.end(JSON.stringify({symbols:symbols.slice(i,i+6),start_date:start.toISOString().slice(0,10),end_date:end}));
 });histories.push(...batch.histories);}store.cache(key,histories,histories.some(h=>h.status!=='observed')?60000:6*3600000);return histories;})().finally(()=>pending.delete(key));pending.set(key,job);return job;
}
export function reconstructHistory(snapshot:FamilySnapshot,histories:PriceHistory[],scope:{bank:string;book:string}){
 const rows=snapshot.holdings.filter(h=>(scope.bank==='all'||h.bank===scope.bank)&&(scope.book==='all'||h.bookId===scope.book)),total=rows.reduce((n,h)=>n+h.value,0);
 const valid=histories.filter(h=>h.status==='observed'&&!h.stale&&h.points.length>=20&&h.points.every((p,i)=>Number.isFinite(p.close)&&p.close>0&&(!i||Math.abs(p.close/h.points[i-1].close-1)<=.5)));
 const weights=valid.map(history=>({history,value:rows.filter(h=>h.currency==='USD'&&h.symbol===history.symbol&&['ORD','ETF'].includes(h.instrumentType||'')).reduce((n,h)=>n+h.value,0)})).filter(h=>h.value>0);
 const covered=weights.reduce((n,h)=>n+h.value,0),fixed=total-covered;
 const maps=weights.map(w=>new Map(w.history.points.map(p=>[p.date,p.close]))),dates=weights.length?weights[0].history.points.map(p=>p.date).filter(d=>maps.every(m=>m.has(d))):[];
 const anchor=dates.at(-1),points=anchor?dates.map(date=>({date,value:fixed+weights.reduce((sum,w,i)=>sum+w.value*maps[i].get(date)!/maps[i].get(anchor)!,0)})):[];
 return {kind:'fixed_holdings_price_illustration',valuationAsOf:snapshot.asOf,priceAsOf:anchor||null,source:'OpenBB / Cboe',currency:'USD',total,covered,coveragePct:total?covered/total*100:0,fixed,points,symbols:weights.map(w=>w.history.symbol),unpriced:rows.filter(h=>!weights.some(w=>w.history.symbol===h.symbol)).map(h=>h.name),method:'Snapshot position values rebased with historical close ratios; holdings mix and unpriced assets held constant. No trades, cash flows, fees, dividends or FX returns. Corporate-action adjustment unverified. Not actual account performance.'};
}
