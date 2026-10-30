'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {createChart,AreaSeries,LineSeries,ColorType,type Time} from 'lightweight-charts';
import {copy,localize,locale,useAppPreferences} from '../lib/app-preferences';
import {illustrativeWealthHistory,historyWindow} from '../lib/wealth-history';
import type {FamilyScope} from '../lib/family-portfolio';
export default function WealthHistory({scope,money,illustrate=false}:{scope:FamilyScope;money:(n:number,compact?:boolean)=>string;illustrate?:boolean}){
 const prefs=useAppPreferences(),[demo,setDemo]=useState(illustrate),[mode,setMode]=useState<'value'|'growth'|'contributions'>('value'),[period,setPeriod]=useState('All'),[compare,setCompare]=useState(false),[reference,setReference]=useState(''),[inspect,setInspect]=useState(''),[themeVersion,setThemeVersion]=useState(0);const el=useRef<HTMLDivElement>(null);
 useEffect(()=>{const observer=new MutationObserver(()=>setThemeVersion(n=>n+1));observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});return()=>observer.disconnect();},[]);
 const all=useMemo(()=>illustrativeWealthHistory(scope),[scope.bank,scope.book]),points=useMemo(()=>historyWindow(all,period),[all,period]);
 useEffect(()=>{setReference('');setInspect('');},[scope.bank,scope.book,period]);
 useEffect(()=>{if(!demo||!el.current||!points.length)return;const styles=getComputedStyle(document.documentElement),color=(name:string)=>styles.getPropertyValue(name).trim();const chart=createChart(el.current,{autoSize:true,height:280,layout:{background:{type:ColorType.Solid,color:color('--surface')||'#fff'},textColor:color('--muted-foreground')||'#69776c',fontFamily:'inherit',attributionLogo:true},localization:{locale:locale(),priceFormatter:(v:number)=>mode==='growth'?v.toFixed(2):money(v,true)},grid:{vertLines:{visible:false},horzLines:{color:color('--line')||'#dfe6de'}},timeScale:{borderVisible:false},rightPriceScale:{borderVisible:false},handleScroll:{vertTouchDrag:false},handleScale:{mouseWheel:false,pinch:true}});
 const series=chart.addSeries(AreaSeries,{lineColor:color('--chart-primary')||'#225a4c',topColor:color('--chart-area')||'#225a4c22',bottomColor:'#00000000',lineWidth:2});series.setData(points.map(p=>({time:p.date as Time,value:p[mode]})));
 if(compare&&mode==='value'){const line=chart.addSeries(LineSeries,{color:color('--chart-comparison')||'#a9b9ce',lineWidth:2,lineStyle:2});line.setData(points.map(p=>({time:p.date as Time,value:p.contributions})));}
 if(reference){const ref=points.find(p=>p.date===reference);if(ref)series.createPriceLine({price:ref[mode],color:color('--chart-comparison')||'#a9b9ce',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:reference});}
 chart.subscribeCrosshairMove(p=>{if(typeof p.time==='string')setInspect(p.time);});chart.subscribeClick(p=>{if(typeof p.time==='string')setInspect(p.time);});chart.timeScale().fitContent();return()=>chart.remove();},[demo,points,mode,compare,reference,prefs.theme,prefs.language,money,themeVersion]);
 const current=points.find(p=>p.date===inspect)||points.at(-1),ref=points.find(p=>p.date===reference)||points[0],change=current&&ref?mode==='growth'?(current.growth/ref.growth-1)*100:current[mode]-ref[mode]:0;
 return <section className={'wealth-history card'+(demo?' chart-focused':'')} aria-label={copy('Wealth over time','財富走勢','财富走势')}>
 {!demo&&<><h2>{copy('Wealth over time','財富走勢','财富走势')}</h2><p>{copy('Complete account history is not available yet.','完整戶口歷史資料尚未齊備。','完整账户历史数据尚未齐备。')}</p><button onClick={()=>setDemo(true)}>{copy('Explore an illustrative history','查看獨立示範歷史','查看独立演示历史')}</button></>}
 {demo&&<>
  <div className="history-chart-header">
   <select className="history-metric-select" aria-label={copy('Wealth chart view','財富圖表模式','财富图表模式')} value={mode} onChange={e=>setMode(e.target.value as typeof mode)}>
    {(['value','growth','contributions'] as const).map(m=><option key={m} value={m}>{m==='value'?copy('Market value','市值','市值'):m==='growth'?copy('Investment growth','投資增長','投资增长'):copy('Net contributions','淨投入','净投入')}</option>)}
   </select>
   {current&&<span className="history-date">{new Date(current.date+'T00:00:00Z').toLocaleDateString(locale(),{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}</span>}
  </div>
  {current&&<div className="history-inspection" aria-live="polite">
   <strong>{mode==='growth'?current.growth.toFixed(2):money(current[mode],true)}{mode==='growth'&&<small className="history-index-unit">{copy('index','指數','指数')}</small>}</strong>
   <small>{change>=0?'+':''}{mode==='growth'?change.toFixed(2)+'%':money(change,true)} · {reference?copy('from reference date','相對參考日期','相对参考日期'):copy('from period start','相對期間起點','相对期间起点')}</small>
  </div>}
  <div className="history-plot" ref={el} tabIndex={0} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const at=points.findIndex(p=>p.date===current?.date);setInspect(points[Math.max(0,Math.min(points.length-1,at+(e.key==='ArrowLeft'?-1:1)))]?.date||'');}} role="img" aria-label={copy('Illustrative wealth history. Long press a date to inspect.','示範財富走勢，長按日期查看數值。','演示财富走势，长按日期查看数值。')}/>
  <div className="period-options">{['1M','3M','6M','YTD','1Y','All'].map(p=><button key={p} aria-pressed={period===p} onClick={()=>setPeriod(p)}>{localize(p)}</button>)}</div>
  <p className="history-demo-caption">{copy('Illustrative data · not your portfolio performance','示範資料 · 非實際組合表現','演示数据 · 非实际组合表现')}</p>
  <details className="history-comparison"><summary>{copy('Compare','比較','比较')}</summary><p>{copy('Choose a baseline for the displayed change and a horizontal reference line. This does not change the period or recalculate your holdings.','選擇差額比較的基準日，並在圖上顯示水平參考線；不會改變期間或重算持倉。','选择差额比较的基准日，并在图上显示水平参考线；不会改变期间或重算持仓。')}</p>
   <label>{copy('Reference date','參考日期','参考日期')}<select value={reference} onChange={e=>setReference(e.target.value)}><option value="">{copy('Period start (default)','期間起點（預設）','期间起点（默认）')}</option>{points.map(p=><option key={p.date} value={p.date}>{p.date}</option>)}</select></label>{mode==='value'&&<label><input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/>{copy('Compare net contributions','比較淨投入','比较净投入')}</label>}
  </details>
  <details className="history-method"><summary>{copy('About this chart','關於此圖表','关于此图表')}</summary>
   <p>{mode==='growth'?copy('Growth index · starts at 100, adjusted for external deposits.','增長指數 · 由100起，已調整外部入金。','增长指数 · 从100起，已调整外部入金。'):mode==='value'?copy('Valuation includes deposits and withdrawals; changes are not investment returns.','市值包含入金及出金影響；變化不等同投資回報。','市值包含入金和出金影响；变化不等于投资回报。'):copy('Cumulative deposits less withdrawals in the illustrative dataset.','示範資料內的累計入金減出金。','演示数据中的累计入金减出金。')}</p>
   <p>{copy('Mercury independent teaching fixture v1, 2024-06-19 to 2026-06-19. Monthly valuations and quarter-end deposits, separate from current holdings. Growth starts at 100 and chains monthly returns after subtracting external deposits. Values are in USD before display conversion. No fees, taxes or FX returns are modelled.','Mercury 獨立教學資料 v1，2024-06-19 至 2026-06-19。採用每月估值及季末入金，與目前持倉分開。增長指數由100開始，扣除外部入金後連乘每月回報。數值以美元計算再作顯示換算，未模擬費用、稅項或匯率回報。','Mercury 独立教学数据 v1，2024-06-19 至 2026-06-19。采用每月估值及季末入金，与当前持仓分开。增长指数从100开始，扣除外部入金后连乘每月回报。数值以美元计算再作显示换算，未模拟费用、税项或汇率回报。')}</p>
   {!illustrate&&<button onClick={()=>setDemo(false)}>{copy('Return to portfolio data','返回組合資料','返回组合数据')}</button>}
  </details>
 </>}
 </section>;
}
