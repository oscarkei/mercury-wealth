// Explicit opt-in: this script makes two real Gemini requests.
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../../../',import.meta.url)));
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
for(let attempt=0;attempt<100;attempt++){
 try{const health=await fetch('http://127.0.0.1:3000/api/health').then(r=>r.json());if(health.ready&&health.gemini.model==='gemini-3.1-flash-lite')break;}catch{}
 await new Promise(r=>setTimeout(r,500));
}
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const report={mocked:false,model:'gemini-3.1-flash-lite',cases:[],pageErrors:[]};
try{
 const page=await browser.newPage({viewport:{width:1280,height:1040}});
 page.on('pageerror',error=>report.pageErrors.push(error.message));
 await page.goto('http://127.0.0.1:3000/phone#chat');
 const frame=page.frameLocator('#portal');
 await frame.getByRole('textbox',{name:'Your message'}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Live AI',exact:true}).getAttribute('aria-pressed'),'true');
 async function send(message,check){
  await frame.getByRole('textbox',{name:'Your message'}).fill(message);
  const started=Date.now();await frame.getByRole('button',{name:'Send message',exact:true}).click();
  const assistant=frame.locator('.chat-message.assistant').last();
  await expect(assistant).toContainText('GEMINI · gemini-3.1-flash-lite',{timeout:35000});
  await expect(assistant).toContainText('Laya ·',{timeout:10000});
  await expect(frame.getByRole('button',{name:'Send message',exact:true})).toBeVisible();
  assert.equal(await assistant.locator('.ai-issue').count(),0);
  const text=await assistant.locator('p').first().innerText();
  const button=await assistant.getByRole('button').innerText();
  const destination=button.includes('Open this product scenario')?'products':button.includes('Open your overview')?'overview':button.includes('Review allocation')?'portfolio':'other';
  check({text},{destination});
  const result={message,elapsed_ms:Date.now()-started,reply:text,action:button,destination};
  report.cases.push(result);console.log(JSON.stringify(result));
 }
 await send('What is my total wealth and asset allocation?',(reply,decision)=>{assert.match(reply.text,/8[,.]42|8,420,000/);assert.match(reply.text,/42%/);assert.ok(['portfolio','overview'].includes(decision.destination));});
 await send('我張結構性產品跌55%，會蝕幾多？',(reply,decision)=>{assert.match(reply.text,/221,822|221822/);assert.equal(decision.destination,'products');});
 await page.screenshot({path:'outputs/qa/phone-live-gemini-laya-chat.png',fullPage:true});
 await frame.getByRole('button',{name:/Open this product scenario/}).last().click();
 assert.equal(await frame.getByTestId('product-total').innerText(),'$221,822');
 assert.equal(await frame.getByRole('button',{name:'Capital payoff',exact:true}).getAttribute('aria-pressed'),'true');
 report.productActionVerified=true;
 await page.screenshot({path:'outputs/qa/phone-live-product-action.png',fullPage:true});
 assert.deepEqual(report.pageErrors,[]);
 report.passed=true;
}finally{
 fs.writeFileSync('outputs/qa/live-ai-chat-verification.json',JSON.stringify(report,null,2));
 await browser.close();
}
