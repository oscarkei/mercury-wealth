import {comparisonRows} from './rich-response.ts';
import type {ResearchAnalysis} from './research-contract.ts';
export function evidenceBindings(analysis:ResearchAnalysis,previous?:ResearchAnalysis){
 const bindings:Record<string,string>={};
 function add(a:ResearchAnalysis,prefix=''){
  const rows=comparisonRows(a);
  if(rows.length){bindings[prefix+'window.start']=rows[0].firstDate;bindings[prefix+'window.end']=rows[0].lastDate;bindings[prefix+'observations']=String(rows[0].observations);bindings[prefix+'window.observations']=String(rows[0].observations);}
  const leader=rows.length>1?rows.reduce((a,b)=>a.priceChangePct>b.priceChangePct?a:b):undefined;
  if(leader)bindings[prefix+'leader']=leader.symbol;
  for(const r of rows){
   bindings[prefix+r.symbol+'.change']=r.priceChangePct.toFixed(2)+'%';
   bindings[prefix+r.symbol+'.startClose']='$'+r.firstClose.toFixed(2);
   bindings[prefix+r.symbol+'.endClose']='$'+r.lastClose.toFixed(2);
   if(leader)bindings[prefix+r.symbol+'.gapToLeader']=((leader?.priceChangePct||0)-r.priceChangePct).toFixed(2)+' percentage points';
  }
  const o=a.data.optimization;
  if(o){bindings[prefix+'cash']=o.cash_pct.toFixed(1)+'%';bindings[prefix+'assetCap']=a.plan.maxAssetPct.toFixed(1)+'%';bindings[prefix+'capital']='$'+o.capital.toFixed(2);bindings[prefix+'cost']='$'+o.estimated_cost.toFixed(2);bindings[prefix+'referenceRisk']=o.reference_volatility_pct.toFixed(2)+'%';bindings[prefix+'targetRisk']=o.target_volatility_pct.toFixed(2)+'%';for(const r of o.rows){bindings[prefix+r.symbol+'.targetWeight']=r.target_pct.toFixed(2)+'%';bindings[prefix+r.symbol+'.riskContribution']=r.risk_contribution_pct.toFixed(2)+'%';}}
 }
 add(analysis);if(previous)add(previous,'previous.');return bindings;
}
export function bindEvidenceText(text:string,bindings:Record<string,string>,verifiedIdentifiers:string[]=[]){
 // Accept the documented metric namespace only when its exact evidence key exists.
 text=text.replace(/\{\{metric\.([A-Za-z0-9_.]+)\}\}/g,(token,key)=>Object.hasOwn(bindings,key)?'{{'+key+'}}':token);
 let plain=text.replace(/\{\{([A-Za-z0-9_.]+)\}\}/g,(_,key)=>{if(!Object.hasOwn(bindings,key))throw new Error('Unknown evidence reference: '+key);return '';});
 for(const word of verifiedIdentifiers)if(/^[A-Za-z][A-Za-z0-9-]*$/.test(word)&&/\d/.test(word))plain=plain.replace(new RegExp('\\b'+word+'\\b','g'),'');
 if(/[0-9]|\{\{|\}\}|百分之[零〇一二兩两三四五六七八九十百千萬万億亿]+|[零〇一二兩两三四五六七八九十百千萬万億亿]+(?:[點点][零〇一二三四五六七八九]+)?(?:成|美元|港元|元|股|基點|基点|百分點|百分点)|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|million|billion)[ -]+(?:percent|dollars|shares|basis points)\b/i.test(plain))throw new Error('Unbound numerical claim in explanation');
 return text.replace(/\{\{([A-Za-z0-9_.]+)\}\}/g,(_,key)=>bindings[key]);
}

export async function bindWithOneRepair<T>(draft:unknown,parse:(value:unknown)=>T,repair:(draft:unknown,error:string)=>Promise<unknown>):Promise<T>{
 try{return parse(draft);}catch(error){
  const corrected=await repair(draft,error instanceof Error?error.message:'Invalid evidence format');
  return parse(corrected); // A second invalid response fails closed; no unbounded retry.
 }
}
