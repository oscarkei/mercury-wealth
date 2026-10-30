import {z} from 'zod';
import {localRequest,sameOrigin,hasSession,demoOwner} from '../../../lib/server';
import {proposalNotes} from '../../../lib/proposal-notes';
import {proposalsInScope} from '../../../lib/advisor-proposals';
import {portfolioScopeSchema} from '../../../lib/portfolio-context-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const input=z.object({action:z.enum(['list','add']),proposalId:z.string().max(80),scope:portfolioScopeSchema,body:z.string().trim().min(1).max(2000).optional()}).strict();
export async function POST(request:Request){const headers={'Cache-Control':'no-store'},owner=demoOwner(request);if(!owner||!localRequest(request)||!sameOrigin(request)||!hasSession(request))return Response.json({error:'SESSION_REQUIRED'},{status:403,headers});
 try{const req=input.parse(await request.json());if(!proposalsInScope(req.scope).some(p=>p.id===req.proposalId))return Response.json({error:'PROPOSAL_NOT_FOUND'},{status:404,headers});if(req.action==='add'){if(!req.body)throw Error('BODY_REQUIRED');return Response.json({note:proposalNotes().add(owner,req.proposalId,req.body),sent:false},{headers});}return Response.json({notes:proposalNotes().list(owner,req.proposalId),sent:false},{headers});}catch{return Response.json({error:'INVALID_REQUEST'},{status:400,headers});}}
