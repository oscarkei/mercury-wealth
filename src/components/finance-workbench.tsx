"use client";
// mercury-localized
import {localize,useAppPreferences,locale} from "../lib/app-preferences";
import {useEffect,useRef,useState} from 'react';
import styles from './finance-workbench.module.css';
type Period={start:string;end:string;opening_value:string;closing_value:string;external_flow_start:string;external_flow_end:string};
type Result={engine:string;method:string;currency:string;data_mode:string;fee_basis:string;source_reference:string;twr:string;twr_percent:string;nav_change_percent:string|null;net_external_flow:string;period_count:number;series:{date:string;index:string;cumulative_twr:string}[];periods:(Period&{return_percent:string;cumulative_twr:string})[];warnings:string[];input_sha256:string};
const example:Period[]=[
 {start:'2026-01-01',end:'2026-02-01',opening_value:'100000',closing_value:'210000',external_flow_start:'0',external_flow_end:'100000'},
 {start:'2026-02-01',end:'2026-03-01',opening_value:'210000',closing_value:'189000',external_flow_start:'0',external_flow_end:'0'},
 {start:'2026-03-01',end:'2026-04-01',opening_value:'189000',closing_value:'207900',external_flow_start:'0',external_flow_end:'0'}
];
const labels:{key:keyof Period;label:string;kind:string}[]=[{key:'start',label:'Start',kind:'date'},{key:'end',label:'End',kind:'date'},{key:'opening_value',label:'Opening NAV',kind:'text'},{key:'closing_value',label:'Closing NAV',kind:'text'},{key:'external_flow_start',label:'Flow at start',kind:'text'},{key:'external_flow_end',label:'Flow at end',kind:'text'}];
const pct=(value:string|null)=>value===null?'—':Number(value).toLocaleString(locale(),{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
export default function FinanceWorkbench(){
 useAppPreferences();

 const [periods,setPeriods]=useState<Period[]>(example.map(p=>({...p}))),[currency,setCurrency]=useState('USD');
 const [coverage,setCoverage]=useState({valuations_complete:true,external_flows_complete:true,flows_at_boundaries_only:true});
 const [result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const abort=useRef<AbortController|null>(null);
 useEffect(()=>()=>abort.current?.abort(),[]);
 function clear(){setResult(null);setError('');}
 function edit(index:number,key:keyof Period,value:string){clear();setPeriods(rows=>rows.map((row,i)=>i===index?{...row,[key]:value}:row));}
 async function calculate(){
  clear();setBusy(true);const controller=new AbortController();abort.current=controller;
  try{
   const headers={'Content-Type':'application/json','x-mercury-client':'portal'};
   const session=await fetch('/api/session',{method:'POST',headers,signal:controller.signal});if(!session.ok)throw Error('Open this workbench from the local Mercury server.');
   const response=await fetch('/api/finance/twr',{method:'POST',headers,signal:controller.signal,body:JSON.stringify({currency,data_mode:'illustrative',fee_basis:'unspecified',source_reference:'Interactive TWR workbench input',coverage,periods})});
   const data=await response.json();if(!response.ok)throw Error(data.issues?.length?data.issues.map((i:{message:string})=>i.message).join(' '):data.error||'Calculation failed.');
   setResult(data as Result);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Calculation unavailable.');}
  finally{setBusy(false);abort.current=null;}
 }
 function download(){if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Mercury TWR Result.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function chart(){
  if(!result)return null;const values=result.series.map(p=>Number(p.index)),lo=Math.min(100,...values),hi=Math.max(100,...values),span=Math.max(hi-lo,1),x=(i:number)=>50+i*500/Math.max(values.length-1,1),y=(v:number)=>155-(v-lo)/span*105;
  return <svg viewBox="0 0 610 220" role="img" aria-label={localize("Cash-flow-adjusted TWR index, starting at 100")}><line x1="50" x2="550" y1={y(100)} y2={y(100)} stroke="#b5c9bf" strokeDasharray="4 4"/><text x="4" y={y(100)+4}>100</text><path d={values.map((v,i)=>`${i?'L':'M'}${x(i)} ${y(v)}`).join(' ')} fill="none" stroke="#225a4c" strokeWidth="3"/>{localize(values.map((v,i)=><g key={i}><circle cx={x(i)} cy={y(v)} r="4" fill="#225a4c"/><text x={x(i)} y={y(v)-12} textAnchor="middle">{localize(v.toFixed(2))}</text><text x={x(i)} y="200" textAnchor="middle">{localize(result.series[i].date.slice(5))}</text></g>))}</svg>;
 }
 return <main className={styles.root}><div className={styles.wrap}>
  <header className={styles.header}><strong>{localize("MERCURY WEALTH")}<span>{localize("/ FINANCE")}</span></strong><a href="/strategies">{localize("Strategy Lab ↗")}</a><a href="/">{localize("Back to Portal ↗")}</a></header>
  <div className={styles.eyebrow}>{localize("CALCULATION WORKBENCH · ILLUSTRATIVE INPUTS")}</div><h1>{localize("Measure returns.")}<br/>{localize("Account for the cash flows.")}</h1><p className={styles.lead}>{localize("Calculate time-weighted return from supplied NAV and external deposits or withdrawals. The example separates investment performance from new money.")}</p>
  <section className={styles.result} aria-label={localize("TWR result")}>
   {localize(result?<><div className={styles.metrics}><div><span>{localize("Time-weighted return")}</span><strong data-testid="twr-result">{localize(pct(result.twr_percent))}</strong></div><div><span>{localize("NAV change, including flows")}</span><strong>{localize(pct(result.nav_change_percent))}</strong></div><div><span>{localize("Net external flows")}</span><strong>{localize(Number(result.net_external_flow).toLocaleString(locale()))} <small>{localize(currency)}</small></strong></div></div>{localize(chart())}<p className={styles.note}>{localize("The chart starts at 100 and links returns after adjusting for boundary cash flows. It is not the account balance.")}</p><button className={styles.secondary} onClick={download}>{localize("Download result ↓")}</button></>:<p>{localize("Run the example to compare TWR with the change in account value.")}</p>)}
  </section>
  <section className={styles.card}><div className={styles.heading}><h2>{localize("Valuations & external flows")}</h2><label>{localize("Reporting currency")}<select aria-label={localize("Reporting currency")} disabled={busy} value={currency} onChange={e=>{setCurrency(e.target.value);clear();}}>{localize(['USD','HKD','SGD','GBP','EUR'].map(c=><option key={c}>{localize(c)}</option>))}</select></label></div>
   <p>{localize("Use one reporting currency. Deposits are positive; withdrawals are negative. Opening NAV is measured before the start flow, and closing NAV after the end flow.")}</p>
   <div className={styles.tableWrap}><table><thead><tr><th>{localize("Period")}</th>{localize(labels.map(l=><th key={l.key}>{localize(l.label)}</th>))}</tr></thead><tbody>{localize(periods.map((p,i)=><tr key={i}><td>{localize(i+1)}</td>{localize(labels.map(l=><td key={l.key}><input type={l.kind} inputMode={l.kind==='text'?'decimal':undefined} aria-label={localize(`Period ${i+1} ${l.label}`)} value={p[l.key]} disabled={busy} onChange={e=>edit(i,l.key,e.target.value)}/></td>))}</tr>))}</tbody></table></div>
   <div className={styles.actions}><button className={styles.secondary} disabled={busy||periods.length>=24} onClick={()=>{const p=periods.at(-1)!;clear();setPeriods(rows=>[...rows,{start:p.end,end:'',opening_value:p.closing_value,closing_value:'',external_flow_start:'0',external_flow_end:'0'}]);}}>{localize("Add period")}</button><button className={styles.secondary} disabled={busy||periods.length===1} onClick={()=>{clear();setPeriods(rows=>rows.slice(0,-1));}}>{localize("Remove last")}</button><button className={styles.secondary} disabled={busy} onClick={()=>{setPeriods(example.map(p=>({...p})));setCoverage({valuations_complete:true,external_flows_complete:true,flows_at_boundaries_only:true});clear();}}>{localize("Load example")}</button></div>
   <fieldset disabled={busy} className={styles.coverage}><legend>{localize("Input coverage")}</legend>{localize(([['valuations_complete','I have complete valuations for every period.'],['external_flows_complete','All external deposits and withdrawals are included.'],['flows_at_boundaries_only','Flows occur only at period boundaries; other flows require splitting the period.']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={coverage[key]} onChange={e=>{setCoverage(c=>({...c,[key]:e.target.checked}));clear();}}/>{localize(label)}</label>))}</fieldset>
   <p className={styles.note}>{localize("Trades, dividends and fees are internal to the portfolio: include their effect in NAV. Do not enter them as external cash flows. Inputs are caller-declared; this workbench does not audit source records.")}</p>
   <button className={styles.primary} disabled={busy} onClick={()=>void calculate()}>{localize(busy?'Calculating…':'Calculate TWR')}</button><div role="alert" className={styles.error}>{localize(error)}</div>
  </section>
  {localize(result&&<section className={styles.card}><h2>{localize("Calculation details")}</h2><div className={styles.tableWrap}><table><thead><tr><th>{localize("Period")}</th><th>{localize("Return")}</th><th>{localize("Linked TWR")}</th></tr></thead><tbody>{localize(result.periods.map((p,i)=><tr key={i}><td>{localize(p.start)} → {localize(p.end)}</td><td>{localize(pct(p.return_percent))}</td><td>{localize(pct(String(Number(p.cumulative_twr)*100)))}</td></tr>))}</tbody></table></div><p className={styles.note}>{localize("Each period factor = (closing NAV − end flow) ÷ (opening NAV + start flow). Total TWR = product of those factors − 1. Results are not annualized.")}</p><p className={styles.note}>{localize("Fee basis: unspecified. Use NAV reflecting the chosen fee basis before comparing results. Actual Lim, Okonkwo and Zhang performance is not calculated from the current-holdings snapshot.")}</p><small>{localize(result.engine)} · {localize(result.period_count)}{localize("periods · Illustrative data")}</small></section>)}
 </div></main>;
}
