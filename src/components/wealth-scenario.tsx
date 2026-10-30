"use client";
// mercury-localized
import {localize,useAppPreferences,locale} from "../lib/app-preferences";
import {LineChart,Line,XAxis,YAxis,Tooltip,ResponsiveContainer,CartesianGrid} from 'recharts';
import type {WealthScenario} from '../lib/wealth-scenario-contract';
const money=(value:number)=>value.toLocaleString(locale(),{style:'currency',currency:'USD',maximumFractionDigits:0});
export default function WealthScenarioCard({scenario:s}:{scenario:WealthScenario}){
 useAppPreferences();

 return <section className="fed-analysis" aria-label={localize("Accumulator scenario")}>
  <small>{localize("PRODUCT SCENARIO")}</small><h3>{localize(s.name)}</h3>
  <p>{localize("Underlying")}{localize(s.shockPct>=0?'+':'')}{localize(s.shockPct)}{localize("% from initial fixing ·")}{localize(s.days)}{localize("trading days at the assumed constant price.")}</p>
  <dl style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div><dt>{localize("Shares accumulated")}</dt><dd>{localize(s.shares.toLocaleString(locale()))}</dd></div><div><dt>{localize("Purchase cost")}</dt><dd>{localize(money(s.cost))}</dd></div><div><dt>{localize("Marked value")}</dt><dd>{localize(money(s.value))}</dd></div><div><dt>{localize("Illustrative difference")}</dt><dd>{localize(money(s.pnl))}</dd></div></dl>
  <div style={{height:200,width:'100%'}} role="img" aria-label={localize("Accumulation cost and marked value over the scenario")}><ResponsiveContainer width="100%" height="100%"><LineChart data={s.path}><CartesianGrid vertical={false}/><XAxis dataKey="day"/><YAxis width={60} tickFormatter={v=>'$'+Math.round(Number(v)/1000)+'k'}/><Tooltip formatter={v=>money(Number(v))}/><Line dataKey="cost" name="Purchase cost" stroke="#8c82b3" dot={false}/><Line dataKey="value" name="Marked value" stroke="#174f4d" dot={false}/></LineChart></ResponsiveContainer></div>
  <p>{localize("This is an illustrative accumulation scenario, not a current sale price or a full contract projection.")}</p>
  <details><summary>{localize("Assumptions and source")}</summary>{localize(s.assumptions.map(a=><p key={a}>{localize(a)}</p>))}<p>{localize("Portfolio snapshot:")}{localize(s.asOf)}{localize(". Product:")}{localize(s.instrumentId)}.</p></details>
 </section>;
}
