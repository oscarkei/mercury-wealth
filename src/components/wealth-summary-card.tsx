'use client';

import PortfolioValueChart, {type ChartSync} from './portfolio-value-chart';
import {ArrowRight, ArrowUpRight, Landmark, Wallet} from 'lucide-react';
import {copy, localize, useAppPreferences} from '../lib/app-preferences';
import {summarize, type FamilyHolding} from '../lib/family-portfolio';

type Props = {
  rows: FamilyHolding[];
  currency: string;
  money: (value: number, compact?: boolean) => string;
  onOpen: () => void;
  onCash: () => void;
  home?: boolean;
  title?: string;
  chartScope?: {bank:string;book:string};
  chartSync?: ChartSync;
};

/** Shared card presentation; every amount comes from the current scoped holdings. */
export default function WealthSummaryCard({rows, currency, money, onOpen, onCash, home = false, title,chartScope,chartSync}: Props) {
  useAppPreferences();
  const totals = summarize(rows);
  const pnl = totals.value - totals.cost;
  const cash = rows.filter(row => row.category === 'cash');
  const sign = pnl >= 0 ? '+' : '';

  return <section className="wealth-summary-card" aria-label={title ?? (home ? localize('Total wealth') : localize('Portfolio overview'))}>
    <div className="wealth-card-heading">
      <span><Landmark size={17} aria-hidden="true"/>{title ?? (home ? localize('Total wealth') : localize('Market value'))}</span>
      <button className="wealth-card-open" onClick={onOpen} aria-label={home ? copy('View portfolio', '查看組合', '查看组合') : localize('View all holdings')}>
        <ArrowUpRight size={21} aria-hidden="true"/>
      </button>
    </div>
    <div className="wealth-card-value">
      <small>{localize('Market value')} · {rows.length} {copy('positions', '項持倉', '项持仓')}</small>
      <div><h2>{money(totals.value)}</h2><span>{currency}</span></div>
    </div>
    {home&&<div className="wealth-card-pnl"><span>{copy('Unrealised P&L','未實現盈虧','未实现盈亏')}</span><strong>{sign}{money(pnl,true)} <small>{totals.cost>0?sign+(pnl/totals.cost*100).toFixed(2)+'%':'—'}</small></strong></div>}
    {home ? <PortfolioValueChart rows={rows} money={money} compact explicitScope={chartScope} sync={chartSync}/> : <div className="wealth-card-metrics"><div><small>{localize('Book cost')}</small><strong>{money(totals.cost,true)}</strong></div><div><small>{copy('Unrealised P&L','未實現盈虧','未实现盈亏')}</small><strong>{sign}{money(pnl,true)}</strong></div></div>}
    {cash.length > 0 && <button className="wealth-card-cash" onClick={onCash}>
      <Wallet size={20} aria-hidden="true"/>
      <span><span>{localize('Cash balance')}</span>{!home&&<small>{copy('Included in market value', '已計入總市值', '已计入总市值')}</small>}</span>
      <strong>{money(summarize(cash).value, true)}</strong><ArrowRight size={17} aria-hidden="true"/>
    </button>}
  </section>;
}
