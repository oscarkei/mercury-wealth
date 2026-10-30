import type {FamilySnapshot} from './family-contract.ts';
const money=(value:number)=>value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
export function portfolioMetricBindings(client:FamilySnapshot){
 const bindings:Record<string,string>={'portfolio.total':money(client.total),'portfolio.asOf':client.asOf,'portfolio.count':String(client.holdings.length),'portfolio.unrealizedChange':money(client.holdings.reduce((sum,h)=>sum+h.value-h.cost,0))};
 const categories=new Map<string,number>(),currencies=new Map<string,number>();
 const positions=client.holdings.map((h,index)=>{
  const ref='holding'+index;categories.set(h.category,(categories.get(h.category)||0)+h.value);currencies.set(h.currency,(currencies.get(h.currency)||0)+h.value);
  bindings[ref+'.name']=h.name;bindings[ref+'.value']=money(h.value);bindings[ref+'.weight']=(h.value/client.total*100).toFixed(2)+'%';bindings[ref+'.unrealizedChange']=money(h.value-h.cost);bindings[ref+'.quantity']=h.quantity.toLocaleString('en-US');bindings[ref+'.date']=h.valuedAt||client.asOf;
  return {ref,id:h.id,instrumentId:h.instrumentId,name:h.name,category:h.category,book:h.book,currency:h.currency,valueUSD:h.value,weightPct:h.value/client.total*100};
 });
 for(const [category,value] of categories){bindings[category+'.value']=money(value);bindings[category+'.weight']=(value/client.total*100).toFixed(2)+'%';}
 for(const [currency,value] of currencies)if(/^[A-Z]{3}$/.test(currency)){bindings['currency.'+currency+'.value']=money(value);bindings['currency.'+currency+'.weight']=(value/client.total*100).toFixed(2)+'%';}
 return {bindings,positions,categories:[...categories]};
}
