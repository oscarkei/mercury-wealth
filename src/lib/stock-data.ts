import {stockSymbolSchema,stockDataSchema,type StockData} from './stock-contract.ts';
const HOST='https://query1.finance.yahoo.com';
const US_EXCHANGES=new Set(['NMS','NGM','NCM','NYQ','ASE','PCX','BTS','NASDAQ','NYSE','NYSEARCA','NYSEAMERICAN']);
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
export function parseStockSearch(raw:unknown):StockData['results']{
 const rows=(raw as {quotes?:unknown[]})?.quotes;if(!Array.isArray(rows))throw Error('Invalid Yahoo search response');
 return rows.flatMap(row=>{const q=row as Record<string,unknown>;if(!stockSymbolSchema.safeParse(q.symbol).success||!['EQUITY','ETF'].includes(String(q.quoteType))||!US_EXCHANGES.has(String(q.exchange).toUpperCase()))return [];return [{symbol:String(q.symbol),name:String(q.shortname||q.longname||q.symbol).slice(0,160),exchange:String(q.exchDisp||q.exchange).slice(0,60),type:q.quoteType as 'EQUITY'|'ETF'}];}).filter((q,i,all)=>all.findIndex(x=>x.symbol===q.symbol)===i).slice(0,8);
}
export function parseStockChart(raw:unknown,symbol:string,now=Date.now()):NonNullable<StockData['quote']>{
 const body=raw as {chart?:{result?:Array<{meta:Record<string,unknown>;timestamp?:number[];indicators?:{quote?:Array<{close?:unknown[];volume?:unknown[]}>}}>}};
 const chart=body?.chart?.result?.[0],m=chart?.meta;
 if(!chart||!m||m.symbol!==symbol||m.currency!=='USD'||!['EQUITY','ETF'].includes(String(m.instrumentType))||!US_EXCHANGES.has(String(m.exchangeName).toUpperCase()))throw Error('Unsupported or missing US stock data');
 const prices=chart.indicators?.quote?.[0];
 const points=(chart.timestamp||[]).flatMap((t,i)=>{const c=prices?.close?.[i],v=prices?.volume?.[i];return finite(t)&&Number.isInteger(t)&&t>0&&t*1000<=now+300000&&finite(c)&&c>0?[{time:t,close:c,volume:finite(v)&&v>=0?v:null}]:[];});
 const rows=[...new Map(points.map(p=>[p.time,p])).values()].sort((a,b)=>a.time-b.time).slice(-400);
 if(!rows.length)throw Error('No valid price observations');
 return {symbol,name:String(m.longName||m.shortName||symbol),exchange:String(m.fullExchangeName||m.exchangeName),currency:'USD',price:finite(m.regularMarketPrice)&&m.regularMarketPrice>0?m.regularMarketPrice:null,quoteTime:finite(m.regularMarketTime)&&Number.isInteger(m.regularMarketTime)&&m.regularMarketTime>0&&m.regularMarketTime*1000<=now+300000?m.regularMarketTime:null,points:rows};
}
const cache=new Map<string,{at:number;data:StockData}>();
export async function fetchStockData(query:string,signal:AbortSignal):Promise<StockData>{
 query=query.trim();if(!query||query.length>80)throw Error('Invalid stock query');
 const cached=cache.get(query.toLowerCase());if(cached&&Date.now()-cached.at<60000)return structuredClone(cached.data);
 const data:StockData={query,retrievedAt:new Date().toISOString(),results:[],quote:null,warnings:[]};
 async function read(url:string){const r=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(9000)]),cache:'no-store',headers:{'User-Agent':'MercuryDemo/1.0'}});if(!r.ok)throw Error('Yahoo data unavailable');return r.json();}
 try{
  data.results=parseStockSearch(await read(HOST+'/v1/finance/search?q='+encodeURIComponent(query)+'&quotesCount=8&newsCount=0'));
  const chosen=data.results.find(r=>r.symbol===query.toUpperCase())||data.results[0];
  if(!chosen){data.warnings.push('No supported US-listed stock or ETF found. Try an exact ticker.');return data;}
  try{data.quote=parseStockChart(await read(HOST+'/v8/finance/chart/'+encodeURIComponent(chosen.symbol)+'?range=1y&interval=1d'),chosen.symbol);}
  catch(error){if(signal.aborted)throw error;data.warnings.push('Yahoo price history is unavailable. Search results are still shown; no substitute prices were generated.');}
 }catch(error){if(signal.aborted)throw error;data.warnings.push('Yahoo Finance search is unavailable. Please retry later; no sample market data was substituted.');}
 if(data.quote?.quoteTime&&Date.now()-data.quote.quoteTime*1000>5*86400000)data.warnings.push('The latest quoted trade is more than five calendar days old.');
 const parsed=stockDataSchema.parse(data);if(data.quote){if(cache.size>=40)cache.delete(cache.keys().next().value!);cache.set(query.toLowerCase(),{at:Date.now(),data:parsed});}return parsed;
}
