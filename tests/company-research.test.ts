import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCompanyRSS,parseFilings,parseFinancialFacts} from '../src/lib/company-evidence-server.ts';
import {safeEvidenceLink,companyEvidenceSchema} from '../src/lib/company-evidence-contract.ts';
import {loadPortfolioContext} from '../src/lib/portfolio-context-server.ts';
import {calculatePortfolioExposure} from '../src/lib/portfolio-impact.ts';
import {marketToolRegistry,toolIds} from '../src/lib/tool-definitions.ts';
const query={symbols:['NVDA'],startDate:'2025-10-01',endDate:'2026-10-23'},stamp='2026-10-27T00:00:00Z';
test('RSS filters unrelated and post-window news; marks title-only coverage and rejects unsafe links',()=>{
 const item=(title:string,date:string,url='https://finance.yahoo.com/news/story')=>`<item><title>${title}</title><pubDate>${date}</pubDate><link>${url}</link></item>`;
 const parsed=parseCompanyRSS('<rss>'+item('NVIDIA earnings release','Tue, 20 Oct 2026 12:00:00 GMT')+item('NVDA latest news','Mon, 26 Oct 2026 12:00:00 GMT')+item('Unrelated company','Tue, 20 Oct 2026 12:00:00 GMT')+item('NVIDIA malicious','Tue, 20 Oct 2026 12:00:00 GMT','javascript:alert(1)')+'</rss>','NVDA',query,stamp);
 assert.equal(parsed.length,1);assert.equal(parsed[0].coverage,'headline');assert.equal(parsed[0].eventDate,null);assert.equal(safeEvidenceLink('https://www.sec.gov.evil.example/a'),false);assert.equal(safeEvidenceLink('http://127.0.0.1/key'),false);
});
test('SEC filings preserve publication and reporting dates and exclude future disclosures',()=>{
 const result=parseFilings({filings:{recent:{form:['10-Q','8-K','10-Q'],filingDate:['2026-08-28','2026-10-25','2026-09-01'],reportDate:['2026-07-26','2026-10-25','2026-08-01'],accessionNumber:['0001045810-26-000001','0001045810-26-000002','bad'],items:['','2.02','']}}},'NVDA','0001045810',query,stamp);
 assert.equal(result.length,1);assert.equal(result[0].publishedAt,'2026-08-28');assert.equal(result[0].eventDate,'2026-07-26');assert.equal(result[0].coverage,'filing_metadata');
});
test('financial facts use as-of revisions and like-duration YoY, not annual/quarter mixes',()=>{
 const base={accn:'0001045810-26-000001',form:'10-Q'};
 const facts=parseFinancialFacts({facts:{'us-gaap':{Revenues:{units:{USD:[{...base,start:'2026-04-27',end:'2026-07-26',filed:'2026-08-28',val:150},{...base,start:'2026-04-27',end:'2026-07-26',filed:'2026-10-26',val:999},{...base,start:'2025-04-28',end:'2025-07-27',filed:'2025-08-28',val:100},{...base,start:'2025-01-01',end:'2025-12-31',filed:'2026-02-01',val:900}]}}}}},'NVDA','0001045810',query,stamp);
 const current=facts.find(f=>f.comparisonId)!;assert.equal(current.value,150);assert.equal(current.yoyPct,50);assert.equal(current.periodKind,'Quarter');assert.equal(facts.find(f=>f.id===current.comparisonId)?.value,100);
});
const scope={household:'hh_okonkwo' as const,bank:'all',book:'all'};
function fixture(value=1000,foreign=false){return {household:[{id:'hh_okonkwo',name:'Test household'}],account:[{id:'acct_test',household_id:foreign?'hh_foreign':'hh_okonkwo',custodian_id:'cust_test',account_number:'masked'}],portfolio:[{id:'pf_test',account_id:'acct_test',name:'Test book'}],account_owner:[{id:'owner_test',account_id:'acct_test',client_id:'client_test'}],client:[{id:'client_test',household_id:'hh_okonkwo',name:'Test client'}],custodian:[{id:'cust_test',name:'Test bank'}],position_valuation:[{id:'pos_test',portfolio_id:'pf_test',instrument_id:'inst_nvda',quantity:5,market_value_base_amount:value,market_value_base_currency:'USD',market_value_amount:value,market_value_currency:'USD',unrealized_pnl_amount:200,unrealized_pnl_currency:'USD',valued_at:'2026-06-19'}],instrument:[{id:'inst_nvda',name:'NVIDIA',short_name:'NVIDIA',type_id:'itype_ord_share',primary_ticker:'NVDA'}],instrument_type:[{id:'itype_ord_share',code:'ORD',category:'Equity',label:'Ordinary Share'}],instrument_classification:[],classification_value:[]};}
test('UI/Chat database read model joins scoped live rows, reflects changed valuations, and rejects foreign household records',async()=>{
 const saved=[process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY];process.env.SUPABASE_URL='https://ljrnllkklsumizsxhpwu.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';
 const mock=(value=1000,foreign=false)=>async(url:RequestInfo|URL,init?:RequestInit)=>{
  assert.equal(init?.body,undefined);assert.equal(init?.method,undefined);
  const parsed=new URL(String(url)),table=parsed.pathname.split('mercury_v1_')[1] as keyof ReturnType<typeof fixture>;
  if(String(table)==='imports')return Response.json([]);assert.ok(parsed.searchParams.get('_import_id'));if(table==='account')assert.equal(parsed.searchParams.get('household_id'),'eq.hh_okonkwo');if(table==='position_valuation')assert.equal(parsed.searchParams.get('portfolio_id'),'in.(pf_test)');
  return Response.json(fixture(value,foreign)[table]);
 };
 try{
  const a=await loadPortfolioContext(scope,undefined,mock() as typeof fetch),b=await loadPortfolioContext(scope,undefined,mock(2000) as typeof fetch);
  assert.equal(a.total,1000);assert.equal(a.holdings[0].cost,800);assert.equal(b.total,2000);assert.notEqual(a.version,b.version);
  const impact=calculatePortfolioExposure(a,['NVDA','META','AMD'],scope);assert.equal(impact.directWeightPct,100);assert.equal(impact.rows[1].status,'not_directly_held');assert.equal(impact.rows[1].weightPct,0);assert.equal(impact.source,'supabase');
  await assert.rejects(()=>loadPortfolioContext(scope,undefined,mock(1000,true) as typeof fetch),/Cross-household/);
  await assert.rejects(()=>loadPortfolioContext({...scope,book:'pf_other'},undefined,mock() as typeof fetch),/Unknown portfolio/);
  await assert.rejects(()=>loadPortfolioContext(scope,undefined,(async()=>Response.json({error:'offline'},{status:503})) as typeof fetch),/read failed/);
 }finally{for(const [i,key] of ['SUPABASE_URL','SUPABASE_SECRET_KEY'].entries())if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];}
});
test('tool registry is unique, declares privacy/limits, and registers both evidence and portfolio paths',()=>{
 assert.equal(new Set(toolIds).size,toolIds.length);for(const name of ['company_news','company_filings','financial_facts','portfolio_context','portfolio_exposure'])assert.ok(toolIds.includes(name as typeof toolIds[number]));
 assert.equal(marketToolRegistry.find(t=>t.id==='portfolio_context')?.privacy,'demo_context');assert.ok(marketToolRegistry.every(t=>t.timeoutMs>0&&t.input&&t.output));
 assert.equal(companyEvidenceSchema.safeParse({query,items:[],warnings:[],tools:['run_sql'],retrievedAt:stamp}).success,false);
});

