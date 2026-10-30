// Server/local CLI only; not imported by any client component.
import {demoSeedPlan,demoHoldingIds,type SeedRow} from './portfolio-seed.ts';
import {portfolioSnapshotSchema,type PortfolioSnapshot} from './portfolio-contract.ts';
import {SNAPSHOT,DEMO_DATE} from './domain.ts';
const PROJECT_URL='https://ljrnllkklsumizsxhpwu.supabase.co';
export class PortfolioDataError extends Error{}
export function databaseConfigured(){return Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY);}
export function databaseRequest(fetcher:typeof fetch=fetch){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(url!==PROJECT_URL||!key?.startsWith('sb_secret_'))throw new PortfolioDataError('Database setup is incomplete.');
 return async(table:string,query:string,rows?:SeedRow[])=>{
  if(!demoSeedPlan.some(p=>p.table===table))throw new PortfolioDataError('Unsupported database table.');
  try{
   const response=await fetcher(`${url}/rest/v1/${table}?${query}`,{method:rows?'POST':'GET',headers:{apikey:key,Accept:'application/json',...(rows?{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'}:{})},body:rows?JSON.stringify(rows):undefined,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error();
   if(rows)return [];
   const result:unknown=await response.json();if(!Array.isArray(result))throw new Error();return result as SeedRow[];
  }catch{throw new PortfolioDataError('Supabase data is unavailable. Retry or check the database connection.');}
 };
}
export function seedQuery(rows:SeedRow[]){return new URLSearchParams({select:Object.keys(rows[0]).join(','),id:'in.('+rows.map(r=>r.id).join(',')+')'}).toString();}
export function verifySeedRows(expected:SeedRow[],actual:SeedRow[],allowMissing=false){
 const ids=new Set(actual.map(r=>r.id));
 if(ids.size!==actual.length||(!allowMissing&&actual.length!==expected.length))throw new PortfolioDataError('The saved demo snapshot is incomplete.');
 for(const row of actual){const original=expected.find(r=>r.id===row.id);if(!original||Object.keys(original).some(key=>row[key]!==original[key]))throw new PortfolioDataError('The saved demo snapshot differs from the approved sample. No records were overwritten.');}
}
export async function loadDatabasePortfolio(fetcher:typeof fetch=fetch):Promise<PortfolioSnapshot>{
 const request=databaseRequest(fetcher);
 const entries=await Promise.all(demoSeedPlan.map(async plan=>{const rows=await request(plan.table,seedQuery(plan.rows));verifySeedRows(plan.rows,rows);return [plan.table,rows] as const;}));
 const tables=Object.fromEntries(entries);
 const find=(table:string,id:unknown)=>{const row=tables[table].find(r=>r.id===id);if(!row)throw new PortfolioDataError('The saved demo relationships are incomplete.');return row;};
 const holdings=demoHoldingIds.map(h=>{
  const position=find('mercury_position',h.positionId),instrument=find('mercury_instrument',position.instrument_id),portfolio=find('mercury_portfolio',position.portfolio_id),account=find('mercury_account',portfolio.account_id),bank=find('mercury_custodian',account.custodian_id);
  const owners=tables.mercury_account_owner.filter(r=>r.account_id===account.id);if(owners.length!==1)throw new PortfolioDataError('Unexpected demo ownership.');
  const owner=find('mercury_client',owners[0].client_id);
  // Asset-class classification is supplied by the approved snapshot until the V2 classification catalogue is implemented.
  return {id:h.uiId,name:instrument.name,category:h.category,value:position.market_value_base,owner:owner.name,bank:bank.name,currency:instrument.currency};
 });
 return portfolioSnapshotSchema.parse({source:'supabase',dataMode:'mock',snapshot:SNAPSHOT,asOf:DEMO_DATE,retrievedAt:new Date().toISOString(),holdings,total:holdings.reduce((n,h)=>n+Number(h.value),0)});
}
