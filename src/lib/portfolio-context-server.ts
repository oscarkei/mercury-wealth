// Server-only read model for the fixed imported mock dataset. Approved mock facts
// are supplied to DeepSeek by wealthContext; credentials and account numbers are excluded.
import {rev4Positions} from './rev4-portfolio-extension.ts';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {familySnapshotSchema,type FamilySnapshot} from './family-contract.ts';
import verification from './okonkwo-verification.json' with {type:'json'};
const ROOT='https://ljrnllkklsumizsxhpwu.supabase.co';
export const portfolioScopeSchema=z.object({household:z.literal('hh_okonkwo'),bank:z.string().max(60),book:z.string().max(80)}).strict();
export type PortfolioScope=z.infer<typeof portfolioScopeSchema>;
const tables=['household','account','portfolio','position_valuation','client','custodian','account_owner','instrument','instrument_type','portfolio_sleeve','instrument_classification','classification_value'] as const;
type Row=Record<string,any>;
const scalar=(row:Row,key:string,original:string)=>row[key]??row._source_json?.[original];
export async function loadPortfolioContext(scope:PortfolioScope,signal?:AbortSignal,fetcher:typeof fetch=fetch):Promise<FamilySnapshot>{
 portfolioScopeSchema.parse(scope);
 if(process.env.SUPABASE_URL!==ROOT||!process.env.SUPABASE_SECRET_KEY?.startsWith('sb_secret_'))throw Error('Supabase portfolio is not configured.');
 const query=async(table:typeof tables[number],filters:Record<string,string>)=>{
  const q=new URLSearchParams({select:'*',_import_id:'eq.'+verification.importId,...filters,limit:'1000'});
  const r=await fetcher(ROOT+'/rest/v1/mercury_v1_'+table+'?'+q,{headers:{apikey:process.env.SUPABASE_SECRET_KEY!,Accept:'application/json'},signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(10000)]),cache:'no-store',redirect:'error'});
  if(!r.ok)throw Error('Supabase portfolio read failed.');const rows=await r.json();if(!Array.isArray(rows)||rows.length>=1000)throw Error('Incomplete portfolio response.');return rows as Row[];
 };
 const inside=(ids:string[])=>'in.('+ids.map(id=>{if(!/^[a-zA-Z0-9_.-]+$/.test(id))throw Error('Invalid database identifier.');return id;}).join(',')+')';
 const households=await query('household',{id:'eq.'+scope.household});if(households.length!==1||scalar(households[0],'id','id')!==scope.household)throw Error('Selected household is unavailable.');
 const accounts=await query('account',{household_id:'eq.'+scope.household});if(accounts.some(a=>scalar(a,'household_id','householdId')!==scope.household))throw Error('Cross-household records rejected.');if(!accounts.length)throw Error('No accounts in the selected household.');
 const accountIds=accounts.map(a=>String(scalar(a,'id','id')));
 const [portfolios,owners,clients,custodians]=await Promise.all([query('portfolio',{account_id:inside(accountIds)}),query('account_owner',{account_id:inside(accountIds)}),query('client',{household_id:'eq.'+scope.household}),query('custodian',{id:inside([...new Set(accounts.map(a=>String(scalar(a,'custodian_id','custodianId'))))])})]);
 const find=(rows:Row[],id:unknown)=>{const r=rows.find(r=>scalar(r,'id','id')===id);if(!r)throw Error('Incomplete portfolio relationships.');return r;};
 const allBanks=new Set(custodians.map(r=>String(scalar(r,'name','name'))));if(scope.bank!=='all'&&!allBanks.has(scope.bank))throw Error('Unknown custodian scope.');
 if(scope.book!=='all'&&!portfolios.some(p=>scalar(p,'id','id')===scope.book))throw Error('Unknown portfolio scope.');
 const books=portfolios.filter(p=>(scope.book==='all'||scalar(p,'id','id')===scope.book)&&(scope.bank==='all'||scalar(find(custodians,scalar(find(accounts,scalar(p,'account_id','accountId')),'custodian_id','custodianId')),'name','name')===scope.bank));
 if(!books.length)throw Error('No portfolio matches the selected account scope.');
 let positions=await query('position_valuation',{portfolio_id:inside(books.map(p=>String(scalar(p,'id','id'))))});
 const extension=(await rev4Positions(fetcher,signal)).filter((p:Row)=>books.some(b=>scalar(b,'id','id')===scalar(p,'portfolio_id','portfolioId')));
 for(const replacement of extension){positions=positions.filter(p=>scalar(p,'id','id')!==scalar(replacement,'id','id'));positions.push(replacement);}
 if(!positions.length)return familySnapshotSchema.parse({source:'supabase',household:String(scalar(households[0],'name','name')),householdId:scope.household,dataMode:'mock',asOf:'2026-06-19',retrievedAt:new Date().toISOString(),holdings:[],total:0,version:'empty:'+scope.book,warnings:[]});
 const instrumentIds=[...new Set(positions.map(p=>String(scalar(p,'instrument_id','instrumentId'))))];
 const instruments=await query('instrument',{id:inside(instrumentIds)});
 const types=await query('instrument_type',{id:inside([...new Set(instruments.map(i=>String(scalar(i,'type_id','typeId'))))])});
 const typeCategory=(type:Row):'equity'|'bond'|'cash'|'note'|'alternative'=>{
  const text=String(scalar(type,'code','code')||'')+' '+String(scalar(type,'category','category')||'')+' '+String(scalar(type,'label','label')||'');
  if(/cash|deposit|money.market/i.test(text))return 'cash';if(/structured|accumulator|note|derivative/i.test(text))return 'note';if(/bond|fixed.income/i.test(text))return 'bond';if(/equity|share|etf|fund/i.test(text))return 'equity';return 'alternative';
 };
 const assignments=await query('instrument_classification',{instrument_id:inside(instrumentIds)});
 const classes=await query('classification_value',{dimension_id:'eq.dim_asset_class'});
 const holdings=positions.map(p=>{
  const book=find(books,scalar(p,'portfolio_id','portfolioId')),account=find(accounts,scalar(book,'account_id','accountId')),instrument=find(instruments,scalar(p,'instrument_id','instrumentId')),type=find(types,scalar(instrument,'type_id','typeId'));
  const value=Number(p.market_value_base_amount??p._source_json?.marketValueBase?.amount),baseCurrency=String(p.market_value_base_currency??p._source_json?.marketValueBase?.currency);
  const pnl=Number(p.unrealized_pnl_amount??p._source_json?.unrealizedPnl?.amount),pnlCurrency=String(p.unrealized_pnl_currency??p._source_json?.unrealizedPnl?.currency);
  const marketValue=Number(p.market_value_amount??p._source_json?.marketValue?.amount),marketCurrency=String(p.market_value_currency??p._source_json?.marketValue?.currency);
  if(!Number.isFinite(value)||baseCurrency!=='USD')throw Error('Portfolio requires a valid USD base valuation.');
  // Convert P&L using the valuation's own base/local ratio, never a current FX quote.
  const pnlUSD=pnlCurrency==='USD'?pnl:pnlCurrency===marketCurrency&&marketValue>0?pnl*value/marketValue:NaN;
  if(!Number.isFinite(pnlUSD))throw Error('Missing consistent base-currency cost evidence.');
  const names=owners.filter(o=>scalar(o,'account_id','accountId')===scalar(account,'id','id')).map(o=>String(scalar(find(clients,scalar(o,'client_id','clientId')),'name','name')));
  if(!names.length)throw Error('Missing account ownership.');
  const classAssignment=assignments.filter(a=>scalar(a,'instrument_id','instrumentId')===scalar(instrument,'id','id')&&classes.some(c=>scalar(c,'id','id')===scalar(a,'classification_value_id','classificationValueId'))).sort((a,b)=>Number(scalar(b,'weight_pct','weightPct'))-Number(scalar(a,'weight_pct','weightPct')))[0];
  const classCode=classAssignment?String(scalar(find(classes,scalar(classAssignment,'classification_value_id','classificationValueId')),'code','code')):'';
  const classMap:Record<string,'equity'|'bond'|'cash'|'alternative'>={EQUITY:'equity',FIXED_INCOME:'bond',CASH:'cash',ALTERNATIVES:'alternative'};
  const category=typeCategory(type)==='note'?'note':classMap[classCode]||typeCategory(type);
  return {id:String(scalar(p,'id','id')),name:String(scalar(instrument,'short_name','shortName')||scalar(instrument,'name','name')),fullName:String(scalar(instrument,'name','name')),category,value,cost:value-pnlUSD,owner:names.join(' & '),owners:names,bank:String(scalar(find(custodians,scalar(account,'custodian_id','custodianId')),'name','name')),currency:marketCurrency,book:String(scalar(book,'name','name')),bookId:String(scalar(book,'id','id')),account:String(scalar(account,'account_number','accountNumber')),sleeve:String(scalar(p,'sleeve_id','sleeveId')||''),quantity:Number(scalar(p,'quantity','quantity')),instrumentId:String(scalar(instrument,'id','id')),symbol:scalar(instrument,'primary_ticker','primaryTicker')||null,instrumentType:String(scalar(type,'code','code')||scalar(type,'label','label')),valuedAt:String(scalar(p,'valued_at','valuedAt')).slice(0,10)};
 });
 const dates=[...new Set(holdings.map(h=>h.valuedAt))].sort();
 const version=createHash('sha256').update(JSON.stringify({scope,holdings})).digest('hex').slice(0,20);
 return familySnapshotSchema.parse({source:'supabase',household:String(scalar(households[0],'name','name')),householdId:scope.household,dataMode:'mock',asOf:dates[0],retrievedAt:new Date().toISOString(),holdings,total:holdings.reduce((n,h)=>n+h.value,0),version,warnings:dates.length>1?['Holdings have different valuation dates; each date is shown separately.']:[]});
}
