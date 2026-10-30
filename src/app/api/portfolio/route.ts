import {hasSession,localRequest,sameOrigin} from '../../../lib/server';
import {databaseConfigured,loadDatabasePortfolio} from '../../../lib/supabase-portfolio-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!localRequest(request)||!sameOrigin(request)||!hasSession(request))return Response.json({error:'Local session required.'},{status:403});
 if(!databaseConfigured())return Response.json({status:'not_configured'},{headers:{'Cache-Control':'no-store'}});
 try{return Response.json(await loadDatabasePortfolio(),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Database snapshot unavailable or changed. Showing the built-in demo snapshot.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
