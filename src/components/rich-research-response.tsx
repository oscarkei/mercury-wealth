"use client";
// mercury-localized
import {localize,useAppPreferences,locale} from "../lib/app-preferences";
import CompanyEvidenceCard,{EvidenceCitation} from './company-evidence';
import ResearchAnalysisCard from './research-analysis';
import {researchResultId,comparisonRows,type RichResponse} from '../lib/rich-response';
import type {ResearchAnalysis,ResearchPlan} from '../lib/research-contract';
import styles from './rich-research-response.module.css';
export default function RichResearchResponse({response,analysis,disabled,onAsk}:{response:RichResponse;analysis:ResearchAnalysis;disabled:boolean;onAsk:(message:string,plan:ResearchPlan)=>void}){
 useAppPreferences();

 return <div className={styles.root} data-rich-schema={response.version}>{localize(response.blocks.map((block,i)=>{
  if('dataRef' in block&&block.dataRef!==researchResultId(analysis))return <p key={i}>{localize('Result reference mismatch. Refresh the analysis.')}</p>;
  switch(block.type){
   case 'company_evidence':return analysis.companyEvidence?<details key={i} className={styles.section}><summary>{localize("Company evidence and financial details")}</summary><CompanyEvidenceCard evidence={analysis.companyEvidence}/></details>:null;
   case 'cited_narrative':return <section key={i} className={styles.section} data-response-narrative data-cited-narrative><small>{localize(block.kind==='inference'?'POSSIBLE EXPLANATION':block.kind.toUpperCase())}</small><h4>{block.heading}</h4><p>{block.text}</p><details><summary>{localize("Sources")}</summary>{localize(block.evidenceIds.map(id=>{const item=analysis.companyEvidence?.items.find(e=>e.id===id);return item?<p key={id}><EvidenceCitation item={item}/></p>:null;}))}</details></section>;
   case 'research_panel':return <ResearchAnalysisCard key={i} analysis={analysis} disabled={disabled} onAsk={onAsk}/>;
   case 'comparison_table':return <details key={i} className={styles.section} aria-label={localize("Comparison evidence")}><summary>{localize("Exact comparison figures")}</summary><div className={styles.scroll}><table><thead><tr><th>{localize("Asset")}</th><th>{localize("Start close")}</th><th>{localize("End close")}</th><th>{localize("Change")}</th></tr></thead><tbody>{localize(comparisonRows(analysis).map(row=><tr key={row.symbol}><th>{localize(row.symbol)}</th><td>${localize(row.firstClose.toFixed(2))}</td><td>${localize(row.lastClose.toFixed(2))}</td><td>{localize(row.priceChangePct>=0?'+':'')}{localize(row.priceChangePct.toFixed(2))}%</td></tr>))}</tbody></table></div><p>{localize("USD · Shared observation dates from the chart · Price change, not total return.")}</p></details>;
   case 'narrative':return <section key={i} className={styles.section} data-response-narrative><h4>{block.heading}</h4><p>{block.text}</p></section>;
   case 'sources':return <details key={i} className={styles.section}><summary>{localize("Evidence & freshness")}</summary><p>{localize(block.reused?'Reusing the previous analysis snapshot. No new market fetch.':'Source observations used in this response.')}</p>{localize(analysis.data.histories.map(h=><p key={h.symbol}><strong>{localize(h.symbol)}</strong> · {localize(h.first_date||'Unavailable')} → {localize(h.last_date||'Unavailable')} · {localize(h.observations)}{localize("observations")}<br/>{localize("Retrieved")}{localize(h.retrieved_at)} {localize(h.stale?' · STALE':'')}<br/><a href={'https://www.cboe.com/delayed_quotes/'+encodeURIComponent(h.symbol)+'/quote_table'} target="_blank" rel="noreferrer">{localize("Cboe quote page")}</a>{localize("· via OpenBB")}<br/><small>{localize("Snapshot")}{localize(h.snapshot_id?.slice(0,16)||'unavailable')}</small></p>))}<p>{localize("Links open the provider quote pages; historical observations above come from the recorded OpenBB / Cboe tool snapshot. Adjustments and dividends are unverified.")}</p></details>;
  }
 }))}</div>;
}
