import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const url=pathToFileURL(resolve('../Mercury Wealth Interactive Demo.html')).href;

test('Ask keeps draft, source page and scroll; browser back and forward operate the sheet',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(url+'#portfolio');
 await page.getByRole('textbox',{name:'Search holdings'}).fill('UBS');
 await page.evaluate(()=>scrollTo(0,480));const scroll=await page.evaluate(()=>scrollY);
 const ask=page.getByRole('button',{name:'Ask Mercury',exact:true});await ask.click();
 await expect(page.getByRole('button',{name:'Close chat',exact:true})).toBeFocused();
 await page.getByRole('textbox',{name:'Your message'}).fill('Keep this unfinished question');
 await page.getByRole('button',{name:'Close chat',exact:true}).click();
 await expect(page.locator('[data-slot=sheet-content]')).toBeHidden();await expect(ask).toBeFocused();
 expect(Math.abs(await page.evaluate(()=>scrollY)-scroll)).toBeLessThan(3);
 await expect(page.getByRole('textbox',{name:'Search holdings'})).toHaveValue('UBS');
 await ask.click();await expect(page.getByRole('textbox',{name:'Your message'})).toHaveValue('Keep this unfinished question');
 await page.goBack();await expect(page.locator('[data-slot=sheet-content]')).toBeHidden();
 await page.goForward();await expect(page.locator('[data-slot=sheet-content]')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('[data-slot=sheet-content]')).toBeHidden();
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Products',exact:true}).click();await expect(page.locator('h1')).toHaveText('Product studio');
});

test('contextual product action closes Ask and keeps the calculated scenario',async({page})=>{
 await page.setViewportSize({width:390,height:786});await page.goto(url);
 await page.getByRole('button',{name:'Ask Mercury',exact:true}).click();await page.getByRole('textbox',{name:'Your message'}).fill('What if the example Phoenix note falls 40%?');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByRole('log')).toContainText('ends at 60%');await page.getByRole('button',{name:'Open this scenario',exact:true}).click();
 await expect(page.locator('[data-slot=sheet-content]')).toBeHidden();await expect(page.getByRole('slider',{name:'Worst performer at maturity'})).toHaveValue('60');
 await expect(page.getByTestId('product-total')).toHaveText('$469,542');await page.getByRole('button',{name:'Discuss this outcome'}).click();
 await expect(page.getByRole('dialog',{name:'Ask Mercury',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close chat',exact:true}).click();
 await expect(page.getByRole('button',{name:'Discuss this outcome'})).toBeFocused();
});

test('More exposes documents and incomplete data without suggesting verified performance',async({page})=>{
 await page.setViewportSize({width:360,height:780});await page.goto(url);
 await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Data & connections',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Historical NAV & cash flows needed');await expect(page.getByRole('dialog')).toContainText('Verified client details not linked');
 await expect(page.getByRole('button',{name:'Refresh connection'})).toBeDisabled();await page.getByRole('button',{name:'Prepare a data request'}).click();
 await expect(page.getByRole('textbox',{name:'Your question, goals or known facts'})).toContainText('historical NAV');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Documents & saved items',exact:true}).click();await expect(page.locator('h1')).toHaveText('Your documents');
});

test('short phone screen keeps input reachable and focus contained',async({page})=>{
 await page.setViewportSize({width:390,height:540});await page.goto(url+'#chat');
 const composer=page.locator('.chat-composer');const box=await composer.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(540);
 for(let i=0;i<12;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('[data-slot=sheet-content]'))).toBe(true);}
 await page.getByRole('textbox',{name:'Your message'}).fill('Explain my allocation');await page.getByRole('button',{name:'Send message'}).click();await expect(page.getByRole('log')).toContainText('Equities 80.7%');
});
