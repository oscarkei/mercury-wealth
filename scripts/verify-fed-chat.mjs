// Explicit opt-in: four real Fed conversations, each using Gemini and local Laya.
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../../../',import.meta.url)));
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const report={mocked:false,startedAt:new Date().toISOString(),cases:[],errors:[],passed:false};
for(let i=0;i<120;i++){try{const h=await fetch('http://127.0.0.1:3000/api/health').then(r=>r.json());if(h.ready)break;}catch{}await new Promise(r=>setTimeout(r,500));}
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1040}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:3000/phone#chat');const frame=page.frameLocator('#portal');
 await expect(frame.getByRole('button',{name:'Live AI',exact:true})).toHaveAttribute('aria-pressed','true');
 async function result(message,started){
  const assistant=frame.locator('.chat-message.assistant').last();
  await expect.poll(async()=>await assistant.locator('.ai-issue').count()?'error':(await assistant.innerText()).includes('GEMINI · gemini-3.1-flash-lite')?'reply':'waiting',{timeout:65000}).not.toBe('waiting');
  const issue=await assistant.locator('.ai-issue').allTextContents();if(issue.length){const failed=await frame.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('mercury-wealth-en-v2')).messages.at(-1));report.failedResponse={message,issue,plan:failed.analysis?.plan,modules:failed.analysis?.modules};}assert.deepEqual(issue,[],issue.join(' '));
  await expect(frame.getByRole('button',{name:'Send message',exact:true})).toBeVisible();
  assert.equal(await assistant.locator('.ai-issue').count(),0);
  const analysis=await frame.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('mercury-wealth-en-v2')).messages.at(-1).analysis);
  assert.equal(analysis.composer.provider,'Laya');assert.equal(analysis.data.warnings.length,0);
  const row={message,elapsed_ms:Date.now()-started,plan:analysis.plan,modules:analysis.modules,sourceTimes:{rates:analysis.data.ratesFetchedAt,markets:analysis.data.marketsFetchedAt},latestRate:analysis.data.rates.at(-1),meeting:analysis.data.meetings[0]?.date,reply:await assistant.locator('.analysis-explanation').innerText()};report.cases.push(row);console.log(JSON.stringify(row));return {assistant,analysis,card:assistant.getByRole('region',{name:'Fed analysis'})};
 }
 async function send(message){const started=Date.now();await frame.getByRole('textbox',{name:'Your message'}).fill(message);await frame.getByRole('button',{name:'Send message',exact:true}).click();return result(message,started);}
 const first=await send('Fed 加息 expectation：請用圖表顯示下一次會議概率，同過去三個月實際利率走勢，再解釋。');
 assert.equal(first.analysis.plan.meetingMonth,'nearest');assert.ok(first.analysis.modules.includes('probabilities'));assert.ok(first.analysis.modules.includes('rate_history'));assert.equal(first.analysis.modules.includes('sensitivity'),false);
 await first.card.locator('[data-fed-module="probabilities"]').scrollIntoViewIfNeeded();
 await page.screenshot({path:'outputs/qa/fed-live-probabilities.png',fullPage:true});
 await first.card.getByLabel('Fed meeting').selectOption(first.analysis.data.meetings[1].id);
 const selectedDate=first.analysis.data.meetings[1].date;
 const mid=first.analysis.data.meetings[1].outcomes.find(o=>o.direction==='hold').mid.toFixed(1)+'%';
 await expect(first.card.locator('.fed-outcome').filter({hasText:'Hold'})).toContainText(mid);
 await first.card.getByRole('button',{name:'1M',exact:true}).click();await expect(first.card.getByRole('button',{name:'1M',exact:true})).toHaveAttribute('aria-pressed','true');
 await first.card.locator('[data-fed-module="rate_history"]').scrollIntoViewIfNeeded();await page.screenshot({path:'outputs/qa/fed-live-history.png',fullPage:true});
 const followupStart=Date.now();await first.card.getByRole('button',{name:'Explain this selection'}).click();const second=await result('Explain selected meeting',followupStart);assert.equal(second.analysis.plan.meetingMonth,selectedDate.slice(0,7));assert.equal(second.analysis.plan.historyDays,30);
 const third=await send('Show only actual EFFR history over the last 6 months. I do not want probabilities or market forecasts.');assert.deepEqual(third.analysis.plan.tools,['fed_rates']);assert.ok(third.analysis.modules.includes('rate_history'));assert.equal(third.analysis.modules.includes('probabilities'),false);
 const fourth=await send('Compare Fed rate hike pricing across the next three meetings.');assert.ok(fourth.analysis.modules.includes('meeting_comparison'));const explanation=report.cases.at(-1).reply;for(const m of fourth.analysis.data.meetings.slice(0,3)){const month=new Date(m.date).toLocaleString('en-US',{month:'short',timeZone:'UTC'});assert.match(explanation,new RegExp(month,'i'));}assert.doesNotMatch(explanation,/subsequent.{0,30}unavailable|only available for/i);assert.equal(fourth.analysis.plan.meetingCount,3);assert.equal(await fourth.card.locator('.fed-compare-row').count(),3);assert.equal(fourth.analysis.modules.includes('sensitivity'),false);
 await fourth.card.getByRole('button',{name:'Hold',exact:true}).click();await expect(fourth.card.getByRole('button',{name:'Hold',exact:true})).toHaveAttribute('aria-pressed','true');await fourth.card.locator('[data-fed-module="meeting_comparison"]').scrollIntoViewIfNeeded();await page.screenshot({path:'outputs/qa/fed-live-comparison.png',fullPage:true});
 assert.equal(await frame.locator('body').evaluate(el=>el.scrollWidth>el.clientWidth),false);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=String(error);throw error;}finally{fs.writeFileSync('outputs/qa/fed-live-verification.json',JSON.stringify(report,null,2));await browser.close();}
