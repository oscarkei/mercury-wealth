import {z} from 'zod';
import {localRequest,sameOrigin,hasSession,demoOwner} from '../../../lib/server';
import {clientVault,documentCategories} from '../../../lib/client-vault';
import {family} from '../../../lib/family-portfolio';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){
 const owner=demoOwner(request);if(!localRequest(request)||!sameOrigin(request)||!hasSession(request)||!owner)return Response.json({error:'SESSION_REQUIRED'},{status:403,headers});
 if(Number(request.headers.get('content-length')||0)>11*1024*1024)return Response.json({error:'INVALID_SIZE'},{status:413,headers});
 try{const store=clientVault();
  if(request.headers.get('content-type')?.startsWith('multipart/form-data')){
   const form=await request.formData(),file=form.get('file');if(!(file instanceof File)||file.size>10*1024*1024)throw Error('INVALID_FILE');
   const scope=String(form.get('scope')||'all');if(scope!=='all'&&!family.books.some(b=>b.id===scope))throw Error('INVALID_SCOPE');
   const input=z.object({id:z.string().uuid().optional(),expectedVersion:z.number().int().positive().optional(),title:z.string().min(1).max(160),category:z.enum(documentCategories),product:z.string().max(120),tags:z.string().max(200).optional()}).parse({id:form.get('id')||undefined,expectedVersion:form.get('expectedVersion')?Number(form.get('expectedVersion')):undefined,title:form.get('title'),category:form.get('category'),product:form.get('product')||'',tags:form.get('tags')||''});
   return Response.json(store.upload(owner,{...input,scope,mime:file.type,bytes:new Uint8Array(await file.arrayBuffer())}),{headers});
  }
  const input=z.discriminatedUnion('action',[
   z.object({action:z.literal('list')}),z.object({action:z.literal('detail'),id:z.string().uuid()}),
   z.object({action:z.literal('status'),id:z.string().uuid(),status:z.string().max(30),version:z.number().int().positive()}),
   z.object({action:z.literal('mark'),id:z.string().min(1).max(240),state:z.enum(['read','unread','cleared'])}),
   z.object({action:z.literal('preferences'),value:z.object({products:z.boolean(),insights:z.boolean(),documents:z.boolean()}).optional()})
  ]).parse(await request.json());
  const result=input.action==='list'?{documents:store.list(owner),notifications:store.notifications(owner),preferences:store.preferences(owner)}:input.action==='detail'?store.detail(owner,input.id):input.action==='status'?store.status(owner,input.id,input.status,input.version):input.action==='mark'?store.mark(owner,input.id,input.state):store.preferences(owner,input.value);
  return Response.json(result,{headers});
 }catch(e){const code=e instanceof Error?e.message:'';const allowed=['NOT_FOUND','VERSION_CONFLICT','INVALID_TRANSITION','INVALID_SIZE','INVALID_FILE','INVALID_STATE','INVALID_SCOPE'];return Response.json({error:allowed.includes(code)?code:'INVALID_REQUEST'},{status:code==='NOT_FOUND'?404:code==='VERSION_CONFLICT'?409:400,headers});}
}
export async function GET(request:Request){const owner=demoOwner(request);if(!localRequest(request)||!hasSession(request)||!owner)return Response.json({error:'SESSION_REQUIRED'},{status:403,headers});
 try{const q=new URL(request.url).searchParams,id=z.string().uuid().parse(q.get('id')),version=z.coerce.number().int().positive().parse(q.get('version'));const file=clientVault().file(owner,id,version);return new Response(new Uint8Array(file.bytes),{headers:{...headers,'Content-Type':file.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.title),'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});}catch{return Response.json({error:'NOT_FOUND'},{status:404,headers});}}
