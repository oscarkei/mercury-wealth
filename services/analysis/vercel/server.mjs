import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createVercelChat} from './service.mjs';
import {createCloudResearch} from '../cloud/research.mjs';
import {closeFinance} from '../finance-client.mjs';
const key=process.env.DEEPSEEK_API_KEY;
const origins=[process.env.MERCURY_PUBLIC_ORIGIN||'https://mercury-wealth-mu.vercel.app',...['VERCEL_URL','VERCEL_BRANCH_URL'].flatMap(k=>process.env[k]?['https://'+process.env[k]]:[])];
const chat=createVercelChat({key,secret:process.env.MERCURY_SESSION_SECRET||key,origins,research:createCloudResearch({key})});
const web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],{stdio:'inherit',env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'production',MERCURY_PUBLIC_MOCK:'1'}});
web.on('error',()=>process.exit(1));web.on('exit',code=>process.exit(code||0));
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://gateway').pathname;
 if(['/api/session','/api/cloud-chat'].includes(path)){
  const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});req.on('aborted',()=>abort.abort());
  try{
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>280000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
   const response=await chat.handle(new Request('https://'+req.headers.host+req.url,{method:req.method,headers:req.headers,signal:abort.signal,...(chunks.length?{body:Buffer.concat(chunks)}:{})}));
   res.writeHead(response.status,Object.fromEntries(response.headers));res.flushHeaders();
   if(response.body){const reader=response.body.getReader();try{while(true){const {done,value}=await reader.read();if(done)break;if(res.destroyed){await reader.cancel();break;}if(!res.write(value))await Promise.race([once(res,'drain'),once(res,'close')]);}}finally{reader.releaseLock();}}
   res.end();
  }catch{if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Cloud request interrupted.'}));}
  return;
 }
 // The public deployment never forwards local administrative or data APIs.
 if(path.startsWith('/api/')){res.writeHead(404);res.end();return;}
 const upstream=http.request({hostname:'127.0.0.1',port:3100,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode||502,r.headers);r.pipe(res);});
 upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Retry-After':'2'});res.end('Mercury is starting. Please refresh shortly.');});req.pipe(upstream);
});
// Expose the container port only after Next can answer: the first cold request
// must not receive a transient 503 while the private web process is starting.
async function waitForWeb(){
 for(let attempt=0;attempt<100;attempt++){
  const ready=await new Promise(resolve=>{const probe=http.request({hostname:'127.0.0.1',port:3100,path:'/',method:'HEAD',timeout:1000},response=>{response.resume();resolve(true);});probe.on('timeout',()=>probe.destroy());probe.on('error',()=>resolve(false));probe.end();});
  if(ready)return;await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw Error('Mobile web process did not become ready.');
}
server.headersTimeout=15000;server.requestTimeout=300000;
await waitForWeb();server.listen(Number(process.env.PORT||8080),'0.0.0.0');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{closeFinance();web.kill();server.close();setTimeout(()=>process.exit(0),1000).unref();});
