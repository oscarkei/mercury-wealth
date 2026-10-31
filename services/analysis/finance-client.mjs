import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
const python=process.env.MERCURY_FINANCE_PYTHON||fileURLToPath(new URL('../../.venv-finance/bin/python',import.meta.url));
let worker=null,sequence=0,pending=new Map(),queue=Promise.resolve();
function start(){
 if(worker)return worker;
 const child=spawn(python,['-B','finance-worker.py'],{cwd:fileURLToPath(new URL('.',import.meta.url)),env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,MERCURY_FINANCE_CACHE_DIR:process.env.MERCURY_FINANCE_CACHE_DIR,PYTHONUNBUFFERED:'1',PYTHONDONTWRITEBYTECODE:'1'},stdio:['pipe','pipe','inherit']});worker=child;
 createInterface({input:child.stdout}).on('line',line=>{let r;try{r=JSON.parse(line);}catch{return;}const p=pending.get(r.id);if(p&&p.child===child){r.error?p.finish(Error(r.error)):p.finish(null,r.result);}});
 const fail=()=>{if(worker===child)worker=null;for(const p of [...pending.values()])if(p.child===child)p.finish(Error('Finance worker stopped.'));};child.on('error',fail);child.on('exit',fail);return child;
}
export function financeCall(name,args,signal){
 const next=queue.then(()=>{signal?.throwIfAborted();const child=start();return new Promise((resolve,reject)=>{
  const id=++sequence;
  const stop=error=>{if(worker===child)worker=null;child.kill();finish(error);};
  const onAbort=()=>stop(Error('Finance calculation cancelled.'));
  const timer=setTimeout(()=>stop(Error('Finance calculation timed out.')),110000);
  function finish(error,result){if(!pending.has(id))return;pending.delete(id);clearTimeout(timer);signal?.removeEventListener('abort',onAbort);error?reject(error):resolve(result);}
  pending.set(id,{child,finish});signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted){onAbort();return;}
  child.stdin.write(JSON.stringify({id,name,args})+'\n',error=>{if(error)stop(Error('Finance worker input failed.'));});
 });});queue=next.catch(()=>{});return next;
}
export function closeFinance(){worker?.kill();}
