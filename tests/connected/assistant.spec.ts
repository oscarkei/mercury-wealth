import {test,expect,type Page} from '@playwright/test';
const headers={'x-mercury-client':'portal',Origin:'http://127.0.0.1:3100'};
const configured=(router='Gemini')=>({server:true,enabled:true,ready:true,gemini:{configured:true,model:'fixture-gemini'},router:{provider:router,configured:true,model:'fixture-'+router},verified:false});
async function fakeHealth(page:Page,router='Gemini'){await page.route('**/api/health',r=>r.fulfill({json:configured(router)}));}
async function prepare(page:Page,events:object[],router='Gemini'){
 await fakeHealth(page,router);await page.route('**/api/assistant',async route=>{const b=route.request().postDataJSON();await route.fulfill({contentType:'application/x-ndjson',body:[{type:'start'},...events,{type:'done'}].map(e=>JSON.stringify({...e,requestId:b.requestId,revision:b.revision})).join('\n')+'\n'});});
 await page.goto('/#chat');await expect(page.locator('.chat-drawer')).toHaveAttribute('data-connection','connected');await expect(page.locator('.composer-tools>span')).toHaveText('Assistant');
}
const answer={type:'reply',provider:'Gemini',text:'The scenario returns USD 221,822, including coupons.',model:'fixture-gemini',elapsed_ms:200};
const decision={type:'decision',provider:'Gemini',destination:'products',focus:'downside',product:'phoenix',path:[100,98,96,94,97,95,45],elapsed_ms:200};
async function send(page:Page,text='What if my structured product falls 55%?'){await page.getByRole('textbox',{name:'Your message'}).fill(text);await page.getByRole('button',{name:'Send message',exact:true}).click();}
test('real local routes fail closed without keys and reject external origins',async({page,request})=>{
 const health=await request.get('/api/health');const body=await health.json();expect(body.server).toBe(true);expect(body.ready).toBe(false);expect(body.verified).toBe(false);expect(JSON.stringify(body)).not.toContain('API_KEY');
 expect((await request.post('/api/assistant',{headers,data:{}})).status()).toBe(403);
 expect((await request.post('/api/session',{headers:{...headers,Origin:'https://untrusted.example'}})).status()).toBe(403);
 await page.goto('/#chat');await expect(page.locator('.chat-drawer')).toHaveAttribute('data-connection','local');await page.request.post('/api/session',{headers});expect((await page.request.post('/api/assistant',{headers,data:{}})).status()).toBe(503);expect((await request.get('/.env.local')).status()).toBe(404);
});
test('Gemini-only result names its source and opens the matching calculated product path',async({page})=>{
 await prepare(page,[answer,decision]);await send(page);await expect(page.getByRole('log')).toContainText('ASSISTANT');await page.getByRole('button',{name:/Open this product scenario/}).click();await expect(page.getByTestId('product-total')).toHaveText('$221,822');await expect(page.getByRole('button',{name:'Capital payoff',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('Jev can select the action before the Gemini explanation arrives',async({page})=>{
 await prepare(page,[{...decision,provider:'Jev',elapsed_ms:80},answer],'Jev');await send(page);await expect(page.getByRole('log')).toContainText('Jev · 80 ms');await expect(page.getByRole('log')).toContainText('ASSISTANT');await page.getByRole('button',{name:/Open this product scenario/}).click();await expect(page.getByTestId('product-total')).toHaveText('$221,822');
});
test('failed decision provider preserves Gemini explanation without fabricating an action',async({page})=>{
 await prepare(page,[{type:'error',provider:'Jev',code:'RATE_LIMIT',message:'Provider quota reached.'},answer],'Jev');await send(page);await expect(page.getByRole('log')).toContainText('Provider quota reached');await expect(page.getByRole('log')).toContainText('USD 221,822');await expect(page.locator('.chat-action')).toHaveCount(0);await expect(page.locator('.composer-tools>span')).toHaveText('Assistant');
});
test('Gemini failures stay visible; no local answer is silently substituted',async({page})=>{
 await prepare(page,[{type:'error',provider:'Gemini',code:'ACCESS_DENIED',message:'Check your Gemini API key.'}]);await send(page,'Explain my portfolio allocation');await expect(page.getByRole('log')).toContainText('Check your Gemini API key');await expect(page.getByRole('log')).not.toContainText('42% equities');await expect(page.locator('.composer-tools>span')).toHaveText('Assistant');
});
test('cancel ignores delayed live replies',async({page})=>{
 await fakeHealth(page);let release:()=>void=()=>{};const gate=new Promise<void>(r=>{release=r;});await page.route('**/api/assistant',async route=>{const b=route.request().postDataJSON();await gate;await route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({...answer,text:'STALE_RESPONSE',requestId:b.requestId,revision:b.revision})+'\n'}).catch(()=>{});});await page.goto('/#chat');await expect(page.locator('.chat-drawer')).toHaveAttribute('data-connection','connected');await expect(page.locator('.composer-tools>span')).toHaveText('Assistant');await send(page);await page.getByRole('button',{name:'Cancel',exact:true}).click();release();await expect(page.getByRole('log')).toContainText('AI request cancelled');await expect(page.getByRole('log')).not.toContainText('STALE_RESPONSE');
});
test('same-origin phone frame can use the local API UI and keep composer in view',async({page})=>{
 await fakeHealth(page,'Laya');await page.route('**/api/assistant',route=>{const b=route.request().postDataJSON();return route.fulfill({contentType:'application/x-ndjson',body:[{type:'start'},answer,{...decision,provider:'Laya'},{type:'done'}].map(e=>JSON.stringify({...e,requestId:b.requestId,revision:b.revision})).join('\n')+'\n'});});
 await page.setViewportSize({width:1200,height:1000});await page.goto('/phone#chat');const frame=page.frameLocator('#portal');await expect(frame.locator('.chat-drawer')).toHaveAttribute('data-connection','connected');await expect(frame.locator('.composer-tools>span')).toHaveText('Assistant');await frame.getByRole('textbox',{name:'Your message'}).fill('What if my note falls 55%?');await frame.getByRole('button',{name:'Send message',exact:true}).click();await expect(frame.getByRole('log')).toContainText('Laya · 200 ms');await expect(frame.getByRole('log')).toContainText('USD 221,822');await page.screenshot({path:'../qa/phone-ai-connection-fixture.png'});
});
