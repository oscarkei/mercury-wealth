import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
const python=process.env.MERCURY_FINANCE_PYTHON||fileURLToPath(new URL('../../.venv-finance/bin/python',import.meta.url));
let worker=null,sequence=0,pending=new Map(),queue=Promise.resolve();
function start(){
 if(worker)return;
 worker=spawn(python,['-B','finance-worker.py'],{cwd:fileURLToPath(new URL('.',import.meta.url)),env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,PYTHONUNBUFFERED:'1',PYTHONDONTWRITEBYTECODE:'1'},stdio:['pipe','pipe','inherit']});
 createInterface({input:worker.stdout}).on('line',line=>{let r;try{r=JSON.parse(line);}catch{return;}const p=pending.get(r.id);if(p){clearTimeout(p.timer);pending.delete(r.id);r.error?p.reject(Error(r.error)):p.resolve(r.result);}});
 const fail=()=>{worker=null;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Finance worker stopped.'));}pending.clear();};worker.on('error',fail);worker.on('exit',fail);
}
export function financeCall(name,args,signal){const next=queue.then(()=>{signal?.throwIfAborted();start();return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);worker?.kill();reject(Error('Finance calculation timed out.'));},110000);pending.set(id,{resolve,reject,timer});worker.stdin.write(JSON.stringify({id,name,args})+'\n');});});queue=next.catch(()=>{});return next;}
export function closeFinance(){worker?.kill();}
