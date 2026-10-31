import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {HOUSEHOLD} from '../portfolio-bridge.mjs';
const family=JSON.parse(readFileSync(new URL('../../../src/lib/okonkwo-data.json',import.meta.url),'utf8'));
const instruments={inst_msft:['MSFT','ORD'],inst_nvda:['NVDA','ORD'],inst_aapl:['AAPL','ORD'],inst_amzn:['AMZN','ORD'],inst_googl:['GOOGL','ORD'],inst_ivv_us:['IVV','ETF'],inst_vwra_ie:['VWRA','ETF'],inst_csspx_ie:['CSPX','ETF'],inst_sgld_l:['SGLD','ETF'],inst_3115_hk:['3115.HK','ETF']};
export function publicPortfolio(scope){
 if(scope?.household!==HOUSEHOLD)throw Error('Household is not available in this public demo.');
 const rows=family.holdings.filter(h=>(scope.bank==='all'||h.bank===scope.bank)&&(scope.book==='all'||h.bookId===scope.book));
 if(!rows.length)throw Error('Selected portfolio scope is unavailable.');
 const holdings=rows.map(h=>({id:h.id,name:h.name,category:h.category,value:h.value,cost:h.cost,pnl:h.value-h.cost,symbol:instruments[h.instrumentId]?.[0]||null,instrumentType:instruments[h.instrumentId]?.[1]||(h.category==='note'?'structured_note':h.category==='alternative'?'fund':h.category),book:h.book,bookId:h.bookId,bank:h.bank,valuedAt:family.asOf}));
 const total=holdings.reduce((n,h)=>n+h.value,0),cost=holdings.reduce((n,h)=>n+h.cost,0);
 return {source:'public-demo',sourceLabel:'Mercury public demo',dataMode:'mock',householdId:HOUSEHOLD,household:family.household,scope_key:scope.key,book:scope.book,asOf:family.asOf,retrievedAt:new Date().toISOString(),version:createHash('sha256').update(JSON.stringify(holdings)).digest('hex'),holdings,total,cost,pnl:total-cost,warnings:['Committed fictional website snapshot, not a live bank or Supabase connection.'],books:[...new Map(family.holdings.map(h=>[h.bookId,{id:h.bookId,name:h.book,bank:h.bank}])).values()]};
}
