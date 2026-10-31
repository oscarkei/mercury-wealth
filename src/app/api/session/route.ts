import { localRequest, sameOrigin, newSession, hasSession, demoOwner, newDemoOwner } from '../../../lib/server';
import {cloudConfig,cloudSession} from '../../../lib/cloud-analysis';
export const runtime='nodejs';
export async function POST(request:Request) {
  if(!localRequest(request)){
    const config=cloudConfig();
    return config?cloudSession(request,config):Response.json({error:'Cloud analysis is not connected yet. Configure the independent analysis service first.'},{status:503});
  }
  if(!sameOrigin(request))return Response.json({error:'ORIGIN_REJECTED'},{status:403});
  if(!localRequest(request))return Response.json({error:'REMOTE_TRIAL_NOT_PROVISIONED'},{status:503});
  const headers=new Headers({'Cache-Control':'no-store'});
  if(!hasSession(request))headers.append('Set-Cookie','mw_session='+newSession()+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800');
  if(!demoOwner(request))headers.append('Set-Cookie','mw_owner='+newDemoOwner()+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000');
  return Response.json({mode:'local-demo',memory:'persistent-local-sqlite',expiresIn:28800},{headers});
}
