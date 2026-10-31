import {test,expect} from '@playwright/test';
const base=process.env.MERCURY_PUBLIC_MOCK_BASE_URL;
test.skip(!base,'Requires a built public mock. Transport fixtures do not call DeepSeek.');
test('mobile cloud transport renders results and preserves context for the next question',async({page})=>{
 const requests:Record<string,any>[]=[],unexpected:string[]=[];
 const runs:Record<string,any>[]=[];
 await page.route('**/api/session',r=>r.fulfill({json:{mode:'cloud-demo'}}));
 await page.route('**/api/cloud-chat**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()==='POST'){
   const body=req.postDataJSON();requests.push(body);
   runs.push({id:crypto.randomUUID(),question:body.question,answer:requests.length===1?'Energy transport fixture answer':'Portfolio transport fixture answer',status:'completed',components:[],results:[],sources:[],followups:requests.length===1?[{label:'Portfolio impact',question:'對我持倉有咩影響'}]:[],portfolio_scope:{bank:'all',book:'all'}});
   return route.fulfill({status:202,json:{jobId:'fixture-job-'+requests.length}});
  }
  if(url.searchParams.has('history'))return route.fulfill({json:{conversationId:null,turns:[]}});
  if(url.searchParams.has('job'))return route.fulfill({json:{status:'complete',run:runs.at(-1)}});
  return route.fulfill({json:{run:runs.find(r=>r.id===url.searchParams.get('run'))}});
 });
 page.on('request',r=>{if(new URL(r.url()).pathname==='/api/hybrid'||r.url().includes(':3009'))unexpected.push(r.url());});
 await page.goto(base!+'/phone?size=fit#chat');
 const frame=page.frameLocator('#portal'),input=frame.locator('#chat-message');
 await input.fill('美國能源市場而家點睇');await input.press('Enter');
 await expect(frame.locator('.hybrid-result').first()).toContainText('Energy transport fixture answer');
 await frame.getByRole('button',{name:'Portfolio impact',exact:true}).click();
 await expect(frame.locator('.hybrid-result').last()).toContainText('Portfolio transport fixture answer');
 expect(requests).toHaveLength(2);expect(requests[1].previousId).toBe(runs[0].id);
 expect(requests[1].conversationId).toBe(requests[0].conversationId);
 expect(requests[1].scope).toEqual(requests[0].scope);expect(requests[1].followupIndex).toBe(0);
 expect(unexpected).toEqual([]);
});