test('portfolio route uses approved demo context and explains deterministic exposure through Gemini',async()=>{
 const {runPlannedAssistant}=await import('../src/lib/fed-engine.ts');
 const original=globalThis.fetch,keys=['GEMINI_API_KEY','SUPABASE_URL','SUPABASE_SECRET_KEY','LAYA_BASE_URL','LAYA_API_KEY'];
 const saved=keys.map(k=>process.env[k]);Object.assign(process.env,{GEMINI_API_KEY:'synthetic-key',SUPABASE_URL:'https://ljrnllkklsumizsxhpwu.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',LAYA_BASE_URL:'http://127.0.0.1:8888',LAYA_API_KEY:'synthetic-local'});
 const providerInputs:string[]=[],events:any[]=[];
 globalThis.fetch=async(url,init)=>{
  const u=new URL(String(url));
  if(u.hostname==='generativelanguage.googleapis.com'){
   providerInputs.push(String(init?.body));
   return Response.json({model:'gemini-3.5-flash-lite',status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(providerInputs.length>1?{sections:[{heading:'Your exposure',text:'The researched positions represent {{exposure.weight}} of your selected snapshot. Indirect exposure is not measured.'}]}:{workflow:'portfolio_impact',tools:['portfolio_context','portfolio_exposure'],goal:'Review direct exposure',analysisQuestions:['Match researched stocks to authorized holdings']})}]}]});
  }
  if(u.hostname==='127.0.0.1')return Response.json({model:'multilingual',answers:{panel:{type:'choice',choice:'exposure_summary',confidence:1,probabilities:{exposure_summary:1}}},usage:{input_tokens:1,output_tokens:1}});
  assert.equal(u.hostname,'ljrnllkklsumizsxhpwu.supabase.co');if(u.pathname.endsWith('mercury_v1_imports'))return Response.json([]);return Response.json(fixture(9876543)[u.pathname.split('mercury_v1_')[1] as keyof ReturnType<typeof fixture>]);
 };
 try{
  await runPlannedAssistant({requestId:'bcf4c0e7-f2fb-43df-bf4f-78df5564fb14',revision:1,message:'What is the impact on my portfolio?',context:'Private customer identity',view:'overview',product:'phoenix',path:[100,98,96,94,97,95,92],history:[{role:'assistant',text:'Private customer identity holds 9876543'}],portfolioScope:scope,researchContext:{task:'history',symbols:['NVDA','META','AMD'],startDate:'2025-10-27',endDate:'2026-10-23',objective:'min_variance',cashPct:10,maxAssetPct:60,capital:1000000,costBps:10}},AbortSignal.timeout(5000),e=>events.push(e));
  assert.equal(providerInputs.length,2);assert.match(providerInputs[0],/Private customer identity/);assert.match(providerInputs[1],/9876543/);assert.match(providerInputs[1],/Test household/);
  assert.equal(events.some(e=>e.type==='error'),false);assert.equal(events.find(e=>e.type==='portfolio_impact')?.portfolioImpact.directValue,9876543);assert.equal(events.find(e=>e.type==='reply')?.provider,'Gemini');assert.equal(events.some(e=>e.type==='research_analysis'),false);
 }finally{globalThis.fetch=original;keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);}
});

