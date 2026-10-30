import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
const python=process.env.MERCURY_LAYA_PYTHON||fileURLToPath(new URL('../../.venv-laya/bin/python',import.meta.url));
export function startLaya(){
 const child=spawn(python,['-B','laya-worker.py'],{cwd:fileURLToPath(new URL('.',import.meta.url)),env:{PATH:'/usr/bin:/bin',PYTHONUNBUFFERED:'1',MERCURY_LAYA_MODEL_PATH:process.env.MERCURY_LAYA_MODEL_PATH},stdio:['pipe','pipe','inherit']});
 const pending=new Map();let next=0,info=null,fail=null,readyResolve,readyReject;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});ready.catch(()=>{});
 const startup=setTimeout(()=>{fail=Error('Laya startup timed out');readyReject(fail);child.kill();},60000);
 createInterface({input:child.stdout}).on('line',line=>{let r;try{r=JSON.parse(line);}catch{return;}if(r.type==='ready'){info=r;clearTimeout(startup);readyResolve(r);return;}const p=pending.get(r.id);if(p){pending.delete(r.id);clearTimeout(p.timer);r.error?p.reject(Error(r.error)):p.resolve(r);}});
 child.on('error',e=>{fail=e;clearTimeout(startup);readyReject(e);});child.on('exit',()=>{fail=Error('Laya worker stopped');clearTimeout(startup);readyReject(fail);for(const p of pending.values()){clearTimeout(p.timer);p.reject(fail);}pending.clear();});
 return {ready,get info(){return info;},get error(){return fail?.message;},async select(state){await ready;if(fail)throw fail;return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('Laya UI selection timed out'));},30000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,state})+'\n');});},close(){child.kill('SIGTERM');}};
}
