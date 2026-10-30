import {test,expect,type Page} from '@playwright/test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const url=pathToFileURL(resolve('../Review Mercury Demo.html')).href;
const open=async(page:Page,hash='')=>{await page.goto(url+hash);await expect(page.locator('h1')).toBeVisible();};
const noOverflow=async(page:Page)=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
const close=async(page:Page)=>page.getByRole('button',{name:'Close dialog',exact:true}).click();
const model=async(page:Page,name:string)=>{await page.getByRole('button',{name:'Simulator model',exact:true}).click();await page.getByRole('dialog',{name:'Simulator model',exact:true}).getByRole('button',{name:new RegExp(name)}).click();};
for(const width of [360,390,430,768,1440])test(`family / product views fit at ${width}px`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:844});
 await open(page);await expect(page.locator('h1')).toHaveText('Okonkwo Family');await expect(page.locator('.home-hero-slide[aria-hidden=false] .hero-value')).toContainText('$28,469,027');await noOverflow(page);
 await open(page,'#portfolio');await expect(page.locator('.compact-holding')).toHaveCount(5);await noOverflow(page);await page.getByRole('button',{name:'Show 5 more holdings'}).click();await expect(page.locator('.compact-holding')).toHaveCount(10);
 await page.getByRole('button',{name:'Allocation',exact:true}).click();await expect(page.locator('.family-pie')).toBeVisible();await noOverflow(page);
 await page.getByRole('button',{name:'Accounts',exact:true}).click();await expect(page.locator('.custodian-card')).toHaveCount(2);await noOverflow(page);
 await open(page,'#products');await expect(page.locator('.studio-card')).toHaveCount(1);await expect(page.locator('.studio-card')).toContainText('No fixed coupon');await expect(page.getByRole('slider')).toHaveCount(0);await noOverflow(page);
 await page.getByRole('button',{name:'Explore · 3',exact:true}).click();await expect(page.locator('.studio-card')).toHaveCount(3);await noOverflow(page);
 await page.locator('.studio-card').first().getByRole('button',{name:'Simulate',exact:true}).click();await expect(page.locator('h1')).toHaveText('Simulator');await expect(page.getByTestId('product-total')).toHaveText('$473,370');await noOverflow(page);
 await page.getByRole('button',{name:'Market sell-off',exact:true}).click();await expect(page.getByTestId('product-total')).toHaveText('$217,994');await model(page,'AAPL Accumulator');await expect(page.getByTestId('accum-shares')).toHaveText('800');await noOverflow(page);expect(errors).toEqual([]);
});
test('currency preference persists and sample note results remain independently saved',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'HKD',exact:true}).click();await close(page);await expect(page.locator('.home-hero-slide[aria-hidden=false] .hero-value')).toContainText('$222,058,413');await page.reload();await expect(page.locator('.home-hero-slide[aria-hidden=false] .hero-value')).toContainText('HKD');
 await open(page,'#simulator');await model(page,'Note A');await page.getByRole('slider',{name:'Worst performer at maturity'}).fill('60');await expect(page.getByTestId('product-total')).toHaveText('$197,500');await page.getByRole('button',{name:'Save scenario',exact:true}).click();await page.getByRole('button',{name:'View all documents',exact:true}).click();await page.reload();await expect(page.locator('.document-row').first()).toContainText('Product scenario');
});
test('offline family facts, personal product distinction and insights',async({page,context})=>{
 await context.setOffline(true);await page.setViewportSize({width:390,height:844});await open(page,'#chat');await page.getByRole('textbox',{name:'Your message'}).fill('Explain my portfolio allocation');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByRole('log')).toContainText('28,469,027');await expect(page.getByRole('log')).toContainText('80.7%');
 await page.getByRole('textbox',{name:'Your message'}).fill('What if my structured product falls 40%?');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByRole('log')).toContainText('Your held product is the AAPL Accumulator');await page.getByRole('button',{name:'View my product',exact:true}).click();await expect(page.locator('h1')).toHaveText('Product studio');
 await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Insights & actions',exact:true}).click();await expect(page.locator('.insight-card')).toHaveCount(3);await page.getByRole('button',{name:'Dismiss Liquidity',exact:true}).click();await expect(page.locator('.insight-card')).toHaveCount(2);await page.getByRole('button',{name:'Restore 1 dismissed insight'}).click();await expect(page.locator('.insight-card')).toHaveCount(3);
});
