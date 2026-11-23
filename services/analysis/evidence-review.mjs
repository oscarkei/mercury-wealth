import {activeResults} from './conversation-policy.mjs';

function contradictsLockedWeight(answer, run) {
 const rebalances = activeResults({...run,results:run.results || []}).filter(r=>r.kind==='portfolio_rebalance');
 const locked = rebalances.at(-1)?.data?.locked_symbols || [];
 if(!locked.length)return false;
 return answer.split(/[。；;，,\n]/).some(clause=>
  locked.some(symbol=>clause.toUpperCase().includes(symbol)) &&
  /全組合|整體組合|整個組合|整个组合|整体组合|whole portfolio|total portfolio/i.test(clause) &&
  /(?:權重|佔比|占比|权重|比重).{0,8}(?:上升|增加|提高|下跌|下降|減少|减少)|(?:weight|share).{0,12}(?:increases?|falls?|rises?|decreases?)/i.test(clause) &&
  !/不會|不会|並無|没有|沒有|不變|不变|unchanged|does not|will not/i.test(clause));
}

// Narrow regression guardrails; not a general causal-truth classifier.
export function evidenceIssues(answer,run){
 const issues=[];if(run.language==='zh-Hant'&&(answer.match(/美国|经济|数据|价格|预测|实际|观察|风险|产量|供应|库存|市场/g)||[]).length>=4)issues.push({code:'language_changed',message:'The selected language is Traditional Chinese (繁體中文 / zh-Hant), but this draft uses Simplified Chinese extensively. Return the COMPLETE research in Traditional Chinese, keeping all facts and IDs intact.'});let heading='';const year=Number(run.date?.slice(0,4)),month=Number(run.date?.slice(5,7));const lastDay=run.date?new Date(Date.UTC(year,month,0)).getUTCDate():31;
 for(const line of answer.split('\n')){
  if(/^#{1,4} /.test(line))heading=line;
  const clean=line.replace(/\{\{F\d+\}\}/g,'');
  if(run.date&&Number(run.date.slice(8,10))<lastDay&&new RegExp(`(?:本月|當月|${month}\\s*月).{0,6}(?:全月|整月)(?:平均|產量|數據|口徑|數字)?`).test(clean)&&!/預測|預估|估計|尚未|未完成|不可|不能|並非|不是/.test(clean))issues.push({code:'incomplete_month',message:'The current month is not complete. State the actual through-date and month-to-date/estimate status; do not call it a completed full-month observation. '+line});
  if(/(?:EIA|BLS|BEA|SEC).{0,8}未公布(?:具體)?(?:數值|數據|數字)/i.test(clean))issues.push({code:'absence_overclaim',message:'Failure to retrieve a number does not prove the agency did not publish it. Say it was not obtained in the consulted source; do not claim the agency never published it. '+line});
  if(/(?:[12]H\d{2}|\d{4}H[12]|上半年|下半年).{0,35}(?:的季度|季度路徑|quarterly path)/i.test(clean))issues.push({code:'half_year_as_quarter',message:'H1/H2 are half-year periods, not quarters. Preserve the actual forecast target period. '+line});
  if(/(?:本月|當月|\d{1,2}\s*月)\s*至今/.test(clean)&&!/截至|截止|報導時點|報道時點|未註明|未注明|未明|不明|未提供|through|cutoff/i.test(clean))issues.push({code:'missing_mtd_cutoff',message:'Month-to-date requires a through-date. If the source does not provide one, explicitly label the observation cutoff unspecified; publication date is not automatically the cutoff. '+line});
  if(/淨\s*LNG\s*出口|LNG\s*淨出口/.test(clean)&&!(run.sources||[]).some(s=>/net (?:LNG|liquefied natural gas) exports|LNG net exports|淨\s*LNG\s*出口|LNG\s*淨出口/i.test((s.content||'')+' '+(s.excerpt||''))))issues.push({code:'unsupported_net_label',message:'The supplied source says LNG exports, not net LNG exports. Do not add a net/gross qualifier without source support; retain the original measure name. '+line});
  const used=[...line.matchAll(/\{\{(F\d+)\}\}/g)].map(m=>run.facts?.find(f=>f.id===m[1])).filter(Boolean);
  if(/(?:屬|全部|均為|：|:)\s*預測|forecasts? only/i.test(heading+line)&&used.some(f=>f.data_status?.startsWith('historical'))&&!/歷史|觀察|實際|historical|observed/i.test(line))issues.push({code:'observation_as_forecast',message:'A bound historical observation is presented as a forecast. Label each datum separately and separate historical data from forecast targets/vintages. '+line});
  if(/(?:第四季|第四季度|Q4|餘下|剩餘).{0,45}(?:必須|必然|一定|勢必|must)/i.test(clean)&&/(?:年|全年|年度).{0,25}(?:預測|目標)|預測.{0,25}(?:全年|年度)/.test(answer)&&!/不能|不可|不足以|無法|未能/.test(clean))issues.push({code:'unsupported_annual_bridge',message:'Do not infer the remaining quarter MUST accelerate from a weekly/annual comparison. A valid bridge requires comparable year-to-date actuals, day weighting and the same vintage; otherwise state a conditional scenario without necessity. '+line});
 }
 const allocations = activeResults({...run,results:run.results || []}).filter(r=>['allocation','performance'].includes(r.kind));
 const measured = allocations.filter(r=>r.data?.pairwise_daily_correlation);
 const eligibleFacts = new Set((run.facts || []).filter(f=>f.measure==='pairwise_daily_correlation' && measured.some(r=>r.id===f.result_id)).map(f=>f.id));
 if(eligibleFacts.size){
  for(const sentence of answer.split(/[。！？\n]|(?<=\.)\s+/)){
   if(!/相關(?:性|係數)|相关(?:性|系数)|correlat(?:ion|ed)/i.test(sentence))continue;
   if(!/(?:偏高|偏低|較高|较高|很高|很低|接近|極弱|极弱|微弱|不高|不強|不强|平均|範圍|范围|係數為|系数为|[+-]?\d*\.\d+|high|strong|weak|near.zero|low|mean)/i.test(sentence.replace(/\{\{F\d+\}\}/g,'')))continue;
   const bound=[...sentence.matchAll(/\{\{(F\d+)\}\}/g)].some(m=>eligibleFacts.has(m[1]));
   if(!bound)issues.push({code:'unbound_sample_correlation',message:'Use a returned pairwise daily correlation fact token in this same sentence or omit the sample correlation claim.'});
   if(/(?:相關係數|相关系数|correlation|平均|範圍|范围|mean|range)\s*(?:約為|约为|為|为|約|约|係|is|of|was|=|:|：)?\s*[-+−]?\d*\.\d+/i.test(sentence))issues.push({code:'rewritten_correlation',message:'Remove manually written correlation coefficients; use the bound correlation fact only.'});
  }
 }
 if(allocations.length && allocations.every(r=>{
  const corr=r.data?.pairwise_daily_correlation;
  return corr && Math.max(Math.abs(corr.min),Math.abs(corr.max)) < 0.1;
 })){
  const sentences=answer.split(/[。！？\n]/);
  for(const sentence of sentences){
   const discussesCorrelation=/相[關关]|correlat/i.test(sentence) || [...sentence.matchAll(/\{\{(F\d+)\}\}/g)].some(m=>eligibleFacts.has(m[1]));
   const limitsDiversification=/(?:分散(?:化|風險|风险)?(?:的)?(?:作用|效果|空間|空间|能力|效益|得益)|(?:可|能)分散的(?:空間|空间)).{0,10}(?:有限|狹窄|狭窄|不足|很小)|(?:limited|little|poor) diversification/i.test(sentence);
   if(discussesCorrelation && limitsDiversification)issues.push({code:'confused_diversification_baseline',message:'Low correlation supports diversification. The measured small difference is the incremental volatility reduction versus an ALREADY diversified equal-weight basket at identical cash. Do not call diversification itself limited or attribute limited diversification to low correlation. Simply compare the two computed volatilities.'});
  }
  const clauses=answer.split(/[。；;，,\n]/);
  const claimsHigh=clauses.some(c=>
   /相[關关]性(?:偏高|很高|[較较]高|高企|高|很[強强]|偏[強强])|高度(?:正)?相[關关]|highly correlated|(?:strong|high) (?:positive )?correlations?/i.test(c) &&
   !/不代表|並非|并非|未見|未见|未能|並無|不支持|not |no evidence|cannot infer/i.test(c));
  if(claimsHigh)issues.push({code:'unsupported_high_sample_correlation',message:'Every measured pair of daily returns in the selected sample has absolute correlation below 0.1. Use the computed correlation fact or omit the claim. Keep sector concentration separate from sample correlation.'});
 }
 if(measured.length && measured.every(r=>r.data.data_mode==='demo')){
  for(const clause of answer.split(/[。；;，,\n]/)){
   const correlationMention=/相[關关]|correlat|independen|獨立|独立/i.test(clause);
   if(!correlationMention || /(?:不能|不可|未能|無法|无法|不足以|不等於|不等于|cannot|does not imply|not evidence)/i.test(clause))continue;
   const assertedRealHigh=/(?:實際|实际|真實|真实|現實|现实|real[- ](?:world|market)|actual).{0,40}(?:高相[關关]|相[關关].{0,6}(?:偏高|較高|较高|性高)|high(?:ly)? correlat)/i.test(clause);
   const assertsIndependence=/(?:彼此|互相|統計上|统计上|相互|mutually|statistically)\s*(?:獨立|独立|independent)/i.test(clause);
   if(assertedRealHigh || assertsIndependence)issues.push({code:'correlation_extrapolation',message:'Use only measured pairwise daily sample correlations. Generated prices cannot establish real-market correlation, and near-zero correlation does not establish independence. Remove that inference; simply give the observed sample range or its limitation.'});
  }
 }
 if(contradictsLockedWeight(answer,run))issues.push({code:'locked_weight_change',message:'A locked position keeps its value and percentage of the unchanged total. Distinguish a share within its category from a whole-portfolio weight. Use the calculated rows.'});
 return issues;
}

const correlationErrors = new Set([
 'unbound_sample_correlation', 'rewritten_correlation', 'unsupported_high_sample_correlation',
 'correlation_extrapolation', 'confused_diversification_baseline'
]);

// If only the interpretation failed, the accepted tool results still answer the question.
export function calculationSummary(run, issues) {
 if (!issues.length || !issues.every(issue => correlationErrors.has(issue.code))) return '';
 const fresh = run.results.slice(run.result_start_index || 0)
  .filter(result => result.kind === 'performance' || result.kind === 'allocation');
 const sections = [];
 for (const result of fresh) {
  if (result.scope_key && result.scope_key !== run.portfolio_scope?.key) return '';
  const facts = run.facts.filter(fact => fact.result_id === result.id);
  const corr = facts.find(fact => fact.measure === 'pairwise_daily_correlation');
  if (!corr) return '';
  let key = 'summary';
  let lead = result.title;
  if (result.kind === 'performance') {
   const rows = result.data.rows.filter(row => Number.isFinite(row.volatility_pct));
   if (!rows.length) return '';
   key = rows.reduce((highest, row) => row.volatility_pct > highest.volatility_pct ? row : highest).symbol;
   lead = run.language === 'en' ? 'Highest annualized volatility in the sample' :
    run.language === 'zh-Hans' ? '样本内年化波动最高' : '樣本內年化波動最高';
  }
  const primary = facts.find(fact => fact.key === result.id + ':' + key);
  if (!primary) return '';
  sections.push(lead + ' — {{' + primary.id + '}}。\n\n{{' + corr.id + '}}。');
 }
 if (!sections.length) return '';
 if (fresh.every(result => result.data.data_mode === 'demo')) {
  sections.push(run.language === 'en' ? 'These calculations use generated sample prices.' :
   run.language === 'zh-Hans' ? '以上计算采用示范日线。' : '以上計算採用示範日線。');
 }
 return sections.join('\n\n');
}
