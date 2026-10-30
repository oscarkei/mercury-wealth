import {test,expect,type Page,type Frame} from '@playwright/test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const phone=pathToFileURL(resolve('../Mercury Phone Demo.html')).href;
async function open(page:Page){await page.goto(phone);const locator=page.frameLocator('#portal');await locator.locator('.home-category-list').waitFor();return page.frames().find(f=>f.url().includes('Interactive'))!;}
async function wheelAtList(page:Page,frame:Frame,dy:number){const box=(await frame.locator('.home-category-list').boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,dy);}
for(const mobile of [false,true])test(`five-row list passes repeated wheel gestures to homepage (${mobile?'mobile':'scaled desktop'} wrapper)`,async({browser})=>{
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1200,height:850},isMobile:mobile,hasTouch:mobile});const page=await context.newPage();const frame=await open(page);
 for(let i=0;i<12;i++){await frame.evaluate(()=>scrollTo(0,350));await wheelAtList(page,frame,i%2? -100:100);await expect.poll(()=>frame.evaluate(()=>scrollY)).toBe(i%2?250:450);}
 expect(await frame.locator('.home-category-list').evaluate(el=>el.scrollTop)).toBe(0);expect(await frame.locator('.home-category-list').evaluate(el=>el.clientHeight)).toBe(275);await context.close();
});
test('extra rows scroll internally, and both boundaries hand wheel input back to the page',async({page})=>{
 await page.setViewportSize({width:390,height:844});const f=await open(page);await f.locator('.home-category-list').evaluate(el=>{for(let i=0;i<3;i++)el.appendChild(el.children[0].cloneNode(true));});await f.evaluate(()=>scrollTo(0,350));await wheelAtList(page,f,90);await expect.poll(()=>f.locator('.home-category-list').evaluate(el=>el.scrollTop)).toBe(90);expect(await f.evaluate(()=>scrollY)).toBe(350);
 await f.locator('.home-category-list').evaluate(el=>el.scrollTop=el.scrollHeight);await wheelAtList(page,f,100);await expect.poll(()=>f.evaluate(()=>scrollY)).toBe(450);
 await f.evaluate(()=>scrollTo(0,350));await f.locator('.home-category-list').evaluate(el=>el.scrollTop=0);await wheelAtList(page,f,-100);await expect.poll(()=>f.evaluate(()=>scrollY)).toBe(250);
});
test('repeated finger swipes starting on asset rows keep the phone page moving in both directions',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage(),f=await open(page),cdp=await context.newCDPSession(page);
 for(let i=0;i<8;i++){await f.evaluate(()=>scrollTo(0,350));const box=(await f.locator('.home-category-list').boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2,delta=i%2?75:-75;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let step=1;step<=10;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+delta*step/10}]});await page.waitForTimeout(20);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});if(i%2)await expect.poll(()=>f.evaluate(()=>scrollY)).toBeLessThan(330);else await expect.poll(()=>f.evaluate(()=>scrollY)).toBeGreaterThan(370);await page.waitForTimeout(250);}
 await context.close();
});
test('closing research and Ask removes scroll locks and homepage rows remain scrollable',async({page})=>{
 await page.setViewportSize({width:390,height:844});const f=await open(page);
 for(let i=0;i<3;i++){await f.getByRole('button',{name:'Read UBS research',exact:true}).click();await f.getByRole('button',{name:'Close UBS research',exact:true}).click();await expect(f.getByRole('dialog')).toBeHidden();await f.getByRole('button',{name:'Ask Mercury',exact:true}).click();await f.getByRole('button',{name:'Close chat',exact:true}).click();await expect(f.getByRole('dialog')).toBeHidden();await f.evaluate(()=>scrollTo(0,350));await wheelAtList(page,f,100);await expect.poll(()=>f.evaluate(()=>scrollY)).toBe(450);}
});
