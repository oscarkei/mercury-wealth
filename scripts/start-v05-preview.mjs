// Isolated localhost preview. No key file, debugger, production deployment, or persistent analysis store.
import http from 'node:http';
import {spawn,fork} from 'node:child_process';
import {once} from 'node:events';
import {createVercelChat} from '../services/analysis/vercel/service.mjs';
import {closeFinance} from '../services/analysis/finance-client.mjs';
const port=3012,webPort=3013,origin='http://127.0.0.1:'+port;
const web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(webPort)],{env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'production',MERCURY_PUBLIC_MOCK:'1'},stdio:'ignore'});
web.on('error',()=>{console.error('Preview web could not start.');process.exit(1);});
const workers=new Set();
let chat=createVercelChat({key:null,origins:[origin]}),configured=false,expiresAt=0,timer;
function connect(key,expiry=Date.now()+20*60000){
 const research=args=>new Promise((resolve,reject)=>{
  const {signal,onEvent,...safe}=args;
  const worker=fork(new URL('./v05-research-worker.mjs',import.meta.url),[],{execArgv:[],stdio:['ignore','ignore','ignore','ipc']});
  workers.add(worker);let settled=false;
  const abort=()=>{worker.kill();reject(Error('Cancelled.'));};signal?.addEventListener('abort',abort,{once:true});
  worker.on('message',message=>{if(message.type==='event')onEvent(message.event);if(message.type==='result'){settled=true;signal?.removeEventListener('abort',abort);resolve(message.run);}if(message.type==='error')reject(Error(message.error));});
  worker.on('error',reject);worker.on('exit',code=>{workers.delete(worker);signal?.removeEventListener('abort',abort);if(!settled)reject(Error('Research worker exited before completion.'));});
  worker.once('message',message=>{if(message.type==='ready')worker.send({key,args:safe});});
 });
 chat=createVercelChat({key,origins:[origin],research});configured=true;expiresAt=Math.min(expiry,Date.now()+20*60000);timer=setTimeout(stop,Math.max(1,expiresAt-Date.now()));
}
process.once('message',message=>{if(message?.type==='existing-test-key'){connect(message.key,message.expiresAt);delete message.key;process.disconnect();}});
function stop(){clearTimeout(timer);for(const worker of workers)worker.kill();chat=null;closeFinance();web.kill();server.close();setTimeout(()=>process.exit(0),250).unref();}
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,origin).pathname;
 if(req.headers.host!=='127.0.0.1:'+port){res.writeHead(403);res.end();return;}
 if(path==='/connect'){
  if(req.method==='POST'){
   if(req.headers.origin!==origin||configured){res.writeHead(403);res.end();return;}
   let raw='';for await(const c of req){raw+=c;if(raw.length>1000){res.writeHead(413);res.end();return;}}
   let key=new URLSearchParams(raw).get('key')?.trim();raw='';
   if(!key||key.length<12||key.length>500){res.writeHead(400);res.end('Invalid key format.');return;}
   connect(key);key='';
   res.writeHead(303,{Location:'/connect','Cache-Control':'no-store'});res.end();return;
  }
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"});
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mercury v0.5 本機測試</title><style>body{background:#f6f7f2;color:#193c35;font:16px system-ui;max-width:420px;margin:60px auto;padding:24px}input,button,a{font:inherit;box-sizing:border-box}input{width:100%;padding:14px;margin:12px 0}button{padding:14px 20px;background:#193c35;color:white;border:0;border-radius:12px}p{line-height:1.7}</style><h1>Mercury v0.5</h1>${configured?'<p>測試 key 已接駁。20 分鐘後自動關閉，唔會寫入檔案。</p><a href="/phone?size=actual#chat">打開獨立手機預覽</a>':'<p>請輸入原有 DeepSeek key，只保留喺本機程序記憶體。此頁與正式網站、3001／3009 分開。</p><form method="POST" autocomplete="off"><label for="key">DeepSeek API key</label><input id="key" name="key" type="password" autocomplete="off" required minlength="12" maxlength="500"><button type="submit">連接測試 · 20 分鐘</button></form>'}`);return;
 }
 if(path==='/preview-status'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({configured,expiresAt,version:'0.5.0-alpha.1'}));return;}
 if(['/api/session','/api/cloud-chat'].includes(path)){
  const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
  try{const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>280000){res.writeHead(413);res.end();return;}chunks.push(c);}
   const response=await chat.handle(new Request(origin+req.url,{method:req.method,headers:req.headers,signal:abort.signal,...(chunks.length?{body:Buffer.concat(chunks)}:{})}));
   // Local loopback preview only; production keeps Secure cookies.
   const headers=Object.fromEntries(response.headers);if(headers['set-cookie'])headers['set-cookie']=headers['set-cookie'].replace('; Secure','');
   res.writeHead(response.status,headers);res.flushHeaders();if(response.body){const reader=response.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;if(res.destroyed){await reader.cancel();break;}if(!res.write(value))await Promise.race([once(res,'drain'),once(res,'close')]);}}res.end();
  }catch{if(!res.headersSent)res.writeHead(500);res.end('Preview request could not complete.');}return;
 }
 if(path.startsWith('/api/')){res.writeHead(404);res.end();return;}
 const upstream=http.request({hostname:'127.0.0.1',port:webPort,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode||502,r.headers);r.pipe(res);});upstream.on('error',()=>{res.writeHead(503);res.end('Preview is starting.');});req.pipe(upstream);
});
server.listen(port,'127.0.0.1',()=>console.log('Isolated preview: '+origin+'/connect'));
server.on('error',()=>{web.kill();console.error('Preview port is unavailable.');process.exit(1);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,stop);
