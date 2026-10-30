import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {accumulatorModel} from '../src/lib/accumulator-model.ts';
const root=process.cwd(),dist=process.env.MERCURY_NEXT_DIST||'.next-wealth-0.3.1',requests=[],errors=[];
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://127.0.0.1:3001/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/_next/static/')){
   const path=resolve(root,dist+'/static',decodeURIComponent(url.pathname.slice('/_next/static/'.length)));
   if(!path.startsWith(resolve(root,dist+'/static')+'/'))return route.abort();
   const type={'.js':'application/javascript','.css':'text/css','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream';
   return route.fulfill({body:await readFile(path),contentType:type});
  }
  if(url.pathname==='/api/health')return route.fulfill({json:{server:true,ready:true,enabled:true,gemini:{configured:true,model:'gemini-3.6-flash'},router:{provider:'Gemini',configured:true,model:'gemini-3.6-flash'},verified:false}});
  if(url.pathname==='/api/session')return route.fulfill({json:{mode:'local-demo'}});
  if(url.pathname.startsWith('/api/portfolio'))return route.fulfill({json:{status:'not_configured'}});
  if(url.pathname==='/api/conversation')return route.fulfill({json:{reset:true}});
  if(url.pathname==='/api/assistant'){
   const input=route.request().postDataJSON();requests.push(input);
   const path=accumulatorModel(80,20),last=path.at(-1);
   const events=[{type:'wealth_scenario',wealthScenario:{kind:'accumulator',instrumentId:'fixture-accumulator',name:'Apple accumulator',snapshot:'fixture',asOf:'2026-06-19',shockPct:-20,days:20,shares:last.shares,cost:last.cost,value:last.value,pnl:last.value-last.cost,path,assumptions:['Synthetic browser fixture; no live model or market data.']}},{type:'reply',provider:requests.length===1?'Local':'Gemini',text:'Your concentration review is retained for the next question.',model:'browser-fixture'},{type:'done'}];
   return route.fulfill({contentType:'application/x-ndjson',body:events.map(e=>JSON.stringify({...e,requestId:input.requestId,revision:input.revision})).join('\n')+'\n'});
  }
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{}});
  return route.fulfill({contentType:'text/html',body:await readFile(resolve(root,dist+'/server/app/index.html'))});
 });
 await page.goto('http://127.0.0.1:3001/#chat',{waitUntil:'networkidle'});
 const input=page.getByPlaceholder('Ask about your wealth…');await input.waitFor({state:'visible'});
 await input.fill('Review my portfolio');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.getByLabel('Accumulator scenario',{exact:true}).waitFor();
 await input.fill('What did that review say?');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Accumulator scenario"]').length===2);
 if(!requests[1].history.some(m=>m.role==='assistant'&&m.text.includes('concentration review')))throw Error('Local assistant reply was omitted from follow-up history');
 await page.reload({waitUntil:'networkidle'});await page.getByLabel('Accumulator scenario',{exact:true}).first().waitFor();
 const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
 await page.setViewportSize({width:1365,height:900});
 const desktopOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
 await writeFile(new URL('../../../outputs/wealth-browser-check.json',import.meta.url),JSON.stringify({mode:'built_static_assets_with_intercepted_API; no listening server',mobile:{width:390,overflow:mobileOverflow},desktop:{width:1365,overflow:desktopOverflow},local_reply_preserved:true,reload_scenario_restored:true,errors,requests:requests.length},null,2));
 if(errors.length||mobileOverflow||desktopOverflow)throw Error('Browser checks found errors or overflow: '+JSON.stringify({errors,mobileOverflow,desktopOverflow}));
 console.log(JSON.stringify({passed:true,mode:'static built app and synthetic API',requests:requests.length}));
}catch(error){
 await writeFile(new URL('../../../outputs/wealth-browser-check.json',import.meta.url),JSON.stringify({passed:false,stage:'browser validation',error:error.message},null,2));throw error;
}finally{await browser?.close();}
