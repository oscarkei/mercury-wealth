import {z} from 'zod';
import type {FedData,FedMeeting} from './fed-contract.ts';
export const RATE_URL='https://markets.newyorkfed.org/api/rates/unsecured/effr/last/180.json';
export const MARKET_URL='https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=KXFEDDECISION&status=open&with_nested_markets=true&limit=12';
const iso=z.string().refine(s=>Number.isFinite(Date.parse(s)));
const numeric=z.union([z.number(),z.string().regex(/^\d+(?:\.\d+)?$/)]).transform(Number);
const rowSchema=z.object({effectiveDate:iso,type:z.literal('EFFR'),percentRate:numeric,targetRateFrom:numeric,targetRateTo:numeric});
export function parseRates(raw:unknown,now=Date.now()):FedData['rates']{
 const body=z.object({refRates:z.array(z.unknown()).max(1000)}).parse(raw);
 const rows=body.refRates.flatMap(v=>{const r=rowSchema.safeParse(v);if(!r.success)return [];const x=r.data;if(Date.parse(x.effectiveDate)>now||x.targetRateFrom>x.targetRateTo||x.percentRate<0||x.percentRate>30||x.targetRateTo>30)return [];return [{date:x.effectiveDate,rate:x.percentRate,lower:x.targetRateFrom,upper:x.targetRateTo}];});
 return [...new Map(rows.map(r=>[r.date,r])).values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-200);
}
const marketSchema=z.object({ticker:z.string(),status:z.string(),yes_bid_dollars:numeric,yes_ask_dollars:numeric,yes_bid_size_fp:numeric.optional(),yes_ask_size_fp:numeric.optional(),volume_24h_fp:numeric.optional()});
const eventSchema=z.object({event_ticker:z.string().regex(/^KXFEDDECISION-\d{2}[A-Z]{3}$/),series_ticker:z.literal('KXFEDDECISION'),mutually_exclusive:z.literal(true),strike_date:iso,markets:z.array(z.unknown()).max(100)});
const labels:Record<string,{label:string;direction:'cut'|'hold'|'hike'}>={C26:{label:'Cut >25 bp',direction:'cut'},C25:{label:'Cut 25 bp',direction:'cut'},H0:{label:'Hold',direction:'hold'},H25:{label:'Hike 25 bp',direction:'hike'},H26:{label:'Hike >25 bp',direction:'hike'}};
const round=(n:number)=>Math.round(n*100)/100;
export function parseMeetings(raw:unknown,now=Date.now()):FedMeeting[]{
 const body=z.object({events:z.array(z.unknown()).max(200)}).parse(raw);
 return body.events.flatMap(v=>{
  const parsed=eventSchema.safeParse(v);if(!parsed.success)return [];const e=parsed.data;
  if(Date.parse(e.strike_date)<=now)return [];
  const issues:string[]=[];const outcomes=e.markets.flatMap(value=>{
   const m=marketSchema.safeParse(value);if(!m.success)return [];const x=m.data;
   const suffix=x.ticker.slice(e.event_ticker.length+1),label=labels[suffix];
   if(!label||!x.ticker.startsWith(e.event_ticker+'-')||x.status!=='active')return [];
   const bid=x.yes_bid_dollars,ask=x.yes_ask_dollars;
   if(bid<0||ask>1||ask<=0||bid>ask){issues.push('An invalid or unavailable quote was excluded.');return [];}
   return [{id:x.ticker,...label,bid:round(bid*100),ask:round(ask*100),mid:round((bid+ask)*50),oneSided:bid===0||ask===1||x.yes_bid_size_fp===0||x.yes_ask_size_fp===0,volume24h:Math.max(0,x.volume_24h_fp||0)}];
  });
  const unique=[...new Map(outcomes.map(o=>[o.id,o])).values()];
  if(unique.length!==5)issues.push('Incomplete outcome coverage; do not infer missing probabilities.');
  if(unique.some(o=>o.oneSided))issues.push('Some outcomes have a one-sided order book; midpoints are indicative.');
  if(unique.some(o=>o.ask-o.bid>10))issues.push('Wide bid/ask spreads indicate uncertain pricing.');
  const quoteTotal=round(unique.reduce((n,o)=>n+o.mid,0));
  if(Math.abs(quoteTotal-100)>.1)issues.push('Independent quote midpoints do not sum to 100%; no normalization is applied.');
  return [{id:e.event_ticker,date:e.strike_date,title:new Date(e.strike_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}),url:'https://kalshi.com/markets/kxfeddecision/fed-decision/'+e.event_ticker.toLowerCase(),outcomes:unique,quoteTotal,issues}];
 }).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,12);
}
type Cached={at:number;value:unknown};const cache=new Map<string,Cached>();
async function source(url:string,signal:AbortSignal){
 const existing=cache.get(url);if(existing&&Date.now()-existing.at<60000)return {...existing,stale:false};
 try{const r=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(9000)]),cache:'no-store'});if(!r.ok)throw Error('Unavailable');const value=await r.json();
  // Reject malformed responses before replacing a valid cached snapshot.
  if(url===RATE_URL&&!parseRates(value).length)throw Error('Missing rates');if(url===MARKET_URL&&!parseMeetings(value).length)throw Error('Missing meetings');
  const next={at:Date.now(),value};cache.set(url,next);return {...next,stale:false};
 }catch(error){if(signal.aborted)throw error;if(existing&&Date.now()-existing.at<86400000)return {...existing,stale:true};throw Error('Source unavailable');}
}
export async function fetchFedData(tools:readonly string[],signal:AbortSignal):Promise<FedData>{
 if(tools.some(t=>!['fed_rates','fed_markets'].includes(t)))throw Error('Unsupported data tool');
 const result:FedData={retrievedAt:new Date().toISOString(),ratesFetchedAt:null,marketsFetchedAt:null,rates:[],meetings:[],warnings:[],ratesStale:false,marketsStale:false};
 await Promise.all(tools.map(async tool=>{try{const s=await source(tool==='fed_rates'?RATE_URL:MARKET_URL,signal);
  if(tool==='fed_rates'){result.rates=parseRates(s.value);result.ratesFetchedAt=new Date(s.at).toISOString();result.ratesStale=s.stale;if(s.stale)result.warnings.push('NY Fed refresh failed; showing an older cached snapshot.');}
  if(tool==='fed_markets'){result.meetings=parseMeetings(s.value);result.marketsFetchedAt=new Date(s.at).toISOString();result.marketsStale=s.stale;if(s.stale)result.warnings.push('Market refresh failed; showing an older cached snapshot.');}
 }catch{if(signal.aborted)return;result.warnings.push(tool==='fed_rates'?'NY Fed rates are unavailable. No substitute rates were generated.':'Kalshi quotes are unavailable. No probabilities were generated.');}}));
 if(signal.aborted)throw signal.reason;
 const latest=result.rates.at(-1);if(latest&&Date.now()-Date.parse(latest.date)>5*86400000){result.ratesStale=true;result.warnings.push('The latest official rate observation is more than five calendar days old.');}
 return result;
}