test('company narrative rejects free-form financial figures, repairs once, and preserves verified identifiers/citations',async()=>{
 const {explainCompanyResearch}=await import('../src/lib/company-research-engine.ts');
 const original=globalThis.fetch,saved=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='synthetic-key';
 const evidence=companyEvidenceSchema.parse({query,items:[{id:'news_test',symbol:'NVDA',kind:'news',title:'NVIDIA MI450 test fixture',summary:'Synthetic product identifier',url:'https://finance.yahoo.com/news/fixture',publisher:'Test source',publishedAt:'2026-10-20',eventDate:null,retrievedAt:stamp,coverage:'headline'},{id:'fact_test',symbol:'NVDA',kind:'financial_fact',title:'Revenue',summary:'Synthetic reported value',url:'https://www.sec.gov/Archives/fixture',publisher:'Test SEC',publishedAt:'2026-08-20',eventDate:'2026-07-31',retrievedAt:stamp,coverage:'reported_fact',value:150,unit:'USD'}],warnings:[],tools:['company_news','financial_facts'],retrievedAt:stamp});
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({model:'gemini-3.5-flash-lite',status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify({sections:[{heading:'Facts',text:calls===1?'Revenue was {{fact_test.value}}.':'The source mentions {{verifiedIdentifiers.0}}. Reported revenue increased [E2].',kind:'fact',evidenceIds:['E1']},{heading:'Limits',text:'The evidence does not prove causation.',kind:'limitation',evidenceIds:[]}]})}]}]});};
 try{const result=await explainCompanyResearch('Why?',{data:{histories:[]}} as any,evidence,AbortSignal.timeout(5000),()=>{});assert.deepEqual(result.explanation.sections[0].evidenceIds,['news_test','fact_test']);assert.equal(result.explanation.sections[0].text,'The source mentions MI450. Reported revenue increased.');assert.equal(calls,2);}finally{globalThis.fetch=original;saved===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=saved;}
});


test('company financial figures bind to the matching issuer, period and evidence item',async()=>{
 const {explainCompanyResearch}=await import('../src/lib/company-research-engine.ts');
 const original=globalThis.fetch,saved=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='synthetic-key';
 const evidence=companyEvidenceSchema.parse({query:{...query,symbols:['NVDA','AMD']},items:[{id:'revenue_nvda',symbol:'NVDA',kind:'financial_fact',title:'Revenue',summary:'Synthetic revenue',url:'https://www.sec.gov/Archives/fixture',publisher:'Test SEC',publishedAt:'2026-08-20',eventDate:'2026-07-31',periodEnd:'2026-07-31',retrievedAt:stamp,coverage:'reported_fact',value:150,unit:'USD'}],warnings:[],tools:['financial_facts'],retrievedAt:stamp});
 let wrong=false,calls=0;globalThis.fetch=async()=>{calls++;return Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify({sections:[{heading:'Reported revenue',text:wrong?'AMD revenue was {{E1.value}}.':'{{E1.symbol}} reported revenue of {{E1.value}} for the period ending {{E1.periodEnd}}.',kind:'fact',evidenceIds:['E1']}]})}]}]});};
 try{const result=await explainCompanyResearch('Revenue?',{data:{histories:[]}} as any,evidence,AbortSignal.timeout(5000),()=>{});assert.match(result.explanation.sections[0].text,/NVDA reported revenue of 150 USD/);assert.match(result.explanation.sections[0].text,/2026-07-31/);assert.equal(calls,1);wrong=true;await assert.rejects(()=>explainCompanyResearch('Revenue?',{data:{histories:[]}} as any,evidence,AbortSignal.timeout(5000),()=>{}),/issuer mismatch/);}finally{globalThis.fetch=original;saved===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=saved;}
});
