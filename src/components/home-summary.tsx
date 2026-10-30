"use client";
import {copy,localize,useAppPreferences} from '../lib/app-preferences';
import {scopedHoldings,summarize,type FamilyHolding,type FamilyScope} from '../lib/family-portfolio';
import HomeWealthSlider from './home-wealth-slider';
import {ArrowRight} from 'lucide-react';
import HomeResearchCards from './home-research';
type Props={rows:FamilyHolding[];scope:FamilyScope;setScope:(s:FamilyScope)=>void;currency:string;money:(n:number,compact?:boolean)=>string;onPortfolio:()=>void;onReview:(category:string,search?:string)=>void;onProducts:()=>void;onDiscuss:(context:string,question:string)=>void};
export default function HomeSummary({rows,scope,setScope,currency,money,onPortfolio,onReview,onProducts,onDiscuss}:Props){
 useAppPreferences();const selected=scopedHoldings(rows,scope),books=[...new Set(selected.map(h=>h.bookId))];
 if(!selected.length)return <section className="empty card"><h2>{copy('No holdings in this scope','此範圍未有持倉','此范围暂无持仓')}</h2><button onClick={()=>setScope({bank:'all',book:'all'})}>{localize('All books')}</button></section>;
 return <div className="client-home"><HomeWealthSlider rows={rows} scope={scope} setScope={setScope} currency={currency} money={money} onPortfolio={onPortfolio} onCash={()=>onReview('cash')}/>
 <HomeResearchCards/>
 <section className="home-actions"><h2>{copy('Insights & actions','洞察及待辦','洞察及待办')}</h2><article><h3>{copy('Understand your concentration','了解集中風險','了解集中风险')}</h3><p>{copy('Review the largest positions in your selected accounts.','檢視所選戶口最大持倉。','查看所选账户最大持仓。')}</p><div className="insight-cta-group"><button className="insight-cta" onClick={()=>onReview('all')}><span>{localize('Review holdings')}</span><ArrowRight size={17} aria-hidden="true"/></button><button className="insight-cta-secondary" onClick={()=>onDiscuss('allocation',copy('Explain concentration in my selected portfolio.','分析所選組合的集中風險。','分析所选组合的集中风险。'))}>{localize('Discuss')}</button></div></article>{selected.some(h=>h.category==='note')&&<article><h3>{copy('Held structured products','持有結構產品','持有结构产品')}</h3><p>{copy('Check terms, valuation dates and product scenarios.','查看條款、估值日期及產品情境。','查看条款、估值日期及产品情景。')}</p><button className="insight-cta" onClick={onProducts}><span>{copy('View held products','查看持有產品','查看持有产品')}</span><ArrowRight size={17} aria-hidden="true"/></button></article>}</section>
 </div>;
}
