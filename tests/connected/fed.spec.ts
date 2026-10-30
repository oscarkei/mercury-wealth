import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import {parseRates,parseMeetings} from '../../src/lib/fed-data';
const raw=JSON.parse(fs.readFileSync(new URL('../fixtures/fed-synthetic.json',import.meta.url),'utf8'));
const instant=Date.parse('2026-10-26T12:00:00Z');
const base={plan:{workflow:'fed',tools:['fed_rates','fed_markets'],focus:'expectations',meetingMonth:'nearest',historyDays:90,goal:'Fed decision analysis'},data:{retrievedAt:'2026-10-26T12:00:00Z',ratesFetchedAt:'2026-10-26T12:00:00Z',marketsFetchedAt:'2026-10-26T12:00:00Z',rates:parseRates(raw.rates,instant),meetings:parseMeetings(raw.markets,instant),warnings:[],ratesStale:false,marketsStale:false},modules:['probabilities','rate_history','sensitivity'],composer:{provider:'Laya',model:'fixture-laya',elapsed_ms:200},plannerModel:'fixture-gemini'};
async function setup(page:Page,analysis=base){
 await page.route('**/api/health',r=>r.fulfill({json:{server:true,enabled:true,ready:true,gemini:{configured:true,model:'fixture-gemini'},router:{provider:'Laya',configured:true,model:'fixture-laya'},verified:false}}));
 await page.route('**/api/assistant',r=>{const b=r.request().postDataJSON();return r.fulfill({contentType:'application/x-ndjson',body:[{type:'start'},{type:'progress',text:'Composing analysis…'},{type:'analysis',analysis},{type:'reply',provider:'Gemini',model:'fixture-gemini',text:'The October meeting quote favours holding rates. The quote snapshot is sourced separately from actual historical EFFR.'},{type:'done'}].map(e=>JSON.stringify({...e,requestId:b.requestId,revision:b.revision})).join('\n')+'\n'});});
 await page.goto('/phone#chat');const frame=page.frameLocator('#portal');await expect(frame.locator('.chat-drawer')).toHaveAttribute('data-connection','connected');await expect(frame.locator('.composer-tools>span')).toHaveText('Assistant');await frame.getByRole('textbox',{name:'Your message'}).fill('Fed hike expectations');await frame.getByRole('button',{name:'Send message',exact:true}).click();await expect(frame.getByRole('region',{name:'Fed analysis'})).toBeVisible();return frame;
}
test('phone Fed charts show raw quotes, change meetings and expose actual-rate history and sensitivity',async({page})=>{
 await page.setViewportSize({width:1200,height:1040});const frame=await setup(page);
 await expect(frame.locator('.fed-outcome').filter({hasText:'Hold'})).toContainText('93.5%');
 await frame.getByRole('button',{name:/^Hold.*93.5%/}).click();await expect(frame.locator('.fed-quote-detail')).toContainText('Bid 93.0% · Ask 94.0%');
 await frame.getByLabel('Fed meeting').selectOption('KXFEDDECISION-26DEC');await expect(frame.locator('.fed-outcome').filter({hasText:'Hold'})).toContainText('23.5%');
 await frame.getByRole('region',{name:'Fed analysis'}).getByRole('button',{name:'1M',exact:true}).click();await expect(frame.getByRole('region',{name:'Fed analysis'}).getByRole('button',{name:'1M',exact:true})).toHaveAttribute('aria-pressed','true');
 await frame.getByRole('slider',{name:'Illustrative rate change'}).fill('50');await expect(frame.locator('.fed-sensitivity-output')).toContainText('-2.50%');
 await frame.locator('.fed-details').last().locator('summary').click();await expect(frame.locator('.fed-details').last()).toContainText('neither CME FedWatch');
 const overflow=await frame.locator('body').evaluate(el=>el.scrollWidth>el.clientWidth);expect(overflow).toBe(false);
 await page.screenshot({path:'../qa/fed-controls-fixture.png',fullPage:true});
});
test('selection follow-up passes the selected month back to the LLM planner',async({page})=>{
 const frame=await setup(page);await frame.getByLabel('Fed meeting').selectOption('KXFEDDECISION-26DEC');
 const request=page.waitForRequest(r=>r.url().endsWith('/api/assistant')&&r.method()==='POST');await frame.getByRole('button',{name:'Explain this selection'}).click();const body=(await request).postDataJSON();expect(body.fedContext.meetingMonth).toBe('2026-12');expect(body.message).toContain('2026-12-09');
});
test('history-only composition and source failures do not fabricate market probabilities',async({page})=>{
 const analysis=structuredClone(base);analysis.modules=['rate_history'];analysis.plan.tools=['fed_rates'];analysis.plan.focus='history';analysis.data.meetings=[];const frame=await setup(page,analysis);await expect(frame.locator('[data-fed-module="rate_history"]')).toBeVisible();await expect(frame.locator('[data-fed-module="probabilities"]')).toHaveCount(0);await expect(frame.getByLabel('Fed meeting')).toHaveCount(0);
});
