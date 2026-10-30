import {capability,loadPortfolio} from './portfolio-bridge.mjs';
import {closeFinance} from './finance-client.mjs';
import {providerStatus} from './extended-catalog.mjs';
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {research,visibleRun} from './engine.mjs';
import {startLaya} from './laya-client.mjs';
import {tools,MODEL} from './catalog.mjs';
import {getProposals} from './adviser-proposals.mjs';
const root=fileURLToPath(new URL('.',import.meta.url)),data=join(root,'data');await mkdir(data,{recursive:true});
const laya=startLaya();process.on('SIGTERM',()=>{laya.close();closeFinance();process.exit(0);});process.on('SIGINT',()=>{laya.close();closeFinance();process.exit(0);});
const port=Number(process.env.PROTOTYPE_PORT||3009),origin='http://127.0.0.1:'+port,key=process.env.DEEPSEEK_API_KEY,runs=new Map(),scopeSelections=new Map();let busy=false,showcase=null,comparison=null;
let secret;try{secret=Buffer.from((await readFile(join(data,'session-secret'),'utf8')).trim(),'hex');if(secret.length!==32)throw Error('Invalid session secret.');}catch(error){if(error.code!=='ENOENT')throw error;secret=randomBytes(32);await writeFile(join(data,'session-secret'),secret.toString('hex'),{flag:'wx',mode:0o600});}
const selectedScope=owner=>{const choice=scopeSelections.get(owner)||{book:'all',bank:'all'};return capability(owner,choice.book,choice.bank);};
async function ownedRun(id,owner){if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))return undefined;let run=runs.get(id);if(!run)try{run=JSON.parse(await readFile(join(data,'private-run-'+id+'.json'),'utf8'));if(run.id!==id)run=undefined;}catch{}return run?.owner===owner?run:undefined;}
try{comparison=JSON.parse(await readFile(join(data,'comparison.json'),'utf8'));}catch{}
try{showcase=JSON.parse(await readFile(join(data,'showcase.json'),'utf8'));}catch{}
const sign=v=>createHmac('sha256',secret).update(v).digest('hex');
function session(req,res){const raw=req.headers.cookie?.match(/(?:^|;\s*)mercury_hybrid=([a-f0-9]+\.[a-f0-9]+)/)?.[1];if(raw){const[id,sig]=raw.split('.');const expected=sign(id);if(sig.length===expected.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return id;}const id=randomBytes(16).toString('hex');res.setHeader('Set-Cookie','mercury_hybrid='+id+'.'+sign(id)+'; HttpOnly; SameSite=Strict; Path=/');return id;}
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
const staticFiles={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/widget-lab':['widget-lab.html','text/html'],'/widget-lab.js':['widget-lab.js','text/javascript'],'/widget-lab.css':['widget-lab.css','text/css'],'/mercury-black.png':['mercury-black.png','image/png'],'/mercury-white.png':['mercury-white.png','image/png'],'/baseline.json':['baseline.json','application/json'],'/previous-run.json':['previous-run.json','application/json'],'/validation-tests.json':['validation-tests.json','application/json']};
http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!=='127.0.0.1:'+port)return json(res,403,{error:'Local host only.'});
  const path=new URL(req.url,origin).pathname;
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
  if(req.method==='GET'&&path==='/api/health')return json(res,200,{prototype:true,version:'conversation-flow-v6.4',ready:!!key&&!!laya.info,laya:laya.info,layaError:laya.error,model:MODEL,productionPortUntouched:3001,privateDataTools:true,demoHousehold:"hh_okonkwo",readOnly:true});
  if(req.method==='GET'&&path==='/api/catalog')return json(res,200,{providers:providerStatus(),tools:tools.filter(t=>t.function.name!=='render_ui').map(t=>({name:t.function.name,description:t.function.description})),model:MODEL});
  if(req.method==='GET'&&path==='/api/showcase')return json(res,200,{run:showcase,comparison});
  if(req.method==='GET'&&path==='/api/widget-lab'){
   const owner=session(req,res),scope=selectedScope(owner);
   const snapshot=await loadPortfolio(scope);
   const proposalRun={portfolio_scope:scope,sources:[],results:[]};
   const proposals=getProposals({},proposalRun).result.data;
   const saved=JSON.parse(await readFile(join(root,'public','validation-tests.json'),'utf8'));
   const intel=saved.runs.find(r=>r.test_label==='Intel · 快速概覽');
   const prices=(intel?.results||[]).filter(r=>r.kind==='observed_price'&&['CBOE:INTC','CBOE:AMD'].includes(r.series_id)).map(r=>({symbol:r.series_id.slice(5),unit:r.unit,first:r.first,last:r.last,points:r.points,source:'OpenBB / Cboe',recorded:intel.completed_at||'2026-10-30',adjustmentVerified:false}));
   const allocation=[...snapshot.holdings.reduce((m,h)=>(m.set(h.category,(m.get(h.category)||0)+h.value),m),new Map())].map(([category,value])=>({category,value,pct:snapshot.total?value/snapshot.total*100:0})).sort((a,b)=>b.value-a.value);
   return json(res,200,{prices,portfolio:{asOf:snapshot.asOf,total:snapshot.total,pnl:snapshot.pnl,book:snapshot.book,allocation,source:'Supabase · Okonkwo demo'},proposals:{asOf:proposals.sourceAsOf,records:proposals.records.map(p=>({id:p.id,title:p.title,book:p.book,status:p.status,created:p.created,before:p.before,proposed:p.proposed,summary:p.summary})),categories:proposals.categories,source:'Mercury adviser source records'},note:'OpenBB widget specification study. This page renders Mercury-owned components, not OpenBB Workspace widgets or live quotes.'});
  }
  if(req.method==='GET'&&path.startsWith('/api/runs/')){const owner=session(req,res),run=await ownedRun(path.slice(10),owner);return json(res,run?200:404,run?{run:visibleRun(run)}:{error:'Run unavailable.'});}
  if(path==='/api/portfolio/scope'&&['GET','POST'].includes(req.method)){
   const owner=session(req,res);
   if(req.method==='POST'&&(req.headers.origin!==origin||req.headers['content-type']!=='application/json'))return json(res,403,{error:'Same-origin session required.'});
   const snapshot=await loadPortfolio(capability(owner));
   if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000)return json(res,413,{error:'Scope request too large.'});}const body=JSON.parse(raw),bank=body.bank||'all';if(Object.keys(body).some(k=>!['book','bank'].includes(k))||typeof body.book!=='string'||typeof bank!=='string'||(body.book!=='all'&&!snapshot.books.some(b=>b.id===body.book))||(bank!=='all'&&!snapshot.books.some(b=>b.bank===bank))||(body.book!=='all'&&bank!=='all'&&!snapshot.books.some(b=>b.id===body.book&&b.bank===bank)))return json(res,403,{error:'Scope is outside this authorized demo household.'});scopeSelections.set(owner,{book:body.book,bank});}
   return json(res,200,{scope:selectedScope(owner),household:snapshot.household,dataMode:'mock',asOf:snapshot.asOf,books:snapshot.books});
  }
  if(req.method==='POST'&&path==='/api/chat'){
   if(req.headers.origin!==origin||req.headers['content-type']!=='application/json')return json(res,403,{error:'Same-origin JSON requests only.'});
   const owner=session(req,res);if(!key)return json(res,503,{error:'Prototype DeepSeek connection not configured; 3001 remains unchanged.'});if(!laya.info)return json(res,503,{error:'Laya 正在載入，請稍後再試。'});if(busy)return json(res,429,{error:'另一項研究進行中，請稍後再試。'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000)return json(res,413,{error:'Question too long.'});}let body;try{body=JSON.parse(raw);}catch{return json(res,400,{error:'Invalid request.'});}
   if(Object.keys(body).some(k=>!['question','previousId','mode','language','followupIndex'].includes(k)))return json(res,400,{error:'Unsupported chat parameters.'});
   if(typeof body.question!=='string'||!body.question.trim()||body.question.length>2500)return json(res,400,{error:'Enter a question up to 2500 characters.'});
   const mode=body.mode==='deepseek'?'deepseek':'hybrid';const publicPrevious=[showcase,comparison].find(r=>r&&body.previousId&&r.id===body.previousId&&r.question==='美國能源市場而家點睇');const ownedPrevious=await ownedRun(body.previousId,owner);const previous=body.previousId?(ownedPrevious||(publicPrevious?{...publicPrevious,owner}:undefined)):undefined;if(body.previousId&&previous?.owner!==owner)return json(res,403,{error:'Conversation does not belong to this session.'});
   const portfolioScope=selectedScope(owner);
   if(previous?.portfolio_scope&&previous.portfolio_scope.key!==portfolioScope.key)return json(res,403,{error:'Portfolio scope changed; start a new question in this scope.'});
   let selectedFollowup;
   if(body.followupIndex!==undefined){if(!Number.isInteger(body.followupIndex)||!ownedPrevious)return json(res,403,{error:'Invalid follow-up session.'});selectedFollowup=ownedPrevious.followups?.[body.followupIndex];if(!selectedFollowup||selectedFollowup.question!==body.question.trim())return json(res,400,{error:'Follow-up does not match this answer.'});}
   busy=true;res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Accel-Buffering':'no'});
   const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
   try{const run=await research({question:body.question.trim(),mode,selectUI:state=>laya.select(state),language:['en','zh-Hans'].includes(body.language)?body.language:'zh-Hant',owner,previous,key,portfolioScope,selectedFollowup,signal:controller.signal,onEvent:event=>{if(!res.destroyed)res.write(JSON.stringify(event)+'\n');}});runs.set(run.id,run);await writeFile(join(data,'private-run-'+run.id+'.json'),JSON.stringify(run),{mode:0o600});await writeFile(join(data,run.id+'.json'),JSON.stringify(visibleRun(run),null,2),{mode:0o600});
    if(run.question==='美國能源市場而家點睇'&&!previous&&!run.results.some(r=>r.access==='private_demo')){if(mode==='hybrid'){showcase=visibleRun(run);await writeFile(join(data,'showcase.json'),JSON.stringify(showcase,null,2),{mode:0o600});}else{comparison=visibleRun(run);await writeFile(join(data,'comparison.json'),JSON.stringify(comparison,null,2),{mode:0o600});}}
   }finally{busy=false;res.end();}return;
  }
  if(req.method==='GET'&&staticFiles[path]){session(req,res);const[file,type]=staticFiles[path];res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store'});res.end(await readFile(join(root,'public',file)));return;}
  json(res,404,{error:'Not found.'});
 }catch{if(!res.headersSent)json(res,500,{error:'Prototype request failed.'});else res.end();}
}).listen(port,'127.0.0.1',()=>console.log(JSON.stringify({prototype:true,port,model:MODEL,keyConfigured:!!key,privateDataTools:true,demoHousehold:"hh_okonkwo",readOnly:true})));
