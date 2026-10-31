import {z} from 'zod';
import {cloudConfig,cloudOrigin,cloudOwner,cloudRequest} from '../../../lib/cloud-analysis';
export const runtime='nodejs';
export const maxDuration=20;
const uuid=z.string().uuid();
const input=z.object({conversationId:uuid,question:z.string().trim().min(1).max(2500),previousId:uuid.optional(),followupIndex:z.number().int().min(0).max(1).optional(),language:z.enum(['en','zh-Hant','zh-Hans']),scope:z.object({bank:z.string().max(80),book:z.string().max(100)}).strict()}).strict();
const unavailable=()=>Response.json({error:'Cloud analysis is not connected yet. The local app is unchanged.'},{status:503});
export async function GET(request:Request){
 const config=cloudConfig();if(!config)return unavailable();const owner=cloudOwner(request,config);if(!owner)return Response.json({error:'Session required.'},{status:401});
 const q=new URL(request.url).searchParams,job=q.get('job'),run=q.get('run'),cid=q.get('conversationId');
 if([job,run,cid].some(v=>v!==null&&!uuid.safeParse(v).success))return Response.json({error:'Invalid analysis ID.'},{status:400});
 const path=job?'/v1/jobs/'+job:run?'/v1/runs/'+run:q.has('history')?'/v1/history'+(cid?'?conversationId='+cid:''):null;
 if(!path)return Response.json({error:'Analysis ID required.'},{status:400});
 try{return await cloudRequest(config,path,owner,{signal:request.signal});}catch{return unavailable();}
}
export async function POST(request:Request){
 const config=cloudConfig();if(!config)return unavailable();if(!cloudOrigin(request,config))return Response.json({error:'Origin rejected.'},{status:403});
 const owner=cloudOwner(request,config);if(!owner)return Response.json({error:'Session required.'},{status:401});
 let body;try{const raw=await request.text();if(raw.length>12000)throw Error();body=input.parse(JSON.parse(raw));}catch{return Response.json({error:'Invalid question or portfolio scope.'},{status:400});}
 try{return await cloudRequest(config,'/v1/jobs',owner,{method:'POST',body:JSON.stringify(body),signal:request.signal});}catch{return unavailable();}
}
export async function DELETE(request:Request){
 const config=cloudConfig();if(!config)return unavailable();const owner=cloudOwner(request,config),id=new URL(request.url).searchParams.get('job');
 if(!cloudOrigin(request,config)||!owner)return Response.json({error:'Session required.'},{status:403});
 if(!uuid.safeParse(id).success)return Response.json({error:'Invalid job.'},{status:400});
 try{return await cloudRequest(config,'/v1/jobs/'+id,owner,{method:'DELETE'});}catch{return unavailable();}
}
