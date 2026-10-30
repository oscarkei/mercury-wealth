// Bounded public data adapters; no arbitrary user URLs or client portfolio fields.
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {safeEvidenceLink,companyQuerySchema,type CompanyQuery,type EvidenceItem} from './company-evidence-contract.ts';
const cacheRoot=resolve(process.env.MERCURY_EVIDENCE_CACHE || '.cache/company-evidence');
const id=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,24);
const known:Record<string,string>={NVDA:'0001045810',META:'0001326801',AMD:'0000002488',MSFT:'0000789019',AAPL:'0000320193'};
const allowed=new Set(['data.sec.gov','www.sec.gov','feeds.finance.yahoo.com','ir.amd.com','nvidianews.nvidia.com','investor.atmeta.com','news.microsoft.com']);
async function source(url:string,signal:AbortSignal,ttl=3600000){
 const u=new URL(url);if(u.protocol!=='https:'||!allowed.has(u.hostname))throw Error('Unregistered source endpoint');
 const file=resolve(cacheRoot,id(url)+'.json');
 try{const saved=JSON.parse(await readFile(file,'utf8'));if(Date.now()-saved.time<ttl)return {text:saved.text as string,retrievedAt:saved.retrievedAt as string};}catch{}
 const response=await fetch(url,{headers:{'User-Agent':'MercuryResearch/1.0 (https://mercury-digital-wealth.vercel.app)','Accept':'application/json, application/rss+xml, text/xml'},signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),redirect:'error',cache:'no-store'});
 if(!response.ok)throw Error('Public source HTTP '+response.status);
 const text=await response.text();if(text.length>12000000)throw Error('Source response too large');
 const retrievedAt=new Date().toISOString();await mkdir(cacheRoot,{recursive:true});await writeFile(file,JSON.stringify({time:Date.now(),retrievedAt,text}),{mode:0o600});return {text,retrievedAt};
}
export function cleanSourceText(text:string){return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,v)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[v as string]||'')).replace(/\s+/g,' ').trim();}

