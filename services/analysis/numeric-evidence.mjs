import {evidenceIssues} from './evidence-review.mjs';
const fmt=(n,d=3)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(n);
const refs=text=>[...text.matchAll(/\[(?:source:)?([SRF]\d+)\]/g)].map(m=>m[1]);
export function addFact(run,fact){run.facts??=[];const prior=run.facts.find(f=>f.key===fact.key);if(prior)return prior;const f={...fact,id:'F'+(run.facts.length+1)};run.facts.push(f);return f;}
export function extractQuantities(text){
 const rows=[];const num='(?<![0-9.,])((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\\.[0-9]+)?)';
 const re=new RegExp(num+'\\s*(billion\\s+cubic\\s+feet|trillion\\s+cubic\\s+feet|bcf|tcf)(?:\\s*(?:per\\s+day|\\/\\s*d(?:ay)?|d\\b))?','gi');
 for(const m of text.matchAll(re)){const value=Number(m[1].replaceAll(',','')),scale=/trillion|tcf/i.test(m[2])?10000:10;if(!Number.isFinite(value*scale))continue;const daily=/per\s+day|\/\s*d|bcfd/i.test(m[0]);rows.push({source_offset:m.index,original:m[0],value,canonical_value:value*scale,canonical_unit:'億立方英尺'+(daily?'／日':''),daily,quantity_role:/(?:by|a further|slipping|rising|falling|increased|decreased|adding|added)\s*$/i.test(text.slice(Math.max(0,m.index-40),m.index))?'change':'level',context:text.slice(Math.max(0,m.index-70),m.index+m[0].length+100)});}
 const zh=new RegExp(num+'\\s*(萬億|万亿|兆|億|亿)\\s*立方(?:英尺|英呎|呎)(?:\\s*[／/]\\s*(日|天))?','g');
 for(const m of text.matchAll(zh)){const value=Number(m[1].replaceAll(',','')),scale=['億','亿'].includes(m[2])?1:10000;rows.push({source_offset:m.index,original:m[0],value,canonical_value:value*scale,canonical_unit:'億立方英尺'+(m[3]?'／日':''),daily:!!m[3],context:text.slice(Math.max(0,m.index-70),m.index+m[0].length+100)});}
 return rows;
}
export function sourceFacts(run,source,text){return extractQuantities(text).slice(0,24).map(q=>addFact(run,{key:source.id+':'+q.canonical_value+':'+q.canonical_unit+':'+q.source_offset+':'+q.context,kind:'quantity',data_status:'unclassified_source_statement',source_id:source.id,...q,display:`${fmt(q.canonical_value)} ${q.canonical_unit}（原始：${q.original}）[${source.id}]`,scope:'Unit arithmetic checked; source statement itself is not independently verified.'}));}
function previousYearDate(date){const [y,m,d]=date.split('-').map(Number);const lastDay=new Date(Date.UTC(y-1,m,0)).getUTCDate();return `${y-1}-${String(m).padStart(2,'0')}-${String(Math.min(d,lastDay)).padStart(2,'0')}`;}
function anchor(result,target){const candidates=result.points.filter(p=>p.date<=target);const point=candidates.at(-1);if(!point)return null;const lag=(Date.parse(target)-Date.parse(point.date))/86400000;const max=result.frequency==='monthly'?35:7;if(lag>max)return null;return {...point,target_date:target,lag_days:lag,policy:'latest observed point on or before target; never use a later point'};}
export function seriesFacts(run,result){
 const dateLabel=result.frequency==='monthly'?'觀察月份':'觀察日期',showDate=d=>result.frequency==='monthly'?d.slice(0,7):d;
 const out=[],unit=result.unit,id=result.id,kind=['CPIAUCSL','CPIAUCNS'].includes(result.series_id)?'index':unit.startsWith('%')?'rate':'price';
 out.push(addFact(run,{key:id+':latest',kind:'observation',result_id:id,source_id:result.source_id,value:result.last.value,date:result.last.date,unit,display:`${result.title}為 ${fmt(result.last.value)} ${unit}（${dateLabel}：${showDate(result.last.date)}）[${id}]`}));
 const baseOptions=[{label:'所選觀察期間',type:'window',base:result.first},{label:'年初至今',type:'ytd',base:anchor(result,(Number(result.last.date.slice(0,4))-1)+'-12-31')},{label:'按年',type:'year_on_year',base:anchor(result,previousYearDate(result.last.date))}];
 for(const option of baseOptions){const base=option.base;if(!base||base.date===result.last.date)continue;
  // Monthly YoY must match the same calendar month, not merely a previous release.
  if(option.type==='year_on_year'&&result.frequency==='monthly'&&base.date.slice(5,7)!==result.last.date.slice(5,7))continue;
  if(option.type==='ytd'&&result.frequency==='monthly')continue;
  const delta=result.last.value-base.value,pct=base.value===0?null:delta/Math.abs(base.value)*100;
  const change=kind==='rate'?`${delta>=0?'+':''}${fmt(delta)} 個百分點（${delta>=0?'+':''}${fmt(delta*100,1)} 個基點）`:pct===null?'基準為零，無法計算百分比':`${pct>=0?'+':''}${fmt(pct,2)}%`;
  const fact={key:id+':'+option.type,kind:'comparison',comparison:option.type,result_id:id,source_id:result.source_id,base:{date:base.date,value:base.value,target_date:base.target_date||base.date},end:result.last,delta,change_pct:kind==='rate'?null:pct,percentage_points:kind==='rate'?delta:null,basis_points:kind==='rate'?delta*100:null,unit,display:`${result.title}${option.label}變化為 ${change}（${showDate(base.date)}：${fmt(base.value)} → ${showDate(result.last.date)}：${fmt(result.last.value)} ${unit}）[${id}]`};
  out.push(addFact(run,fact));
 }
 return out;
}
export function auditAnswer(answer,run){
 const facts=run.facts||[],issues=evidenceIssues(answer,run);const tokens=[...answer.matchAll(/\{\{(F\d+)\}\}/g)].map(m=>m[1]);for(const id of tokens)if(!facts.some(f=>f.id===id))issues.push({code:'unknown_fact',message:`Unknown bound fact ${id}.`});
 for(const line of answer.split('\n')){
  const comparisons=[...line.matchAll(/\{\{(F\d+)\}\}/g)].map(m=>facts.find(f=>f.id===m[1])).filter(f=>f?.kind==='comparison');
  if(/同期|同一期間|同一時段|same period/i.test(line)&&!/(?:非|不|不能|不可|並不|並非).{0,4}(?:同期|同一期間|同一時段)/.test(line)&&new Set(comparisons.map(f=>f.base.date+':'+f.end.date)).size>1)issues.push({code:'inconsistent_comparison_period',message:'This paragraph calls differing observation windows the same period. State each actual window and remove the same-period conclusion, or obtain matching observations. '+line.slice(0,700)});
  for(const token of line.matchAll(/\{\{(F\d+)\}\}/g)){
   const f=facts.find(f=>f.id===token[1]);if(!f||f.kind!=='quantity')continue;
   // A source's increment cannot silently become an absolute production/export level.
   if(f.quantity_role==='change'&&!/變化|增加|減少|下降|上升|升幅|跌幅|新增|增量|減量|注入|注氣|注气|提取|增長|差額|變動|環比|按週|增產|減產|高於|低於|較(?:上|去|前|五年|同)|change|increase|decrease|rise|fall|injection|withdrawal|addition|growth|more than|less than/i.test(line.replace(/\{\{F\d+\}\}/g,'')))issues.push({code:'quantity_role_mismatch',message:`${f.id} is a source CHANGE, not an absolute level. Claim: ${line}. Exact source context: ${f.context}. Choose only a fact with the correct measure AND period; otherwise omit this claim and explain the gap.`});
  }
  const sourceRefs=refs(line).filter(id=>id.startsWith('S'));
  for(const clause of line.split(/[。；;!?！？]/)){
   const withoutBindings=clause.replace(/\{\{F\d+\}\}/g,'').replace(/\[(?:source:)?[SRF]\d+\]/g,'').replace(/^\s*(?:#+|\d+[.)、])\s*/,'').replace(/(?:10|十)\s*(?:年期|[ -]year)/gi,'');
   if(refs(clause).some(id=>id.startsWith('R')&&run.results.some(r=>r.id===id&&r.points?.length))&&/\d/.test(withoutBindings))issues.push({code:'unbound_series_number',message:'Series-derived numbers/dates must use exact {{F#}} facts, not rewritten prose. Check only this clause: '+clause.slice(0,500)});
  }
  const quantities=extractQuantities(line.replace(/\{\{F\d+\}\}/g,'')).filter(q=>/億|亿|兆/.test(q.original));
  if(quantities.length||/[零〇一二兩两三四五六七八九十百千萬万點点]+\s*(?:萬億|万亿|億|亿|兆)\s*立方(?:英尺|英呎|呎)/.test(line.replace(/\{\{F\d+\}\}/g,'')))issues.push({code:'unbound_volume_quantity',message:'Every Chinese-scale gas volume, including summaries, table labels and repeated explanations, must use a bound {{F#}} fact. Do not manually repeat or round these values; omit unsupported numerical estimates or explain qualitatively. Claim: '+line.slice(0,900)});
  for(const q of quantities){const evidence=facts.filter(f=>f.kind==='quantity'&&sourceRefs.includes(f.source_id));if(!evidence.length)continue;const correct=evidence.some(f=>f.daily===q.daily&&Math.abs(f.canonical_value-q.canonical_value)<1e-6);if(!correct)issues.push({code:'unit_mismatch',message:`Quantity ${q.original} does not match cited source conversions. Do not replace it with a different measure or period merely to pass validation. Recheck the original source and select the exact fact; omit the claim if no evidence matches. Claim: ${line.slice(0,500)}`});}
 }
 const unknown=refs(answer).filter(id=>id[0]==='R'?!run.results.some(r=>r.id===id):id[0]==='S'?!run.sources.some(s=>s.id===id):!facts.some(f=>f.id===id));if(unknown.length)issues.push({code:'unknown_reference',message:'Unknown references: '+[...new Set(unknown)].join(', ')});
 return {passed:issues.length===0,issues:[...new Map(issues.map(i=>[i.code+':'+i.message,i])).values()],bound_fact_ids:[...new Set(tokens)],coverage:'Checks bound numeric facts, cited gas-volume conversions and series-derived numeric prose. Does not prove every market claim or source is correct.'};
}
export function materializeAnswer(answer,run){return answer.replace(/\{\{(F\d+)\}\}/g,(_,id)=>run.facts.find(f=>f.id===id)?.display||`[未核實數值 ${id}]`);}
