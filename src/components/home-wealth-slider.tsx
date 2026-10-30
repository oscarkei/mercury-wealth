'use client';

import {useEffect, useRef, useState} from 'react';
import {copy, localize, useAppPreferences} from '../lib/app-preferences';
import {scopedHoldings, type FamilyHolding, type FamilyScope} from '../lib/family-portfolio';
import WealthSummaryCard from './wealth-summary-card';

type Props = {
  rows: FamilyHolding[];
  scope: FamilyScope;
  setScope: (scope: FamilyScope) => void;
  currency: string;
  money: (value: number, compact?: boolean) => string;
  onPortfolio: () => void;
  onCash: () => void;
};

export default function HomeWealthSlider({rows, scope, setScope, currency, money, onPortfolio, onCash}: Props) {
  useAppPreferences();
  const track = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [chartPeriod,setChartPeriod]=useState('1Y');
  const [chartRanges,setChartRanges]=useState<Record<string,number>>({});
  const slides = [
    {id:'total', title:localize('Total wealth'), scope:{bank:'all', book:'all'}},
    ...[...new Set(rows.map(row => row.bank))].map(bank => ({id:bank, title:bank, scope:{bank, book:'all'}})),
  ];
  // Keep an explicitly selected book when returning from Portfolio.
  if (scope.book !== 'all') {
    const held = scopedHoldings(rows, scope);
    if (held.length) slides.push({id:scope.book, title:held[0].book, scope});
  }
  const index = Math.max(0, slides.findIndex(slide => slide.scope.bank === scope.bank && slide.scope.book === scope.book));
  const chartBound=Math.max(10,...slides.map(slide=>chartRanges[slide.id+':'+chartPeriod]||10));

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const align = () => { el.scrollLeft = index * (el.clientWidth + (parseFloat(getComputedStyle(el).columnGap) || 0)); };
    align();
    const observer = new ResizeObserver(align);
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return <section className="home-wealth-slider" aria-label={copy('Wealth by custodian', '按託管銀行查看財富', '按托管银行查看财富')}>
    <div className="home-wealth-viewport" ref={track} onScroll={() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const el = track.current;
        if (!el?.clientWidth) return;
        const next = Math.max(0, Math.min(slides.length - 1, Math.round(el.scrollLeft / (el.clientWidth + (parseFloat(getComputedStyle(el).columnGap) || 0)))));
        if (next !== index) setScope(slides[next].scope);
      }, 120);
    }}>
      {slides.map((slide, i) => <div className="home-wealth-slide" key={slide.id} inert={i !== index} aria-hidden={i !== index}>
        <WealthSummaryCard home title={slide.title} chartScope={slide.scope} chartSync={{period:chartPeriod,bound:chartBound,onPeriod:setChartPeriod,onRange:(period,bound)=>setChartRanges(old=>old[slide.id+':'+period]===bound?old:{...old,[slide.id+':'+period]:bound})}} rows={scopedHoldings(rows, slide.scope)} currency={currency} money={money} onOpen={onPortfolio} onCash={onCash}/>
      </div>)}
    </div>
    <nav className="wealth-slide-dots" aria-label={copy('Wealth cards', '財富卡片', '财富卡片')}>
      {slides.map((slide, i) => <button key={slide.id} aria-label={slide.title} aria-pressed={i === index} onClick={() => setScope(slide.scope)}><span/></button>)}
    </nav>
  </section>;
}
