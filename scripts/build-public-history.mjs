// Build a read-only public mock from the committed fictional holdings and a
// public market_history result. Never read credentials, client databases or chats.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {reconstructHistory} from '../src/lib/portfolio-history-server.ts';
const input=process.argv[2];
if(!input)throw Error('Provide the public market_history JSON path.');
const prices=JSON.parse(readFileSync(input,'utf8'));
const family=JSON.parse(readFileSync(new URL('../src/lib/okonkwo-data.json',import.meta.url),'utf8'));
const symbols={inst_msft:'MSFT',inst_nvda:'NVDA',inst_aapl:'AAPL',inst_amzn:'AMZN',inst_googl:'GOOGL',inst_ivv_us:'IVV'};
const snapshot={...family,holdings:family.holdings.map(h=>({...h,symbol:symbols[h.instrumentId],instrumentType:h.instrumentId==='inst_ivv_us'?'ETF':symbols[h.instrumentId]?'ORD':undefined}))};
const histories=[];
for(const bank of ['all',...new Set(family.holdings.map(h=>h.bank))]) {
 for(const book of ['all',...new Set(family.holdings.map(h=>h.bookId))]) {
  const rows=snapshot.holdings.filter(h=>(bank==='all'||h.bank===bank)&&(book==='all'||h.bookId===book));
  if(!rows.length)continue;
  const history=reconstructHistory(snapshot,prices.histories,{bank,book});
  if(history.points.length<20)throw Error('Missing public prices for '+bank+'/'+book);
  histories.push({...history,scope:{bank,book},holdings:rows.map(h=>({id:h.id,value:h.value})),savedDemo:true,points:history.points.map(p=>({...p,value:Math.round(p.value*100)/100}))});
 }
}
const output=new URL('../public/demo/portfolio-history.json',import.meta.url);
mkdirSync(new URL('../public/demo/',import.meta.url),{recursive:true});
writeFileSync(output,JSON.stringify({version:1,description:'Saved public demo: fixed fictional holdings repriced with observed historical closes. Not actual account performance or a live feed.',retrievedAt:prices.retrieved_at,sources:prices.histories.map(h=>({symbol:h.symbol,provider:h.provider,firstDate:h.first_date,lastDate:h.last_date,snapshotId:h.snapshot_id})),histories}));
console.log('Wrote '+histories.length+' scoped demo curves.');
