import {currentAIProvider} from './gemini-model-server.ts';
import {AI_TIMEOUTS} from './ai-timeouts.ts';
import {portfolioMetricBindings} from './portfolio-metrics.ts';
import type {AssistantInput,AssistantEvent} from './assistant-contract.ts';
import type {FedPlan} from './fed-contract.ts';
import {currentWealthRuntime} from './wealth-runtime.ts';
import {loadWealthClient} from './wealth-client.ts';
import {explainWealth} from './wealth-explanation.ts';
import {analysisStage} from './analysis-stage.ts';
import fcn from './held-fcn-data.json' with {type:'json'};
import family from './okonkwo-data.json' with {type:'json'};
import {executeAccumulatorTool} from './market-tool-registry.ts';
type Send=(e:Omit<AssistantEvent,'requestId'|'revision'>)=>void;
export async function runWealthPortfolio(input:AssistantInput,plan:FedPlan,signal:AbortSignal,send:Send){
 if(!input.portfolioScope)throw Error('A selected portfolio is required.');
 const client=currentWealthRuntime()?.client||await loadWealthClient(input.portfolioScope,signal);
 const previous=currentWealthRuntime()?.state.lastPlan as Partial<FedPlan>|undefined;
 const {bindings,positions,categories}=portfolioMetricBindings(client);
 let scenario:unknown=null;
 const ownsAccumulator=client.holdings.some(h=>h.instrumentId===family.accumulator.instrumentId);
 const mode=plan.portfolioFocus||'overview';
 const held=client.holdings.filter(h=>h.category==='note');
 const selectedId=plan.instrumentId||(input.interaction?.kind==='held_product'?input.interaction.instrumentId:currentWealthRuntime()?.state.selectedInstrumentId);
 if((mode==='product'||mode==='scenario')&&selectedId&&!held.some(h=>h.instrumentId===selectedId)){send({type:'reply',provider:'Local',text:input.language==='en'?'That product is not held in the selected scope.':input.language==='zh-Hans'?'所选范围未持有此产品。':'所選範圍未持有此產品。'});return;}
 if((mode==='product'||mode==='scenario')&&held.length>1&&!selectedId){send({type:'input_request',inputRequest:{version:'1',kind:'held_product',question:input.message,intent:mode,products:held.map(h=>({id:h.instrumentId,label:h.name+' · '+h.book}))}});return;}
 const selected=held.find(h=>h.instrumentId===selectedId)||(held.length===1?held[0]:undefined);
 if(selected?.instrumentId===fcn.instrument.id){
  if(mode==='scenario'){send({type:'input_request',inputRequest:{version:'1',kind:'fcn_scenario',question:input.message,shockPct:plan.shockPct}});return;}
  bindings['fcn.name']=fcn.instrument.name;bindings['fcn.issuer']='UBS AG';
  const underlyingReferences=fcn.underlyings.map(u=>{bindings['fcn.'+u.symbol+'.initial']='$'+u.initialFixing.amount.toFixed(2);bindings['fcn.'+u.symbol+'.strike']='$'+(u.initialFixing.amount*fcn.terms.strikePct/100).toFixed(4);return {symbol:u.symbol,initialFixing:'{{fcn.'+u.symbol+'.initial}}',strikePrice:'{{fcn.'+u.symbol+'.strike}}'};});
  for(const [key,value]of Object.entries({notional:selected.quantity*100,value:selected.value,strike:fcn.terms.strikePct,call:fcn.terms.autocallLevelPct,annualCoupon:fcn.terms.couponPerAnnumPct,monthlyProse:0.83,maturity:fcn.terms.maturityDate,snapshot:client.asOf}))bindings['fcn.'+key]=String(value);
  const explained=await explainWealth('Explain only the selected held FCN using its imported term reference. Initial underlying fixing values and derived dollar strikes are provided; do not claim they are missing. Coupon prose and annual field disagree: state this gap rather than inventing precise coupon totals. Distinguish marked position value, conditional maturity principal and tradable price. Answer the question directly and stop when complete.',{question:input.message,productReference:'{{fcn.name}}',issuerReference:'{{fcn.issuer}}',termReferences:{strike:'{{fcn.strike}}%',annualCoupon:'{{fcn.annualCoupon}}%',monthlyCouponProse:'{{fcn.monthlyProse}}%',maturity:'{{fcn.maturity}}',dailyCallLevel:'{{fcn.call}}%'},underlyingFixings:underlyingReferences,settlement:fcn.terms.settlementType,limitations:fcn.limitations},bindings,signal);
  send({type:'reply',provider:currentAIProvider(),model:explained.model,text:explained.text});return;
 }

 if(ownsAccumulator){for(const [key,value] of Object.entries(family.accumulator))if(typeof value==='number'||typeof value==='string'){bindings['terms.'+key]=typeof value==='number'&&/Pct$/.test(key)?value+'%':String(value);}}
 if(mode==='scenario'&&selected?.instrumentId===family.accumulator.instrumentId){
  const shock=plan.shockPct??previous?.shockPct;
  if(shock===undefined){send({type:'reply',provider:'Local',text:input.language==='en'?'What underlying price change would you like to model for the Apple accumulator?':input.language==='zh-Hans'?'你想模拟 AAPL 相关资产价格变动多少？':'你想模擬 AAPL 相關資產價格變動多少？'});return;}
  const days=plan.scenarioDays??previous?.scenarioDays??20;
  const path=executeAccumulatorTool('accumulator_scenario',client,{shockPct:shock,days}).path!,last=path.at(-1)!;
  scenario={method:'Illustrative constant-price accumulation over the chosen days; not a live valuation or full contract repricing',shockPct:shock,days,assumptions:{initialFixing:family.accumulator.initialFixing,strikePct:88,knockoutPct:105,baseSharesPerDay:40,gearingBelowStrike:2,guaranteedPeriodNotModeled:true,feesFinancingSettlementExcluded:true},...last,pnl:last.value-last.cost};
  send({type:'wealth_scenario',wealthScenario:{kind:'accumulator',instrumentId:family.accumulator.instrumentId,name:'Apple accumulator',snapshot:client.version||client.asOf,asOf:client.asOf,shockPct:shock,days,shares:last.shares,cost:last.cost,value:last.value,pnl:last.value-last.cost,path,assumptions:['Constant underlying price for the selected trading days.','Initial fixing and contract strike/knockout inputs from the imported product record.','Guaranteed period, financing, fees and settlement effects are not modeled.']}});
  for(const [key,value] of Object.entries({shock,days,shares:last.shares,cost:last.cost,value:last.value,pnl:last.value-last.cost}))bindings['scenario.'+key]=['shock'].includes(key)?value+'%':key==='days'||key==='shares'?String(value):value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
 }
 send({type:'progress',text:scenario?'Scenario calculated. Interpreting the product mechanics…':'Reviewing the selected holdings and client context…'});
 const result=await analysisStage({stage:'explanation',service:currentAIProvider(),timeout_ms:AI_TIMEOUTS.explanation},signal,send,s=>explainWealth('Analyze the selected demo portfolio. Use the actual scope and supplied deterministic metrics. No historical performance, indirect fund exposure, IPS breach or current derivative valuation has been calculated. For product questions only the held Apple accumulator terms apply; never substitute the legacy Chan note catalog. For scenarios explain shares accumulated, purchase cost and marked value under the stated assumptions; this excludes the guarantee period and is not a full contractual projection. If a different held note lacks terms, identify the specific missing input.',{question:input.message,focus:mode,groups:categories,positions,heldAccumulatorTerms:ownsAccumulator?family.accumulator:null,scenario},bindings,s,delay=>send({type:'progress',text:`The explanation service requested a retry. Waiting ${Math.ceil(delay/1000)}s; your portfolio snapshot is retained.`})));
 send({type:'reply',provider:currentAIProvider(),model:result.model,text:result.text,elapsed_ms:result.elapsed_ms});
}
