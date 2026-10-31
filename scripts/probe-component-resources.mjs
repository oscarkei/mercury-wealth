// Offline per-component diagnosis. Sequential fresh processes prevent artificial co-residency.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const report={status:'running',provider_calls:0,platform:process.platform,ui_mode:'deepseek',laya_installed:false,cases:[],limits:['Isolated library totals overlap shared dependencies; do not add them together.','Import footprints do not include optimization/backtest peaks.','Cgroup file cache is separate from process RSS and can be reclaimed.']};
const started=performance.now();
for(const name of ['finance','openbb','riskfolio','bt','quantstats','financetoolkit']){
 const python=process.env[name==='laya'?'MERCURY_LAYA_PYTHON':'MERCURY_FINANCE_PYTHON'];
 const result=await new Promise(resolve=>{
  const child=spawn(python,['-B','scripts/probe-component-memory.py',name],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});
  let output='',errors='';const timer=setTimeout(()=>child.kill('SIGKILL'),100000);
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1000000)child.kill();});
  child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-2000);});
  child.on('error',e=>{clearTimeout(timer);resolve({case:name,status:'failed',error:e.code});});
  child.on('exit',(code,signal)=>{clearTimeout(timer);try{resolve({...JSON.parse(output.trim().split('\n').at(-1)),exit_code:code});}catch{resolve({case:name,status:'failed',exit_code:code,signal,error:errors.slice(-400)});}});
 });
 report.cases.push(result);console.error(JSON.stringify({stage:'component-profile',case:name,status:result.status}));
}
report.elapsed_ms=Math.round(performance.now()-started);
report.status=report.cases.every(r=>r.status==='passed')?'passed':'partial';
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
