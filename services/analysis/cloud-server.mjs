import http from 'node:http';
import {join} from 'node:path';
import {mkdirSync} from 'node:fs';
import {research as engine} from './engine.mjs';
import {executeTool} from './research-tools.mjs';
import {portfolioSchemas,executePortfolio} from './portfolio-tools.mjs';
import {publicPortfolio} from './cloud/portfolio.mjs';
import {createCloudService} from './cloud/service.mjs';
import {CloudStore} from './cloud/store.mjs';
import {startLaya} from './laya-client.mjs';
import {financeCall,closeFinance} from './finance-client.mjs';
const data=process.env.MERCURY_CLOUD_DATA_DIR||join(process.cwd(),'.mercury-cloud');mkdirSync(data,{recursive:true,mode:0o700});
const token=process.env.MERCURY_SERVICE_TOKEN,key=process.env.DEEPSEEK_API_KEY;
if(!key||!token||token.length<32)throw Error('Configure DEEPSEEK_API_KEY and MERCURY_SERVICE_TOKEN before starting.');
const store=new CloudStore(join(data,'conversations.sqlite')),laya=startLaya();let financeReady=false;
financeCall('health',{},AbortSignal.timeout(110000)).then(r=>{financeReady=r.ready===true;}).catch(()=>{});
const ready=()=>({ready:!!laya.info&&!laya.error&&financeReady,model:'deepseek-flash',ui:'laya',financeReady,portfolio:'public-demo-snapshot',deepseek:'configured-not-yet-verified'});
const service=createCloudService({token,store,ready,dailyLimit:Number(process.env.MERCURY_DAILY_JOB_LIMIT||100),research:args=>engine({...args,key,mode:'hybrid',selectUI:state=>laya.select(state),toolExecutor:(name,raw,run,options)=>Object.hasOwn(portfolioSchemas,name)?executePortfolio(name,raw,run,{...options,portfolioLoader:async scope=>publicPortfolio(scope)}):executeTool(name,raw,run,options)})});
const server=http.createServer(async(req,res)=>{
 try{
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
  const body=Buffer.concat(chunks).toString('utf8');
  const request=new Request('http://service'+req.url,{method:req.method,headers:req.headers,...(body?{body}:{} )});
  const response=await service.handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
 }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Analysis service request failed.'}));}
});
server.requestTimeout=20000;server.headersTimeout=15000;
server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Mercury cloud analysis service started.'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{service.close();laya.close();closeFinance();server.close(()=>process.exit(0));});
