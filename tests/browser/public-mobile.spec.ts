import {test,expect} from '@playwright/test';
const base=process.env.MERCURY_PUBLIC_MOCK_BASE_URL;
test.skip(!base,'Requires a built public mock (MERCURY_PUBLIC_MOCK=1 or VERCEL=1).');

test('desktop opens the mobile frame with distinct custodian curves and working Portfolio',async({page})=>{
 await page.setViewportSize({width:1440,height:1100});
 const failed:string[]=[];page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base!))failed.push(r.url());});
 const localAPI:string[]=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))localAPI.push(r.url());});
 await page.goto(base!);
 await expect(page).toHaveURL(/\/phone\?size=fit/);
 const frame=page.frameLocator('#portal');
 await expect(frame.locator('.home-wealth-slide[aria-hidden="false"] .wealth-line-stroke')).toBeVisible();
 const viewport=await frame.locator('html').evaluate(el=>el.clientWidth);
 expect(viewport).toBe(390);
 const curves=[];
 for(const bank of ['Total wealth','UBS','Julius Baer']){
  await frame.locator('.wealth-slide-dots').getByRole('button',{name:bank,exact:true}).click();
  await expect(frame.locator('.home-wealth-slide[aria-hidden="false"] .wealth-line-stroke')).toBeVisible();
  curves.push(await frame.locator('.home-wealth-slide[aria-hidden="false"] .wealth-line-stroke').getAttribute('d'));
 }
 expect(new Set(curves).size).toBe(3);
 await frame.locator('.wealth-slide-dots').getByRole('button',{name:'Total wealth',exact:true}).click();
 await expect(frame.locator('.home-wealth-slide[aria-hidden="false"] .wealth-line-stroke')).toBeVisible();
 for(const period of ['1M','3M','1Y']){
  await frame.getByRole('button',{name:period,exact:true}).click();
  await expect(frame.locator('.home-wealth-slide[aria-hidden="false"] .wealth-line-stroke')).toBeVisible();
 }
 await frame.locator('body').evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:'/private/tmp/mercury-public-mobile-desktop.png'});
 await frame.getByRole('button',{name:'Notifications',exact:true}).click();
 await frame.getByRole('button',{name:'Mark read',exact:true}).first().click();
 await page.keyboard.press('Escape');
 await frame.getByRole('button',{name:'Portfolio',exact:true}).click();
 await expect(frame.locator('.portfolio-overview .wealth-line-stroke')).toBeVisible();
 await expect(page).toHaveURL(/#portfolio$/);
 await page.reload();
 await expect(frame.locator('.portfolio-overview .wealth-line-stroke')).toBeVisible();
 expect(await frame.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('mercury-public-demo-notifications')||'{}').notifications.some((n:{state:string})=>n.state==='read'))).toBe(true);
 expect(failed).toEqual([]);
 expect(localAPI).toEqual([]);
});
test('a phone uses its full screen without horizontal overflow',async({browser})=>{
 const context=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 const page=await context.newPage();await page.goto(base!);
 const frame=page.frameLocator('#portal');await expect(frame.locator('.home-wealth-slide[aria-hidden="false"] .wealth-line-stroke')).toBeVisible();
 expect(await frame.locator('html').evaluate(el=>el.clientWidth)).toBe(375);
 expect(await frame.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await expect(frame.getByRole('button',{name:'More',exact:true})).toBeVisible();
 await page.screenshot({path:'/private/tmp/mercury-public-mobile-phone.png'});
 await context.close();
});
test('direct content URL returns to the frame and preserves the selected screen',async({page})=>{
 await page.goto(base!+'/mobile#portfolio');
 await expect(page).toHaveURL(/\/phone\?size=fit#portfolio$/);
 await expect(page.frameLocator('#portal').locator('.portfolio-overview .wealth-line-stroke')).toBeVisible();
});
test('a touch tablet retains the mobile frame in dark mode',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1024,height:1000},hasTouch:true});
 await context.addInitScript(()=>localStorage.setItem('mercury-preferences',JSON.stringify({theme:'dark',language:'zh-Hant'})));
 const page=await context.newPage();await page.goto(base!);
 const frame=page.frameLocator('#portal');await expect(frame.locator('.home-wealth-slide[aria-hidden="false"] .wealth-line-stroke')).toBeVisible();
 expect(await frame.locator('html').evaluate(el=>el.clientWidth)).toBe(390);
 await expect(frame.locator('html')).toHaveAttribute('data-theme','dark');
 await page.screenshot({path:'/private/tmp/mercury-public-mobile-dark.png'});
 await context.close();
});
