"use client";
// mercury-localized
import {localize,useAppPreferences,locale} from "../lib/app-preferences";
import {ArrowUpRight,ArrowRight,TrendingUp,Landmark} from 'lucide-react';
/** Editorial suggestions checked 27 Oct 2026; not a popularity ranking or live news feed. */
const topics=[
 {id:'ai',tag:'IN FOCUS',title:'AI stocks: who is leading?',hint:'NVDA · MSFT · GOOGL',source:'UBS CIO · 20 Oct 2026',url:'https://www.ubs.com/global/en/wealthmanagement/insights/chief-investment-office/house-view/daily/2026/latest-20102026.html',question:'Compare NVDA, MSFT and GOOGL over the last 3 months. Show price charts and source dates.',context:'Public market research'},
 {id:'rates',tag:'EXPLAINER',title:'What is next for rates?',hint:'The next Fed meeting',source:'Fed calendar · checked 27 Oct 2026',url:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',question:'What do current Fed rates and market pricing suggest for the next meeting? Show the data and source dates.',context:'Fed analysis'},
] as const;
export default function ChatStarters({onChoose}:{onChoose:(question:string,context:string)=>void}){
 useAppPreferences();

 return <div className="chat-starters" aria-label={localize("Suggested topics")}>{localize(topics.map(topic=><article className={'chat-topic '+topic.id} key={topic.id}>
  <button className="chat-topic-prompt" onClick={()=>onChoose(topic.question,topic.context)} aria-label={localize(topic.title)}>
   <span className="chat-topic-tag">{localize(topic.id==='ai'?<TrendingUp size={15}/>:<Landmark size={15}/>)} {localize(topic.tag)}</span>
   <span className="chat-topic-title">{localize(topic.title)}</span><span className="chat-topic-hint">{localize(topic.hint)}<ArrowRight size={17}/></span>
  </button>
  <a className="chat-topic-source" href={topic.url} target="_blank" rel="noopener noreferrer">{localize(topic.source)}<ArrowUpRight size={12}/></a>
 </article>))}</div>;
}
