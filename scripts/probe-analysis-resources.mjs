// Offline deployment probe: real workers, synthetic prices, no API keys or model-provider calls.
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {startLaya} from '../services/analysis/laya-client.mjs';
import {financeCall,closeFinance} from '../services/analysis/finance-client.mjs';

const started=performance.now();
let peakKiB=0,samples=0,samplingError;
function sample(){
 try{
  const probe=spawnSync('ps',['-axo','pid=,ppid=,rss='],{encoding:'utf8',timeout:2000});
  if(probe.error||probe.status!==0)throw probe.error||Error('ps-failed');
  const rows=probe.stdout.trim().split('\n').map(s=>s.trim().split(/\s+/).map(Number));
  const ids=new Set([process.pid]);let changed=true;
  while(changed){changed=false;for(const [pid,parent] of rows)if(ids.has(parent)&&!ids.has(pid)){ids.add(pid);changed=true;}}
  // Exclude the short-lived ps command used by the measurement itself.
  const total=rows.filter(([pid])=>ids.has(pid)&&pid!==probe.pid).reduce((sum,[,,rss])=>sum+rss,0);
  peakKiB=Math.max(peakKiB,total);samples++;
 }catch(error){samplingError=error.code||'ps-unavailable';}
}
sample();const timer=setInterval(sample,500),laya=startLaya();
const report={platform:process.platform,architecture:process.arch,node:process.version,provider_calls:0,fixture:'synthetic offline resource test',checks:{},limits:['Local RSS samples are not a Vercel/Linux memory benchmark.','No cloud build, cold-start, external data fetch or DeepSeek conversation is verified.','Finance tests cover package presence and one FinanceToolkit/QuantStats calculation, not every tool.']};
let failed=false;
try{
 const [loaded,finance]=await Promise.all([laya.ready,financeCall('health',{},AbortSignal.timeout(110000))]);
 report.checks.startup={laya:loaded,finance};
 const decision=await laya.select('The user asks for a price trend. Verified historical observations are available. Select supported UI.');
 report.checks.ui={values:decision.values,elapsed_ms:decision.elapsed_ms};
 const points=Array.from({length:60},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),close:100+0.1*i+Math.sin(i)*0.3}));
 const history={histories:[{symbol:'OFFLINE_TEST',status:'observed',stale:false,first_date:points[0].date,last_date:points.at(-1).date,points}]};
 const metrics=await financeCall('metrics',{history},AbortSignal.timeout(110000));
 report.checks.finance_metrics={library:metrics.library,rows:metrics.rows.length};sample();
}catch(error){failed=true;report.error=String(error.message||error);}
finally{
 clearInterval(timer);sample();laya.close();closeFinance();
 report.elapsed_ms=Math.round(performance.now()-started);
 report.sampled_process_tree_peak_mib=samples?Math.round(peakKiB/1024):null;
 report.memory_samples=samples;if(samplingError)report.sampling_error=samplingError;
 report.status=failed?'failed':'passed';
 if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify(report));if(failed)process.exitCode=1;
}
