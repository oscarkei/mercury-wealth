'use client';
import {useEffect,useId,useMemo,useState} from 'react';
import {copy,useAppPreferences} from '../lib/app-preferences';
import {usePublicMock} from './mobile-preview-content';
import {selectPublicHistory,type PortfolioHistory as History,type PublicHistoryDataset} from '../lib/public-portfolio-history';
import {summarize,type FamilyHolding} from '../lib/family-portfolio';

export type ChartSync={period:string;bound:number;onPeriod:(period:string)=>void;onRange:(period:string,bound:number)=>void};
const requests=new Map<string,{at:number;promise:Promise<History>}>();
function load(key:string,scope:{bank:string;book:string},publicMock:boolean,rows:FamilyHolding[]){const old=requests.get(key);if(old&&Date.now()-old.at<300000)return old.promise;const promise=(async()=>{if(publicMock){const response=await fetch('/demo/portfolio-history.json',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Demo history unavailable');return selectPublicHistory(await response.json() as PublicHistoryDataset,rows,scope);}await fetch('/api/session',{method:'POST',headers:{'x-mercury-client':'portal'}});const response=await fetch('/api/portfolio/history',{method:'POST',headers:{'Content-Type':'application/json','x-mercury-client':'portal'},body:JSON.stringify(scope)});if(!response.ok)throw Error('History unavailable');return response.json() as Promise<History>;})();requests.set(key,{at:Date.now(),promise});promise.catch(()=>requests.delete(key));return promise;}
export default function PortfolioValueChart({rows,money,compact=false,explicitScope,sync}:{explicitScope?:{bank:string;book:string};sync?:ChartSync;rows:FamilyHolding[];money:(n:number,compact?:boolean)=>string;compact?:boolean}){
 useAppPreferences();const publicMock=usePublicMock();const id=useId().replace(/:/g,''),[history,setHistory]=useState<History|null>(null),[error,setError]=useState(false),[localPeriod,setLocalPeriod]=useState('1Y'),[focus,setFocus]=useState<number|null>(null),[retry,setRetry]=useState(0);
 const period=sync?.period??localPeriod,setPeriod=sync?.onPeriod??setLocalPeriod;
 useEffect(()=>setFocus(null),[period]);
 const banks=[...new Set(rows.map(r=>r.bank))],books=[...new Set(rows.map(r=>r.bookId))],scope=explicitScope||{bank:banks.length===1?banks[0]:'all',book:books.length===1?books[0]:'all'},key=JSON.stringify([publicMock,scope,rows.map(r=>[r.id,r.value])]);
 useEffect(()=>{let current=true;setHistory(null);setError(false);setFocus(null);load(key,scope,publicMock,rows).then(data=>{if(current)setHistory(data);}).catch(()=>{if(current)setError(true);});return()=>{current=false;};},[key,retry]);
 const points=useMemo(()=>{if(!history?.points.length)return [];const start=new Date(history.points.at(-1)!.date+'T00:00:00Z');start.setUTCMonth(start.getUTCMonth()-(period==='1M'?1:period==='3M'?3:12));return history.points.filter(p=>p.date>=start.toISOString().slice(0,10));},[history,period]);
 const selected=points[focus??points.length-1],total=history?.total??summarize(rows).value;
 const base=points[0]?.value||1,changes=points.map(p=>(p.value/base-1)*100),ownBound=Math.max(10,Math.ceil(Math.max(0,...changes.map(Math.abs))/10)*10),bound=Math.max(ownBound,sync?.bound??10);
 useEffect(()=>{if(points.length>1)sync?.onRange(period,ownBound);},[period,ownBound,points.length,sync?.onRange]);
 const low=compact?-bound:Math.min(...points.map(p=>p.value)),high=compact?bound:Math.max(...points.map(p=>p.value)),span=high-low||1;
 const xy=(i:number)=>[8+i/Math.max(1,points.length-1)*304,132-((compact?changes[i]:points[i].value)-low)/span*104];
 const path=points.map((_,i)=>(i?'L':'M')+xy(i).map(n=>n.toFixed(2)).join(',')).join(' '),change=selected&&points[0].value?(selected.value/points[0].value-1)*100:0;
 return <section className={'portfolio-value-chart wealth-line'+(compact?' is-compact':' card')} data-history-scope={JSON.stringify(scope)} aria-label={copy('Illustrative wealth history','示範財富走勢','演示财富走势')}>
  <header><span>{copy('Wealth over time','財富走勢','财富走势')}</span><small>{publicMock?copy('Saved historical-price demo','歷史價格示範快照','历史价格演示快照'):copy('Historical-price illustration','歷史價格示範回推','历史价格演示回推')}</small></header>
  {!compact&&<h2>{money(selected?.value??total)}</h2>}
  {points.length>1&&<><div className="wealth-line-caption"><strong>{change>=0?'+':''}{change.toFixed(2)}%</strong><span>{copy('model change','示範變化','演示变化')} · {selected?.date}</span></div>
   <svg tabIndex={0} onKeyDown={e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();setFocus(n=>Math.max(0,Math.min(points.length-1,(n??points.length-1)+(e.key==='ArrowLeft'?-1:1))));}} onBlur={()=>setFocus(null)} className="wealth-line-svg" viewBox="0 0 320 156" role="img" aria-label={copy('Reconstructed portfolio value from historical prices','按歷史價格回推的組合估值','按历史价格回推的组合估值')+(selected?' · '+selected.date+' · '+money(selected.value):'')} onPointerMove={e=>{const box=e.currentTarget.getBoundingClientRect();setFocus(Math.max(0,Math.min(points.length-1,Math.round(((e.clientX-box.left)/box.width*320-8)/304*(points.length-1)))));}} onPointerLeave={()=>setFocus(null)}>
    {compact&&<><line x1="8" x2="312" y1="80" y2="80" stroke="currentColor" opacity=".25" strokeDasharray="3 4"/><text x="8" y="20" fill="currentColor" fontSize="10">+{bound}%</text><text x="8" y="148" fill="currentColor" fontSize="10">−{bound}%</text></>}
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".22"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
    <path d={path+' L312,152 L8,152 Z'} fill={'url(#'+id+')'}/><path className="wealth-line-stroke" key={key} d={path} fill="none" stroke="currentColor" strokeWidth="2.4" pathLength="1"/>
    {selected&&<circle cx={xy(focus??points.length-1)[0]} cy={xy(focus??points.length-1)[1]} r="4" fill="currentColor"/>}
   </svg><div className="wealth-line-dates"><span>{points[0].date}</span><span>{points.at(-1)!.date}</span></div>
   <div className="wealth-line-periods">{['1M','3M','1Y'].map(p=><button key={p} type="button" aria-pressed={period===p} onClick={()=>{setPeriod(p);setFocus(null);}}>{p}</button>)}</div>
   <p>{copy('Historical prices cover','歷史價格覆蓋','历史价格覆盖')} {history!.coveragePct.toFixed(1)}% · {copy('remaining values held flat','其餘估值維持不變','其余估值维持不变')}</p>
   {!compact&&<p className="wealth-line-source">OpenBB / Cboe · {history!.symbols.join(' · ')}<br/>{copy('Snapshot','持倉快照','持仓快照')} {history!.valuationAsOf} · {copy('Fixed holdings; no cash flows, dividends or FX. Price adjustment unverified.','固定持倉；不含資金流、派息及匯率變化，價格調整未核實。','固定持仓；不含资金流、派息及汇率变化，价格调整未核实。')}</p>}
  </>}
  {points.length<2&&<div className="wealth-line-empty" role="status">{error?copy('Historical prices unavailable.','暫時未能取得歷史價格。','暂时无法取得历史价格。'):history?copy('No usable historical prices for this scope.','此範圍未有可用歷史價格。','此范围暂无可用历史价格。'):copy('Loading held-asset history…','載入持倉歷史價格…','载入持仓历史价格…')}{error&&<button type="button" onClick={()=>setRetry(n=>n+1)}>{copy('Retry','重試','重试')}</button>}</div>}
 </section>;
}
