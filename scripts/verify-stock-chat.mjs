// Explicit opt-in: makes real Gemini, local Laya and Yahoo Finance requests.
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../../../',import.meta.url)));
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const report={mocked:false,startedAt:new Date().toISOString(),cases:[],errors:[],passed:false};
let ready=false;for(let i=0;i<120;i++){try{if((await fetch('http://127.0.0.1:3000/api/health').then(r=>r.json())).ready){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,'Mercury must be running');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1040}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:3000/phone#chat');const frame=page.frameLocator('#portal');await expect(frame.getByRole('button',{name:'Live AI',exact:true})).toHaveAttribute('aria-pressed','true');
 async function result(message,start,kind='stocks'){
  const assistant=frame.locator('.chat-message.assistant').last(),card=assistant.getByRole('region',{name:kind==='stocks'?'Stock analysis':'Fed analysis'});
  await expect.poll(async()=>await card.count()?'chart':await assistant.locator('.ai-issue').count()?'error':'waiting',{timeout:65000}).not.toBe('waiting');assert.equal(await assistant.locator('.ai-issue').count(),0,await assistant.innerText());await card.waitFor();
  const chartMs=Date.now()-start,pending=!(await assistant.innerText()).includes('GEMINI ·');
  if(report.cases.length===0){await card.locator('.stock-chart').scrollIntoViewIfNeeded();await page.screenshot({path:'outputs/qa/stocks-chart-first-live.png',fullPage:true});}
  await expect.poll(async()=>await assistant.locator('.ai-issue').count()?'error':(await assistant.innerText()).includes('GEMINI ·')?'reply':'waiting',{timeout:65000}).not.toBe('waiting');assert.equal(await assistant.locator('.ai-issue').count(),0,await assistant.innerText());await expect(frame.getByRole('button',{name:'Send message',exact:true})).toBeVisible();
  const state=await frame.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('mercury-wealth-en-v2')).messages.at(-1));const data=state.stockAnalysis||state.analysis;
  const row={message,chart_ms:chartMs,total_ms:Date.now()-start,explanation_pending_when_chart_appeared:pending,symbol:data.data.quote?.symbol,range:data.range,modules:data.modules,sourceTime:data.data.retrievedAt,quoteTime:data.data.quote?.quoteTime,reply:state.text};report.cases.push(row);console.log(JSON.stringify(row));assert.ok(pending,'Chart must appear while explanation is pending');assert.ok(await card.evaluate(el=>Boolean(el.compareDocumentPosition(el.parentElement.querySelector('.analysis-explanation'))&Node.DOCUMENT_POSITION_FOLLOWING)));return {card,data};
 }
 async function send(message,kind='stocks'){await frame.getByRole('textbox',{name:'Your message'}).fill(message);const start=Date.now();await frame.getByRole('button',{name:'Send message',exact:true}).click();return result(message,start,kind);}
 const first=await send('用 Yahoo Finance 搜尋 Apple，美股過去三個月股價同成交量，先出圖再解釋。');assert.equal(first.data.data.quote.symbol,'AAPL');assert.ok(first.data.modules.includes('price_and_volume'));
 await first.card.getByRole('button',{name:'1M',exact:true}).click();await expect(first.card.getByRole('button',{name:'1M',exact:true})).toHaveAttribute('aria-pressed','true');await first.card.getByRole('slider',{name:'Stock chart observation'}).fill('0');await first.card.locator('.stock-chart').scrollIntoViewIfNeeded();await page.screenshot({path:'outputs/qa/stocks-live-chart.png',fullPage:true});
 const start=Date.now();await first.card.getByRole('button',{name:'Explain this chart'}).click();const second=await result('Explain selected one-month chart',start);assert.equal(second.data.range,'1mo');
 await second.card.getByRole('textbox',{name:'Company or US ticker'}).fill('Microsoft');const searchStart=Date.now();await second.card.getByRole('button',{name:'Search',exact:true}).click();const third=await result('Search Microsoft',searchStart);assert.equal(third.data.data.quote.symbol,'MSFT');
 await send('Show only actual Fed funds rate history over the past 3 months.','fed');
 await frame.getByRole('button',{name:'Reset demo data',exact:true}).last().click();await expect(frame.getByRole('heading',{name:'Your wealth, in perspective.'})).toBeVisible();await page.reload();const fresh=page.frameLocator('#portal');if(!await fresh.getByRole('dialog',{name:'Mercury Chat'}).isVisible())await fresh.getByRole('button',{name:'Ask Mercury',exact:true}).click();await expect(fresh.locator('.chat-message')).toHaveCount(0);await expect(fresh.getByRole('button',{name:'Live AI',exact:true})).toHaveAttribute('aria-pressed','true');report.resetPersisted=true;
 assert.equal(await fresh.locator('body').evaluate(el=>el.scrollWidth>el.clientWidth),false);assert.deepEqual(report.errors,[]);await page.screenshot({path:'outputs/qa/stocks-reset-live.png',fullPage:true});report.passed=true;
}catch(error){report.failure=String(error);throw error;}finally{fs.writeFileSync('outputs/qa/stocks-live-verification.json',JSON.stringify(report,null,2));await browser.close();}
