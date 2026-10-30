import {holdings,allocation,TOTAL,SNAPSHOT,changes} from './domain.ts';
import {products,productById,evaluateProduct,scenarioPaths,type ProductId} from './structured-products.ts';
import type {AssistantInput} from './assistant-contract.ts';
import family from './okonkwo-data.json' with {type:'json'};
export function assistantContext(input:AssistantInput){
 const text=input.message,context=input.context;
 const product:ProductId=/note\s*a/i.test(text+' '+context)?'note-a':/asia equity|\bfcn\b/i.test(text+' '+context)?'fcn':/technology autocall/i.test(text+' '+context)?'phoenix':input.product;
 const path=[...(product===input.product?input.path:scenarioPaths.base)];
 const explicit=/\bnote\b|structured|autocall|\bfcn\b|票據|結構(?:性)?產品|張note/i.test(text),denied=/not\s+(?:a\s+)?(?:note|structured)|唔係.*(?:note|票據|結構(?:性)?產品)|不是.*(?:票據|結構(?:性)?產品)/i.test(text);
 const contextual=/product|note|autocall|票據/i.test(context)&&/fall|drop|down|rise|up|decline|跌|升|scenario|情境/i.test(text)&&!/stock|equity portfolio|股票/i.test(text);
 const down=text.match(/(?:falls?|drops?|down|declines?|跌(?:咗)?)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*[%％]/i),up=text.match(/(?:rises?|up|gains?|升)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*[%％]/i);
 const level=text.match(/(?:final|maturity|underlying)\s*(?:level\s*)?(?:at|of|is|=|to)?\s*(\d+(?:\.\d+)?)\s*%/i);
 let scenarioChanged=false;
 if(!denied&&(explicit||contextual)&&(down||up||level)){
  const final=down?100-Number(down[1]):up?100+Number(up[1]):Number(level![1]);
  if(final<0||final>130)throw new Error('Scenario must end between 0% and 130% of the initial level.');
  path[6]=final;scenarioChanged=true;
 }
 const terms=productById(product),scenario=evaluateProduct(product,path);

 return {
  snapshot:SNAPSHOT,asOf:'2026-10-24',currency:'USD',total:TOTAL,holdings,allocation,wealthChange:changes,
  cash:{available:1515600,scheduledNoteAPrincipal:250000,scheduledDate:'2026-11-20',conditionalAutocall:150000,conditionalIncludedInAvailable:false},
  product,terms,products,path,scenario,scenarioChanged,
  productAssumptions:'Fictional full-tenor paths; final-only European barrier for Phoenix; non-memory coupons; coupons stop after autocall; issuer performance assumed; fees/taxes excluded; no real quotes or market feed.',
  proposal:{version:2,cashBefore:18,cashAfter:23,notesBefore:12,notesAfter:7,costUSD:800,execution:false},
  selectedView:input.view,untrustedContext:input.context,
  capabilities:['Display overview','Filter holdings','Visualize sample product scenarios','Plan maturity proceeds','Review sample adviser proposal','Save a local discussion draft'],
  unavailable:['Live securities/market data','Trades','Sending adviser messages','Real client records','Tax or suitability determinations']
 };
}

export function scopedAssistantContext(input:AssistantInput){
 const legacy=assistantContext(input),{product,path}=legacy;
 if(input.portfolioScope){
  const scope=input.portfolioScope;
  if(scope.bank!=='all'&&!family.holdings.some(h=>h.bank===scope.bank))throw Error('Unknown custodian scope');
  if(scope.book!=='all'&&!family.holdings.some(h=>h.bookId===scope.book))throw Error('Unknown portfolio scope');
  const selected=family.holdings.filter(h=>(scope.bank==='all'||h.bank===scope.bank)&&(scope.book==='all'||h.bookId===scope.book));
  const total=selected.reduce((n,h)=>n+h.value,0),groups=new Map<string,number>();
  for(const h of selected)groups.set(h.category,(groups.get(h.category)||0)+h.value);
  return {snapshot:family.household,asOf:family.asOf,currency:'USD',total,
   holdings:selected.map(h=>({id:h.id,name:h.fullName,category:h.category,valueUSD:h.value,costUSD:h.cost,owner:h.owner,custodian:h.bank,book:h.book,quantity:h.quantity,originalCurrency:h.currency})),
   allocation:[...groups].map(([category,value])=>({category,valueUSD:value,weightPct:total?value/total*100:0})),
   cash:{available:selected.filter(h=>h.category==='cash').reduce((n,h)=>n+h.value,0)},wealthChange:null,
   product,path,terms:null,products:[],scenario:null,scenarioChanged:false,
   productAssumptions:'Only the supplied imported accumulator terms apply to this household; legacy Chan note scenarios are not this account.',
   accumulatorTerms:family.accumulator,proposal:null,selectedView:input.view,untrustedContext:input.context,
   source:'Server-owned imported mock baseline, as of 2026-06-19. This request does not independently refresh the bank records.',scope,
   capabilities:['Explain the imported household snapshot','Discuss public-market research with separate sourced tools','Explain supplied contract terms'],
   unavailable:['Actual historical account performance','Full-account optimization or suitability approval','Unprovided current market values','Trade execution','Live accumulator valuation']};
 }
 return legacy;
}
