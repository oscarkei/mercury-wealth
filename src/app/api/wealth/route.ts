import {clientVault} from '../../../lib/client-vault';
import {discussionBrief} from '../../../lib/discussion-brief';
import {z} from 'zod';
import {localRequest,sameOrigin,hasSession,demoOwner} from '../../../lib/server';
import {portfolioScopeSchema} from '../../../lib/portfolio-context-server';
import {loadWealthClient} from '../../../lib/wealth-client';
import {evaluateHeldFCN,fcnInputSchema} from '../../../lib/fcn-engine';
import {buildPortfolioProposal,proposalInputSchema} from '../../../lib/portfolio-proposal';
import {wealthResults} from '../../../lib/wealth-result-store';
export const runtime='nodejs';export const dynamic='force-dynamic';
const schema=z.object({scope:portfolioScopeSchema,language:z.enum(['en','zh-Hant','zh-Hans']).default('en'),action:z.enum(['calculate','display','save']),input:z.union([fcnInputSchema,proposalInputSchema]).optional(),resultId:z.string().uuid().optional()}).strict();
export async function POST(request:Request){const owner=demoOwner(request),headers={'Cache-Control':'no-store'};if(!owner||!localRequest(request)||!sameOrigin(request)||!hasSession(request))return Response.json({error:'SESSION_REQUIRED'},{status:403,headers});
 try{const req=schema.parse(await request.json()),store=wealthResults();if(req.action!=='calculate'){if(!req.resultId)throw Error('RESULT_REQUIRED');const result=store.get(owner,req.resultId,req.scope);if(req.action==='save'){const saved=store.save(owner,req.resultId,req.scope);const document=clientVault().upload(owner,{title:(req.language==='en'?'Discussion draft':req.language==='zh-Hant'?'討論草稿':'讨论草稿')+' '+result.id.slice(0,8),category:'Reports',scope:req.scope.book,product:result.kind==='fcn'?'inst_sn_fcn_ustech':'',mime:'text/plain',bytes:new TextEncoder().encode(discussionBrief(result,req.language))});return Response.json({...saved,documentId:(document.document as {id:string}).id},{headers});}return Response.json(result,{headers});}
  const client=await loadWealthClient(req.scope,request.signal,true);if(!req.input)throw Error('INPUT_REQUIRED');let body;
  if(req.input.kind==='fcn_scenario'){const input=req.input;const held=client.holdings.find(h=>h.instrumentId===input.instrumentId);if(!held||held.quantity<=0)throw Error('PRODUCT_NOT_HELD');body=evaluateHeldFCN(req.input,held.quantity*100);}else body=buildPortfolioProposal(client,req.input);
  return Response.json(store.put(owner,req.scope,client.version||client.asOf,body.kind,body),{headers});
 }catch(e){const code=e instanceof Error?e.message:'';const known=['RESULT_NOT_FOUND','PRODUCT_NOT_HELD','EMPTY_PORTFOLIO','LOCKED_PRODUCT_EXCEEDS_CAP','INFEASIBLE_CONSTRAINTS','CASH_INSUFFICIENT_FOR_COST'];return Response.json({error:known.includes(code)?code:'ANALYSIS_UNAVAILABLE'},{status:code==='RESULT_NOT_FOUND'?404:400,headers});}}
