import {spawn, type ChildProcess} from 'node:child_process';

export const hybridBase='http://127.0.0.1:3009';
type Health={listening:boolean;ready:boolean;failed?:boolean};
type Environment=Record<string,string|undefined>;

// Pass only settings used by the analysis service and its workers.
export function analysisEnvironment(source:Environment):NodeJS.ProcessEnv {
 const env:NodeJS.ProcessEnv={NODE_ENV:source.NODE_ENV==='development'||source.NODE_ENV==='test'?source.NODE_ENV:'production',PATH:source.PATH||'/usr/bin:/bin',TZ:'Asia/Hong_Kong',PROTOTYPE_PORT:'3009'};
 for(const name of ['HOME','DEEPSEEK_API_KEY','MERCURY_LAYA_PYTHON','MERCURY_LAYA_MODEL_PATH','MERCURY_FINANCE_PYTHON','EIA_API_KEY','BEA_API_KEY']) {
  if(source[name])env[name]=source[name];
 }
 return env;
}

async function health():Promise<Health> {
 try {
  const response=await fetch(hybridBase+'/api/health',{cache:'no-store',signal:AbortSignal.timeout(1500)});
  if(!response.ok)return {listening:true,ready:false,failed:true};
  const data=await response.json();
  return {listening:true,ready:data.ready===true&&data.model==='deepseek-flash'&&data.laya?.type==='ready',failed:Boolean(data.layaError)};
 }catch{return {listening:false,ready:false};}
}

export function createHybridService(options:{
 env?:Environment;
 readHealth?:()=>Promise<Health>;
 start?:()=>ChildProcess;
 sleep?:()=>Promise<void>;
 attempts?:number;
}={}) {
 const env=options.env||process.env;
 const readHealth=options.readHealth||health;
 const sleep=options.sleep||(()=>new Promise<void>(resolve=>setTimeout(resolve,1000)));
 let starting:Promise<boolean>|undefined;
 let ownedChild:ChildProcess|undefined;
 return function ensureHybrid():Promise<boolean> {
  // Local child processes, loopback authorization and model files require a host,
  // not an ephemeral Vercel function. Never weaken authorization to work around it.
  if(env.VERCEL)return Promise.resolve(false);
  if(starting)return starting;
  starting=(async()=>{
   let status=await readHealth();
   if(status.ready)return true;
   if(status.failed)return false;
   let failed=false;
   if(!status.listening&&!ownedChild) {
    try {
     const child=options.start?.()||spawn(process.execPath,['server.mjs'],{
      cwd:env.MERCURY_HYBRID_DIR||process.cwd()+'/services/analysis',
      env:analysisEnvironment(env),detached:true,stdio:'ignore'
     });
     ownedChild=child;
     const stopped=()=>{failed=true;if(ownedChild===child)ownedChild=undefined;};
     // spawn reports missing executables/directories asynchronously.
     child.once('error',stopped);
     child.once('exit',stopped);
     child.unref();
    }catch{return false;}
   }
   const deadline=Date.now()+65000;
   for(let attempt=0;attempt<(options.attempts??65)&&Date.now()<deadline;attempt++) {
    await sleep();
    if(failed)return false;
    status=await readHealth();
    if(status.ready)return true;
    if(status.failed)return false;
   }
   return false;
  })().finally(()=>{starting=undefined;});
  return starting;
 };
}

export const ensureHybrid=createHybridService();
