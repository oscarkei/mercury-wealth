import nextEnv from '@next/env';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
import {demoSeedPlan} from '../src/lib/portfolio-seed.ts';
import {databaseRequest,seedQuery,verifySeedRows,loadDatabasePortfolio} from '../src/lib/supabase-portfolio-server.ts';
const project=fileURLToPath(new URL('../',import.meta.url));
nextEnv.loadEnvConfig(project,false,{info(){},error(){}});
try{
 writeFileSync(new URL('../../Mercury Supabase Demo Seed.json',import.meta.url),JSON.stringify({mode:'fictional-demo-only',tables:demoSeedPlan},null,2)+'\n');
 const request=databaseRequest();
 // Check every target before writing; never update/delete existing rows.
 const existing=await Promise.all(demoSeedPlan.map(async plan=>{const rows=await request(plan.table,seedQuery(plan.rows));verifySeedRows(plan.rows,rows,true);return rows;}));
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({status:'reviewed',newRows:demoSeedPlan.reduce((n,p,i)=>n+p.rows.length-existing[i].length,0),tables:demoSeedPlan.length}));}
 else{
  for(const [i,plan] of demoSeedPlan.entries()){
   const missing=plan.rows.filter(r=>!existing[i].some(e=>e.id===r.id));
   if(missing.length)await request(plan.table,'on_conflict=id',missing);
  }
  const snapshot=await loadDatabasePortfolio();
  const report={status:'seeded_and_verified',snapshot:snapshot.snapshot,holdings:snapshot.holdings.length,totalUSD:snapshot.total,tables:demoSeedPlan.length,insertOnly:true,verifiedAt:new Date().toISOString()};
  writeFileSync(new URL('../../Mercury Supabase Seed Verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }
}catch{console.error('Seed setup stopped: connection unavailable or existing demo IDs differ. No existing rows were overwritten. A partial insert can be retried safely.');process.exitCode=1;}
