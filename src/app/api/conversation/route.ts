import {z} from 'zod';
import {sameOrigin,localRequest,hasSession,demoOwner} from '../../../lib/server.ts';
import {portfolioScopeSchema} from '../../../lib/portfolio-context-server.ts';
import {conversationStore} from '../../../lib/conversation-store.ts';
import {hybridStore} from '../../../lib/hybrid-store.ts';
export const runtime='nodejs';
const query=z.object({conversationId:z.string().uuid(),scope:portfolioScopeSchema,action:z.enum(['read','reset','dismiss_input']),inputKind:z.string().max(60).optional()}).strict();
export async function POST(request:Request){
 const owner=demoOwner(request);if(!owner||!sameOrigin(request)||!localRequest(request)||!hasSession(request))return Response.json({error:'Local session required.'},{status:403});
 let input;try{input=query.parse(await request.json());}catch{return Response.json({error:'Invalid conversation request.'},{status:400});}
 const store=conversationStore(),key=store.key(owner,input.conversationId,input.scope);
 if(input.action==='dismiss_input'){if(!input.inputKind)return Response.json({error:'Input kind required'},{status:400});store.declineInput(key,input.inputKind);return Response.json({saved:true},{headers:{'Cache-Control':'no-store'}});}
 if(input.action==='reset'){store.clear(key);hybridStore().reset(owner,input.conversationId);return Response.json({reset:true},{headers:{'Cache-Control':'no-store'}});}
 return Response.json({messages:store.messages(key),state:store.state(key)},{headers:{'Cache-Control':'no-store'}});
}
