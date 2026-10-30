import {z} from 'zod';
import {hasSession,localRequest,sameOrigin} from '../../../../lib/server';
import {loadOkonkwo} from '../../../../lib/okonkwo-server';
import {holdingHistories,reconstructHistory} from '../../../../lib/portfolio-history-server';
export const runtime='nodejs';
const schema=z.object({bank:z.string().max(80),book:z.string().max(100)}).strict();
export async function POST(request:Request){
 if(!localRequest(request)||!sameOrigin(request)||!hasSession(request))return Response.json({error:'Local session required.'},{status:403});
 let scope;try{scope=schema.parse(await request.json());}catch{return Response.json({error:'Invalid scope.'},{status:400});}
 try{const snapshot=await loadOkonkwo();if((scope.bank!=='all'&&!snapshot.holdings.some(h=>h.bank===scope.bank))||(scope.book!=='all'&&!snapshot.holdings.some(h=>h.bookId===scope.book&&(scope.bank==='all'||h.bank===scope.bank))))return Response.json({error:'Scope unavailable.'},{status:403});return Response.json(reconstructHistory(snapshot,await holdingHistories(snapshot),scope),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Historical prices are temporarily unavailable.'},{status:503});}
}
