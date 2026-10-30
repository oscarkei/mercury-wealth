import {test,expect,type Page} from '@playwright/test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const url=pathToFileURL(resolve('../Mercury Wealth Interactive Demo.html')).href;
test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844},deviceScaleFactor:1});
const active=(p:Page)=>p.locator('.home-hero-slide[aria-hidden=false]');
const nav=(p:Page,name:string)=>p.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name,exact:true});
async function swipe(p:Page,direction:'left'|'right'){
 const box=(await p.locator('.home-hero-track').boundingBox())!;
 const client=await p.context().newCDPSession(p);const x=box.x+(direction==='left'?box.width*.82:box.width*.18),end=box.x+(direction==='left'?box.width*.18:box.width*.82),y=box.y+110;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=12;i++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(end-x)*i/12,y}]});await p.waitForTimeout(25);}
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();
}
test('cash stays in hero; real swipe synchronizes bank, top categories and drill-down',async({page})=>{
 await page.goto(url);await expect(active(page).locator('.hero-cash')).toContainText('$729K');await expect(page.locator('.home-category-list>button')).toHaveCount(5);await expect(page.locator('.family-charts,.custodian-grid')).toHaveCount(0);
 await swipe(page,'left');await expect(active(page)).toHaveAttribute('aria-label','UBS wealth');await expect(page.locator('.home-category-list>button')).toHaveCount(5);
 await swipe(page,'left');await expect(active(page)).toHaveAttribute('aria-label','Julius Baer wealth');await expect(active(page).locator('.hero-cash')).toContainText('$279K');await expect(page.locator('.home-category-list>button')).toHaveCount(5);
 await swipe(page,'right');await expect(active(page)).toHaveAttribute('aria-label','UBS wealth');
 await page.getByRole('button',{name:'Review Equities holdings',exact:true}).tap();await expect(page.locator('h1')).toHaveText('Your portfolio');await expect(page.locator('.scope-launch')).toContainText('UBS');await expect(page.locator('.compact-holding')).toHaveCount(5);await expect(page.locator('.compact-holding')).not.toContainText(['Cash']);
 await page.getByRole('button',{name:'Allocation',exact:true}).tap();await expect(page.locator('.family-pie')).toBeVisible();await expect(page.locator('.family-value-chart')).toBeVisible();
});
test('custodian buttons and keyboard preserve selection on resize; cash links filter holdings',async({page})=>{
 await page.goto(url);await page.getByRole('button',{name:'Show Julius Baer',exact:true}).tap();await expect(active(page)).toHaveAttribute('aria-label','Julius Baer wealth');await page.setViewportSize({width:430,height:932});await expect(active(page)).toHaveAttribute('aria-label','Julius Baer wealth');
 await page.locator('.home-hero-track').focus();await page.keyboard.press('ArrowLeft');await expect(active(page)).toHaveAttribute('aria-label','UBS wealth');await active(page).getByRole('button',{name:'View cash holdings'}).tap();await expect(page.locator('.compact-holding')).toHaveCount(2);await expect(page.locator('.compact-holdings')).toContainText('Cash');await nav(page,'Home').tap();await expect(active(page)).toHaveAttribute('aria-label','UBS wealth');
});
test('editorial reports show attributed charts, accessible figures and working save / back',async({page})=>{
 await page.goto(url);await expect(page.locator('.research-cover')).toHaveCount(2);await expect(page.locator('.data-strip,.home-product-shortcut,.home-bank-tabs,.home-swipe-hint')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Family overview',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Read UBS research',exact:true}).tap();const sheet=page.getByRole('dialog',{name:'UBS research',exact:true});await expect(sheet).toBeVisible();await expect(sheet).toContainText('Global Wealth Report 2026');await expect(sheet.getByRole('img')).toHaveAttribute('aria-label',/EMEA 17.5%.*Global 10.8%/);await sheet.getByRole('button',{name:'By year',exact:true}).tap();await expect(sheet.getByRole('img')).toHaveAttribute('aria-label',/2023 4.2%.*2025 10.8%/);await sheet.locator('summary').click();await expect(sheet.getByRole('table')).toContainText('4.2%');await expect(sheet.getByRole('link',{name:'Read original report'})).toHaveAttribute('href',/ubs.com.*global-wealth-report-clients/);await sheet.getByRole('button',{name:'Save for later'}).tap();await page.goBack();await expect(sheet).toBeHidden();await expect(page.getByRole('button',{name:'Read UBS research',exact:true})).toBeFocused();await expect(page.getByRole('button',{name:'Unsave UBS research'})).toHaveAttribute('aria-pressed','true');await page.reload();await expect(page.getByRole('button',{name:'Unsave UBS research'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Read Julius Baer research',exact:true}).tap();const jb=page.getByRole('dialog',{name:'Julius Baer research',exact:true});await jb.getByRole('button',{name:'Selected goods'}).tap();await expect(jb.getByRole('img')).toHaveAttribute('aria-label',/Jewellery 16.4%.*Watches 15.5%/);await expect(jb.getByRole('link',{name:'Read original report'})).toHaveAttribute('href',/juliusbaer.com.*2026/);await jb.getByRole('button',{name:'Close Julius Baer research'}).tap();await expect(jb).toBeHidden();
});
test('five-row window remains fixed for every bank, with zero rows and overflow contained',async({page})=>{
 await page.goto(url);const list=page.locator('.home-category-list');const height=(await list.boundingBox())!.height;expect(height).toBe(275);
 await page.getByRole('button',{name:'Show Julius Baer'}).tap();await expect(page.getByRole('heading',{name:'Julius Baer',exact:true})).toBeVisible();await expect(list.locator('button')).toHaveCount(5);await expect(list.locator('button:disabled')).toHaveCount(2);expect((await list.boundingBox())!.height).toBe(height);
 // Exercise the future sixth-category overflow without changing the five-category demo data.
 await list.evaluate(el=>{el.appendChild(el.children[0].cloneNode(true));el.scrollTop=60;});expect(await list.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);expect((await list.boundingBox())!.height).toBe(height);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const dots=await page.locator('.home-bank-dots button').evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));expect(dots.every(d=>d.width>=44&&d.height>=44)).toBe(true);
});
for(const viewport of [{width:360,height:640},{width:844,height:390}])test(`research reader fits ${viewport.width}×${viewport.height} with reachable source and dismiss`,async({page})=>{
 await page.setViewportSize(viewport);await page.goto(url);await page.getByRole('button',{name:'Read UBS research',exact:true}).tap();const sheet=page.getByRole('dialog',{name:'UBS research',exact:true});await expect.poll(async()=>{const b=await sheet.locator('.touch-sheet-footer').boundingBox();return b?b.y+b.height:Infinity;}).toBeLessThanOrEqual(viewport.height+1);await sheet.getByRole('button',{name:'By year'}).tap();await expect(sheet.locator('.research-chart')).toHaveAttribute('aria-label',/2025 10.8%/);expect(await sheet.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await sheet.getByRole('button',{name:'Close UBS research'}).tap();await expect(sheet).toBeHidden();
});