const inWindow=(date:string,q:CompanyQuery)=>date.slice(0,10)>=q.startDate&&date.slice(0,10)<=q.endDate;
export function parseCompanyRSS(xml:string,symbol:string,query:CompanyQuery,retrievedAt:string,publisher='Yahoo Finance RSS'):EvidenceItem[]{
 const items:EvidenceItem[]=[];
 for(const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const tag=(name:string)=>cleanSourceText(match[1].match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]||'');
  const title=tag('title'),url=tag('link'),date=Date.parse(tag('pubDate'));if(!title||!safeEvidenceLink(url)||!Number.isFinite(date))continue;
  const publishedAt=new Date(date).toISOString();if(!inWindow(publishedAt,query))continue;
  // Symbol feeds can include cross-company stories. Require an explicit issuer/name match.
  const names:Record<string,string>={NVDA:'NVIDIA',META:'Meta|Facebook',AMD:'AMD|Advanced Micro Devices',MSFT:'Microsoft',AAPL:'Apple'};
  const summary=tag('description').slice(0,1800);if(!new RegExp('\\b('+symbol+'|'+(names[symbol]||symbol)+')\\b','i').test(title+' '+summary))continue;
  items.push({id:'news_'+id(symbol+url),symbol,kind:'news',title:title.slice(0,500),summary,url,publisher,publishedAt,eventDate:null,retrievedAt,coverage:summary?'excerpt':'headline'});
 }
 return items.slice(0,12);
}
async function cik(symbol:string,signal:AbortSignal){
 if(known[symbol])return known[symbol];
 const data=JSON.parse((await source('https://www.sec.gov/files/company_tickers.json',signal,86400000)).text);
 const entry=Object.values(data).find((r:any)=>r.ticker===symbol) as any;if(!entry)throw Error('No SEC issuer mapping for '+symbol);return String(entry.cik_str).padStart(10,'0');
}
export async function companyNews(query:CompanyQuery,signal:AbortSignal){
 companyQuerySchema.parse(query);const items:EvidenceItem[]=[],warnings:string[]=[];
 for(const symbol of query.symbols){
  const urls=[{url:'https://feeds.finance.yahoo.com/rss/2.0/headline?s='+encodeURIComponent(symbol)+'&region=US&lang=en-US',publisher:'Yahoo Finance RSS'},...(symbol==='AMD'?[{url:'https://ir.amd.com/news-events/press-releases/rss',publisher:'AMD Investor Relations'}]:[])];
  const responses=await Promise.allSettled(urls.map(async s=>{const r=await source(s.url,signal,900000);return parseCompanyRSS(r.text,symbol,query,r.retrievedAt,s.publisher);}));
  for(const r of responses)if(r.status==='fulfilled')items.push(...r.value);else warnings.push(symbol+': a news feed was unavailable.');
  if(!items.some(i=>i.symbol===symbol))warnings.push(symbol+': no retained news matched the observation window; this does not mean no news occurred.');
 }
 warnings.push('RSS coverage is limited to articles retained by each feed, not a complete historical news archive. Headlines/excerpts are labelled; full articles were not fetched. Publication date is not necessarily event date.');
 return {items:[...new Map(items.map(i=>[i.url,i])).values()],warnings};
}
export function parseFilings(body:any,symbol:string,cikValue:string,q:CompanyQuery,retrievedAt:string){
 const recent=body.filings?.recent;if(!recent||!Array.isArray(recent.form))throw Error('SEC filings unavailable');const items:EvidenceItem[]=[];
 for(let n=0;n<recent.form.length;n++){
  const form=recent.form[n],publishedAt=recent.acceptanceDateTime?.[n]||recent.filingDate?.[n];if(!['10-Q','10-K','8-K'].includes(form)||!publishedAt||!inWindow(publishedAt,q))continue;
  if(form==='8-K'&&!String(recent.items?.[n]||'').includes('2.02'))continue;
  const accession=String(recent.accessionNumber[n]);if(!/^\d{10}-\d{2}-\d{6}$/.test(accession))continue;
  const url='https://www.sec.gov/Archives/edgar/data/'+Number(cikValue)+'/'+accession.replaceAll('-','')+'/'+accession+'-index.html';
  items.push({id:'filing_'+id(symbol+accession),symbol,kind:'filing',title:symbol+' '+form+(form==='8-K'?' — results of operations':' — financial report'),summary:'SEC filing metadata. Read the linked filing for management discussion; this entry does not claim full-text analysis.',url,publisher:'SEC EDGAR',publishedAt,eventDate:recent.reportDate?.[n]||null,retrievedAt,coverage:'filing_metadata',accession});
 }
 return items.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,12);
}
export async function companyFilings(query:CompanyQuery,signal:AbortSignal){
 companyQuerySchema.parse(query);const items:EvidenceItem[]=[],warnings:string[]=[];
 for(const symbol of query.symbols)try{const c=await cik(symbol,signal),r=await source('https://data.sec.gov/submissions/CIK'+c+'.json',signal);items.push(...parseFilings(JSON.parse(r.text),symbol,c,query,r.retrievedAt));}catch{warnings.push(symbol+': SEC filing history unavailable.');}
 return {items,warnings};
}
const metrics=[{name:'Revenue',tags:['Revenues','RevenueFromContractWithCustomerExcludingAssessedTax','RevenueFromContractWithCustomerIncludingAssessedTax','SalesRevenueNet'],unit:'USD'},{name:'Net income',tags:['NetIncomeLoss','ProfitLoss'],unit:'USD'},{name:'Diluted EPS',tags:['EarningsPerShareDiluted'],unit:'USD/shares'},{name:'Operating cash flow',tags:['NetCashProvidedByUsedInOperatingActivities'],unit:'USD'}];
export function parseFinancialFacts(body:any,symbol:string,cikValue:string,q:CompanyQuery,retrievedAt:string):EvidenceItem[]{
 const result:EvidenceItem[]=[];
 for(const metric of metrics){
  const observations=metric.tags.flatMap(tag=>(body.facts?.['us-gaap']?.[tag]?.units?.[metric.unit]||[]).map((r:any)=>({...r,tag}))).filter((r:any)=>Number.isFinite(r.val)&&r.start&&r.end&&r.filed&&r.filed<=q.endDate&&['10-K','10-Q','10-K/A','10-Q/A'].includes(r.form));
  const unique=new Map<string,any>();for(const r of observations.sort((a:any,b:any)=>b.filed.localeCompare(a.filed)))if(!unique.has(r.start+'|'+r.end))unique.set(r.start+'|'+r.end,r);
  const all=[...unique.values()].map(r=>({...r,days:(Date.parse(r.end)-Date.parse(r.start))/86400000})).sort((a,b)=>b.end.localeCompare(a.end)||a.days-b.days);
  const preferred=metric.name==='Operating cash flow'?all.filter(r=>r.days>=65&&r.days<=380):all.filter(r=>r.days>=65&&r.days<=110);
  const selected=preferred.length?preferred:all.filter(r=>r.days>=300&&r.days<=380);
  const current=selected.find(r=>r.filed>=q.startDate);if(!current)continue;
  const previous=selected.find(r=>{const diff=(Date.parse(current.end)-Date.parse(r.end))/86400000;return diff>=350&&diff<=380&&Math.abs(r.days-current.days)<=10;});
  const make=(r:any):EvidenceItem=>({id:'fact_'+id(symbol+metric.name+r.start+r.end+r.accn),symbol,kind:'financial_fact',title:symbol+' '+metric.name,summary:'Reported '+metric.name+' for '+r.start+' through '+r.end+'. Source tag: '+r.tag+'.',url:'https://www.sec.gov/Archives/edgar/data/'+Number(cikValue)+'/'+String(r.accn).replaceAll('-','')+'/'+r.accn+'-index.html',publisher:'SEC Company Facts',publishedAt:r.filed,eventDate:r.end,retrievedAt,coverage:'reported_fact',metric:metric.name,value:r.val,unit:metric.unit,periodStart:r.start,periodEnd:r.end,periodKind:r.days<=110?'Quarter':r.days>=300?'Annual':'Year to date',accession:r.accn});
  const item=make(current);
  if(previous){const prior=make(previous);result.push(prior);item.comparisonId=prior.id;if(previous.val>0)item.yoyPct=(current.val/previous.val-1)*100;}
  result.push(item);
 }
 return result;
}
export async function financialFacts(query:CompanyQuery,signal:AbortSignal){
 companyQuerySchema.parse(query);const items:EvidenceItem[]=[],warnings:string[]=[];
 for(const symbol of query.symbols)try{const c=await cik(symbol,signal),r=await source('https://data.sec.gov/api/xbrl/companyfacts/CIK'+c+'.json',signal,21600000);const facts=parseFinancialFacts(JSON.parse(r.text),symbol,c,query,r.retrievedAt);items.push(...facts);if(!facts.length)warnings.push(symbol+': no comparable financial facts published within the selected window.');}catch{warnings.push(symbol+': SEC financial facts unavailable.');}
 return {items,warnings};
}
