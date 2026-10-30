import {activeResults} from './conversation-policy.mjs';
import {financeCall} from './finance-client.mjs';
import {extendedSchemas} from './extended-catalog.mjs';
import {addFact,seriesFacts,sourceFacts} from './numeric-evidence.mjs';
const cache=new Map();let secQueue=Promise.resolve();
const num=(n,d=2)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
export function addSource(run,s){const prior=run.sources.find(x=>x.url===s.url);if(prior){Object.assign(prior,s,{active_turn:run.id});return prior;}const result={...s,id:'S'+(run.sources.length+1),retrieved_at:new Date().toISOString()};run.sources.push(result);return result;}
function result(run,r){const out={...r,id:'R'+(run.results.length+1)};run.results.push(out);return out;}
function fact(run,r,key,display,extra={}){return addFact(run,{key:r.id+':'+key,kind:'computed',result_id:r.id,source_id:r.source_id,display:display+' ['+r.id+']',...extra});}
function history(run,id){const r=activeResults(run).find(r=>r.id===id);if(r?.kind!=='market_bundle')throw Error('Use an existing market_history result from this conversation.');return r;}
async function publicData(url,{signal,fetcher=fetch,format='json',ttl=21600000,sec=false}={}){
 const key=url,old=cache.get(key);if(old&&Date.now()-old.at<ttl)return structuredClone(old.value);
 const get=async()=>{
  const controller=AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(35000)]);
  let response=await fetcher(url,{signal:controller,redirect:'manual',headers:{'User-Agent':process.env.SEC_USER_AGENT||'MercuryWealthPrototype/0.4 (local public financial research)','Accept':format==='json'?'application/json':'text/csv'}});
  // EIA storage uses a signed download on the same official host; no arbitrary redirects.
  if(response.status>=300&&response.status<400&&new URL(url).hostname==='ir.eia.gov'){
   const next=new URL(response.headers.get('location'),url);if(next.protocol!=='https:'||next.hostname!=='ir.eia.gov')throw Error('Unexpected EIA redirect.');
   response=await fetcher(next,{signal:controller,redirect:'error'});
  }
  if(!response.ok)throw Error(new URL(url).hostname+' HTTP '+response.status+'; no replacement data.');
  const raw=await response.text();if(raw.length>12000000)throw Error('Source exceeds supported size.');const value=format==='json'?JSON.parse(raw):raw;cache.set(key,{at:Date.now(),value});return structuredClone(value);
 };
 if(sec){const job=secQueue.then(async()=>{await new Promise(r=>setTimeout(r,1100));return get();});secQueue=job.catch(()=>{});return job;}return get();
}
export function parseBls(data,id,start,end,asof){
 if(data.status!=='REQUEST_SUCCEEDED')throw Error('BLS: '+(data.message||[]).join('; '));const series=data.Results?.series?.find(s=>s.seriesID===id);if(!series)throw Error('BLS series missing.');
 const points=series.data.filter(r=>/^M(0[1-9]|1[0-2])$/.test(r.period)&&Number(r.year)>=start&&Number(r.year)<=end).map(r=>({date:r.year+'-'+r.period.slice(1)+'-01',value:Number(r.value),footnotes:r.footnotes})).filter(r=>Number.isFinite(r.value)&&r.date<=asof).sort((a,b)=>a.date.localeCompare(b.date));if(!points.length)throw Error('No BLS observations.');return points;
}
function csvLine(line){return (line.match(/(?:"(?:[^"]|"")*"|[^,]*)(?:,|$)/g)||[]).map(x=>x.replace(/,$/,'').replace(/^"|"$/g,'').replaceAll('""','"'));}
export function parseStorage(csv,asof){
 const released=csv.match(/Released: ([A-Za-z]+ \d{1,2}, \d{4})/),week=csv.match(/Week Ending ([A-Za-z]+ \d{1,2}, \d{4})/),row=csv.split(/\r?\n/).find(l=>l.startsWith('Total,'));
 if(!released||!week||!row||!csv.includes('Stocks in billion (Bcf)'))throw Error('EIA storage schema changed; review required.');
 const release_date=new Date(released[1]+' UTC').toISOString().slice(0,10),period_end=new Date(week[1]+' UTC').toISOString().slice(0,10),cells=csvLine(row);const value=i=>Number(cells[i].replaceAll(',',''));
 const out={release_date,period_end,stock_bcf:value(1),previous_stock_bcf:value(4),change_bcf:value(7),year_ago_bcf:value(13),five_year_average_bcf:value(19),data_status:'historical_reported_estimate',unit:'Bcf',quantity_role:'stock',source:'EIA weekly survey estimate, subject to revision'};
 if(release_date>asof||period_end>asof||Object.entries(out).some(([k,v])=>k.endsWith('_bcf')&&!Number.isFinite(v)))throw Error('Invalid/future EIA observations.');if(Math.abs(out.stock_bcf-out.previous_stock_bcf-out.change_bcf)>2)throw Error('EIA weekly stock/change do not reconcile.');return out;
}
export function selectSecFacts(data,metric,period,asof){
 const concept=data.facts?.['us-gaap']?.[metric],values=concept?.units?.USD;if(!values)return [];
 const rows=values.filter(r=>r.filed<=asof&&r.end<=asof&&['10-K','10-K/A','10-Q','10-Q/A'].includes(r.form)&&Number.isFinite(r.val)).filter(r=>{const days=r.start?(Date.parse(r.end)-Date.parse(r.start))/86400000:null;return period==='instant'?days===null:period==='annual'?days>=330&&days<=380:days>=70&&days<=110;});
 const selected=new Map();for(const r of rows.sort((a,b)=>a.filed.localeCompare(b.filed)||a.accn.localeCompare(b.accn)))selected.set((r.start||'')+':'+r.end,r);
 return [...selected.values()].sort((a,b)=>b.end.localeCompare(a.end)).slice(0,4).map(r=>({value:r.val,unit:'USD',start:r.start||null,end:r.end,filed:r.filed,form:r.form,accession:r.accn,frame:r.frame||null,period_kind:period}));
}
function addSeries(run,points,meta,source){if(!points.length)throw Error('No supported observations.');const r=result(run,{...meta,source_id:source.id,points,first:points[0],last:points.at(-1),observations:points.length,change_absolute:points.at(-1).value-points[0].value,change_pct:points[0].value?(points.at(-1).value/points[0].value-1)*100:null});return {result:r,numeric_facts:seriesFacts(run,r)};}
const stripHtml=s=>s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&mdash;|&#8212;/g,'—').replace(/&ndash;|&#8211;/g,'–').replace(/\s+/g,' ').trim();
export function parseOutlook(html,asof){
 const release=html.match(/Release Date:<\/strong>\s*([A-Za-z]+ \d{1,2}, \d{4})/),vintage=html.match(/Forecast Completed:<\/strong>\s*([A-Za-z]+ \d{1,2}, \d{4})/),table=html.match(/<table class="steoPriceSummary[^"]*">([\s\S]*?)<\/table>/),main=html.match(/<div class="main_col">([\s\S]*?)<\/div>/);
 if(!release||!vintage||!table||!main)throw Error('EIA STEO schema changed; cannot classify forecast columns.');
 const release_date=new Date(release[1]+' UTC').toISOString().slice(0,10),forecast_vintage=new Date(vintage[1]+' UTC').toISOString().slice(0,10);if(release_date>asof||forecast_vintage>asof)throw Error('Future EIA release excluded.');
 const years=[...table[1].matchAll(/<th>(\d{4})([\s\S]*?)<\/th>/g)].map(m=>({year:Number(m[1]),forecast:/projected/i.test(m[2])}));if(years.length<2||years.length>5)throw Error('Invalid EIA outlook year headers.');
 const rows=[];for(const tr of table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)){
  const cells=[...tr[1].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];if(cells.length!==years.length+1)continue;
  const label=stripHtml(cells[0][2]),unit=label.includes('billion cubic feet per day')?'Bcf/d':label.includes('dollars per million Btu')?'USD/MMBtu':label.includes('percentage')?'%':null;if(!unit)throw Error('Unknown EIA outlook unit.');
  for(let i=0;i<years.length;i++){const value=Number(stripHtml(cells[i+1][2])),forecast=/Forecast/i.test(cells[i+1][1]);if(!Number.isFinite(value)||forecast!==years[i].forecast)throw Error('EIA outlook cell/header classification mismatch.');rows.push({measure:label.replace(/\s*\([^)]*\)\s*$/,''),year:years[i].year,value,unit,data_status:forecast?'forecast':'historical_baseline',forecast_vintage,release_date});}
 }
 if(!rows.some(r=>/dry natural gas production/.test(r.measure))||!rows.some(r=>/LNG exports/.test(r.measure)))throw Error('Required EIA outlook measures missing.');return {release_date,forecast_vintage,rows,content:stripHtml(main[1]).slice(0,12000),classification_source:'EIA original table Forecast cell classes checked against projected column headers. Historical baselines can still be revised.'};
}
export async function executeExtended(name,raw,run,options={}){
 const args=extendedSchemas[name].parse(raw),opts={signal:options.signal,fetcher:options.fetcher||fetch};
 if(name==='get_eia_outlook'){
  const url='https://www.eia.gov/outlooks/steo/report/natgas.php',html=await publicData(url,{...opts,format:'text',ttl:3600000}),data=parseOutlook(html,run.date);const s=addSource(run,{url,title:'EIA STEO 天然氣展望',publisher:'EIA',coverage:'official_mixed_history_forecast',published_at:data.release_date,content:data.content});const r=result(run,{kind:'outlook',title:'EIA 天然氣 · 歷史與預測',source_id:s.id,data});
  const labels={'U.S. dry natural gas production':'美國乾氣產量','U.S. natural gas consumption':'美國天然氣消費','U.S. LNG exports':'美國 LNG 出口','Natural gas price at Henry Hub':'Henry Hub 年均價格','Natural gas share of electricity generation':'天然氣發電佔比'};
  const numeric_facts=data.rows.map(row=>fact(run,r,row.measure+':'+row.year,`${labels[row.measure]||row.measure} ${row.year} ${row.data_status==='forecast'?'年度預測':'歷史年度基數'}：${num(row.value)} ${row.unit}${row.unit==='Bcf/d'?'＝'+num(row.value*10)+' 億立方英尺／日':''}（STEO 發布 ${data.release_date}；預測版本 ${data.forecast_vintage}）`,{data_status:row.data_status,period:String(row.year),measure:row.measure,value:row.value,unit:row.unit}));
  return {result_id:r.id,...data,numeric_facts:[...numeric_facts,...sourceFacts(run,s,data.content)],note:'Keep historical baselines separate from forecast columns. Do not infer current-month realised volumes from annual forecasts. Do not infer price causality just by comparing production and LNG exports; total demand, weather and inventories also matter.'};
 }
 if(name==='market_history'){
  const data=await financeCall('history',args,opts.signal);const source=addSource(run,{url:'https://www.cboe.com/us/equities/market_statistics/',title:'OpenBB / Cboe daily closes',publisher:'OpenBB / Cboe',coverage:'observed_series',published_at:null});
  const bundle=result(run,{kind:'market_bundle',title:args.symbols.join(' / ')+' · Cboe',source_id:source.id,data});let numeric_facts=[];const charts=[];
  for(const h of data.histories.filter(h=>h.status==='observed')){const out=addSeries(run,h.points.map(p=>({date:p.date,value:p.close})),{title:h.symbol+' 收市價',series_id:'CBOE:'+h.symbol,unit:'USD',frequency:'daily',provider:'OpenBB / Cboe',kind:'observed_price',basis:h.basis,stale:h.stale,parent_id:bundle.id},source);numeric_facts.push(...out.numeric_facts);charts.push(out.result.id);}
  return {history_result_id:bundle.id,chart_result_ids:charts,numeric_facts,histories:data.histories.map(({points,...r})=>r),warnings:data.warnings};
 }
 if(['optimize_allocation','strategy_backtest','financial_metrics'].includes(name)){
  const origin=args.history_result_id?history(run,args.history_result_id):null;let data,kind,title;
  if(name==='optimize_allocation'){const {history_result_id,...params}=args;const requested=origin.data.requested;data=await financeCall('optimize',{...params,start_date:requested.start_date,end_date:requested.end_date,history:origin.data},opts.signal);kind='allocation';title=({min_variance:'最低波動配置',min_cvar:'最低 CVaR 配置',risk_parity:'風險平價配置'})[args.objective];}
  if(name==='financial_metrics'){data=await financeCall('metrics',{history:origin.data},opts.signal);kind='performance';title='歷史回報與風險';}
  if(name==='strategy_backtest'){
   if(args.dataset==='observed_prices'&&!origin)throw Error('Observed backtest requires a market_history result.');if(args.dataset==='explicit_demo'&&origin)throw Error('Do not mix demo and observed data.');
   const {history_result_id,dataset,...params}=args;data=await financeCall('backtest',{...params,...(origin?{history:origin.data}:{})},opts.signal);kind='backtest';title=origin?'再平衡策略 · 歷史價格試算':'再平衡策略 · 示範數據';
  }
  const s=origin?run.sources.find(s=>s.id===origin.source_id):addSource(run,{url:'https://pmorissette.github.io/bt/',title:'bt · local explicitly labelled mock price fixture',publisher:'Local demo / bt + QuantStats',coverage:'model_simulation',published_at:null});
  const r=result(run,{kind,title,source_id:s.id,data,parent_id:origin?.id,classification:origin?'hypothetical_model_on_observed_prices':'explicit_mock_simulation'});const numeric_facts=[];
  if(kind==='allocation'){
   for(const row of data.rows)numeric_facts.push(fact(run,r,row.symbol,`${row.symbol}：等權參考 ${num(row.reference_pct)}% → 模型權重 ${num(row.target_pct)}%；波動風險貢獻 ${num(row.risk_contribution_pct)}%`));
   numeric_facts.push(fact(run,r,'summary',`模型現金 ${num(data.cash_pct)}%；樣本內年化波動 ${num(data.reference_volatility_pct)}% → ${num(data.target_volatility_pct)}%；估算成本 USD ${num(data.estimated_cost)}（${data.first_date} 至 ${data.last_date}）`));
  } else if(kind==='performance')for(const row of data.rows)numeric_facts.push(fact(run,r,row.symbol,`${row.symbol}：價格回報 ${num(row.return_pct)}%；最大回撤 ${num(row.max_drawdown_pct)}%；年化波動 ${num(row.volatility_pct)}%；Sharpe ${row.sharpe===null?'未定義':num(row.sharpe)}（${row.start} 至 ${row.end}，無風險利率零）`));
  else for(const row of data.strategies)numeric_facts.push(fact(run,r,row.id,`${({hold:'持有',periodic:'定期再平衡',band:'偏離再平衡'})[row.id]}：模擬回報 ${num(row.total_return_pct)}%；最大回撤 ${num(row.max_drawdown_pct)}%；成本 USD ${num(row.total_cost)}；期末 USD ${num(row.ending_nav)}（${data.date_range.start} 至 ${data.date_range.end}）`));
  const summary=structuredClone(data);if(summary.strategies)summary.strategies=summary.strategies.map(({series,events,...rest})=>rest);
  return {result_id:r.id,kind,classification:r.classification,calculation:summary,numeric_facts,ui_available:true,note:'Use bound facts for all calculated numbers. Result is a hypothetical model or historical statistic, not a client holding, approved proposal or execution. Volatility risk contributions are NOT CVaR contributions.'};
 }
 if(name==='get_bls_series'){
  if(args.start_year>args.end_year||args.end_year>Number(run.date.slice(0,4))||args.end_year-args.start_year>2)throw Error('BLS supports an ordered window of up to three years, no future years.');
  const url='https://api.bls.gov/publicAPI/v1/timeseries/data/'+args.series_id+'?'+new URLSearchParams({startyear:args.start_year,endyear:args.end_year});const data=await publicData(url,opts),points=parseBls(data,args.series_id,args.start_year,args.end_year,run.date);
  const mapping={CUUR0000SA0:['美國 CPI（未經季調）','Index 1982–1984=100','CPIAUCNS'],CUSR0000SA0:['美國 CPI（經季調）','Index 1982–1984=100','CPIAUCSL'],LNS14000000:['美國失業率（經季調）','%','UNRATE'],CES0000000001:['美國非農就業（經季調）','thousand persons','PAYEMS']};const[title,unit,id]=mapping[args.series_id];const s=addSource(run,{url,title,publisher:'BLS public API v1',coverage:'observed_series',published_at:null,observation_end:points.at(-1).date});
  const out=addSeries(run,points,{title,unit,series_id:id,provider:'BLS direct API v1',frequency:'monthly',data_status:'historical_observation',note:'Period is observation month, not publication date. Preliminary values/revisions may apply.'},s);const {points:ignored,...summary}=out.result;return {...out,result:summary};
 }
 if(name==='get_eia_storage'){
  const url='https://ir.eia.gov/ngs/wngsr.csv',csv=await publicData(url,{...opts,format:'text',ttl:3600000}),data=parseStorage(csv,run.date);const s=addSource(run,{url,title:'EIA 每週天然氣庫存',publisher:'EIA',coverage:'official_weekly_estimate',published_at:data.release_date,observation_end:data.period_end});const r=result(run,{kind:'official_table',title:'天然氣庫存 · 歷史報告',source_id:s.id,data});
  const numeric_facts=[fact(run,r,'stock',`下四十八州天然氣庫存 ${num(data.stock_bcf)} Bcf＝${num(data.stock_bcf*10)} 億立方英尺（週末 ${data.period_end}；發布 ${data.release_date}；歷史調查估計，非預測）`,{data_status:data.data_status,period_end:data.period_end,quantity_role:'stock'}),fact(run,r,'change',`每週庫存變動 ${num(data.change_bcf)} Bcf＝${num(data.change_bcf*10)} 億立方英尺（截至 ${data.period_end}；並非每日流量）`,{quantity_role:'change',data_status:data.data_status}),fact(run,r,'comparison',`庫存較去年同期 ${num(data.stock_bcf-data.year_ago_bcf)} Bcf，較五年同期均值 ${num(data.stock_bcf-data.five_year_average_bcf)} Bcf（截至 ${data.period_end}）`,{quantity_role:'change',data_status:data.data_status})];return {result_id:r.id,data,numeric_facts,note:'Historical weekly survey estimates, not forecasts. Weekly stocks/changes cannot establish a price cause or annual production path alone.'};
 }
 if(name==='get_eia_series'||name==='get_bea_series'){
  const env=name==='get_eia_series'?'EIA_API_KEY':'BEA_API_KEY';if(!process.env[env])return {status:'needs_key',provider:name==='get_eia_series'?'EIA API v2':'BEA API',environment_variable:env,signup:name==='get_eia_series'?'https://www.eia.gov/opendata/register.php':'https://apps.bea.gov/api/signup/',note:'No request sent, no substitute data. Tell the user this capability needs configuration.'};
  let url,points,meta,sourceUrl;
  if(name==='get_eia_series'){
   if(args.start_date>=args.end_date||args.end_date>run.date)throw Error('Use ordered historical dates.');url='https://api.eia.gov/v2/seriesid/'+args.series_id+'?'+new URLSearchParams({api_key:process.env[env],start:args.start_date,end:args.end_date,length:'5000','sort[0][column]':'period','sort[0][direction]':'asc'});
   const raw=await publicData(url,opts);if(raw.error||!raw.response?.data)throw Error('EIA response unavailable.');const items=raw.response.data;const units=[...new Set(items.map(i=>i.unit||i.units))];if(units.length!==1||!units[0])throw Error('EIA unit metadata missing or mixed.');points=items.map(i=>({date:i.period,value:Number(i.value)})).filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&p.date>=args.start_date&&p.date<=args.end_date&&Number.isFinite(p.value)).sort((a,b)=>a.date.localeCompare(b.date));meta={title:args.series_id.includes('RNGWHHD')?'Henry Hub 天然氣現貨':'天然氣庫存',series_id:args.series_id,unit:units[0],provider:'EIA API v2',frequency:args.series_id.endsWith('.W')?'weekly':'daily'};sourceUrl='https://www.eia.gov/opendata/';
  }else{
   if(args.year>Number(run.date.slice(0,4)))throw Error('No future BEA year.');url='https://apps.bea.gov/api/data/?'+new URLSearchParams({UserID:process.env[env],method:'GetData',datasetname:'NIPA',TableName:args.table,Frequency:'Q',Year:String(args.year),ResultFormat:'JSON'});const raw=await publicData(url,opts);const rows=raw.BEAAPI?.Results?.Data;if(!rows)throw Error('BEA data unavailable.');const selected=rows.filter(r=>r.LineNumber==='1');points=selected.map(r=>({date:r.TimePeriod?.replace(/^(\d{4})Q([1-4])$/,(_,y,q)=>y+'-'+String((Number(q)-1)*3+1).padStart(2,'0')+'-01'),value:Number(r.DataValue.replaceAll(',','')),period:r.TimePeriod})).filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&p.date<=run.date&&Number.isFinite(p.value)).sort((a,b)=>a.date.localeCompare(b.date));meta={title:args.table==='T10101'?'實質 GDP 季增長（年化）':'PCE 價格指數',series_id:args.table,unit:args.table==='T10101'?'% annualized quarter-on-quarter':'Index (BEA table base year)',frequency:'quarterly',provider:'BEA NIPA',source_metadata:selected.map(({TimePeriod,UNIT_MULT,METRIC_NAME,CL_UNIT})=>({TimePeriod,UNIT_MULT,METRIC_NAME,CL_UNIT}))};sourceUrl='https://apps.bea.gov/iTable/?reqid=19&step=3&isuri=1&1910=x&0=1';
  }
  const s=addSource(run,{url:sourceUrl,title:meta.title,publisher:meta.provider,coverage:'observed_series',published_at:null});const out=addSeries(run,points,meta,s);const {points:ignored,...summary}=out.result;return {...out,result:summary};
 }
 if(name.startsWith('get_sec_')){
  const cik=args.cik.padStart(10,'0'),isFacts=name==='get_sec_facts',url=isFacts?'https://data.sec.gov/api/xbrl/companyfacts/CIK'+cik+'.json':'https://data.sec.gov/submissions/CIK'+cik+'.json';const data=await publicData(url,{...opts,sec:true});if(String(data.cik).padStart(10,'0')!==cik)throw Error('SEC entity does not match requested CIK.');
  const s=addSource(run,{url,title:(data.entityName||data.name)+' · SEC EDGAR',publisher:'SEC',coverage:'official_filings',published_at:null});
  if(!isFacts){const recent=data.filings?.recent;if(!recent)throw Error('No SEC submission history.');const rows=recent.accessionNumber.map((accession,i)=>({accession,form:recent.form[i],filed:recent.filingDate[i],period:recent.reportDate[i],document:recent.primaryDocument[i]})).filter(r=>['10-K','10-Q','8-K','10-K/A','10-Q/A'].includes(r.form)&&r.filed<=run.date).slice(0,10).map(r=>({...r,url:'https://www.sec.gov/Archives/edgar/data/'+Number(cik)+'/'+r.accession.replaceAll('-','')+'/'+r.document}));return {source_id:s.id,entity:data.name,cik,filings:rows,note:'Filing date and report period differ. Public corporate disclosures only.'};}
  const rows=selectSecFacts(data,args.metric,args.period,run.date);const r=result(run,{kind:'sec_facts',title:(data.entityName||'')+' · '+args.metric,source_id:s.id,data:{entity:data.entityName,cik,metric:args.metric,period:args.period,rows,revision_policy:'Latest filing known as of research date for each exact start/end interval; not a point-in-time backtest.'}});const numeric_facts=rows.map((row,i)=>fact(run,r,String(i),`${data.entityName} ${args.metric}：USD ${num(row.value)}（${row.start?row.start+' 至 ':''}${row.end}；${row.form}，申報 ${row.filed}）`,{period_start:row.start,period_end:row.end,filed:row.filed,accession:row.accession}));return {result_id:r.id,...r.data,numeric_facts,note:rows.length?'Do not combine annual, quarterly or instant facts or silently treat a reporting year as a calendar year.':'No facts for requested concept and period. Missing is not zero.'};
 }
 throw Error('Unsupported extended tool.');
}
