import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
export type CloudConfig={base:string;token:string;secret:string;origin:string};
export function cloudConfig(env:Record<string,string|undefined>=process.env):CloudConfig|null {
 try{
  const u=new URL(env.MERCURY_ANALYSIS_URL||''),origin=new URL(env.MERCURY_PUBLIC_ORIGIN||'https://mercury-wealth-mu.vercel.app').origin;
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||!env.MERCURY_SERVICE_TOKEN||env.MERCURY_SERVICE_TOKEN.length<32||!env.MERCURY_SESSION_SECRET||env.MERCURY_SESSION_SECRET.length<32)return null;
  return {base:u.origin,token:env.MERCURY_SERVICE_TOKEN,secret:env.MERCURY_SESSION_SECRET,origin};
 }catch{return null;}
}
const sign=(value:string,config:CloudConfig)=>createHmac('sha256',config.secret).update(value).digest('hex');
export function cloudOrigin(request:Request,config:CloudConfig){return request.headers.get('origin')===config.origin&&request.headers.get('host')===new URL(config.origin).host&&request.headers.get('x-mercury-client')==='portal';}
export function cloudOwner(request:Request,config:CloudConfig){
 const raw=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('mw_cloud='))?.slice(9);if(!raw)return null;
 const [owner,expiry,sig,...extra]=raw.split('.');if(extra.length||!owner||!/^[a-f0-9-]{36}$/.test(owner)||!/^\d{13}$/.test(expiry||'')||Number(expiry)<=Date.now()||!/^[a-f0-9]{64}$/.test(sig||''))return null;
 return timingSafeEqual(Buffer.from(sig),Buffer.from(sign(owner+'.'+expiry,config)))?owner:null;
}
export function cloudSession(request:Request,config:CloudConfig){
 if(!cloudOrigin(request,config))return Response.json({error:'Origin rejected.'},{status:403});
 const owner=cloudOwner(request,config)||randomUUID(),value=owner+'.'+(Date.now()+8*3600000);
 return Response.json({mode:'cloud-demo',memory:'private-cloud-history',expiresIn:28800},{headers:{'Cache-Control':'no-store','Set-Cookie':'mw_cloud='+value+'.'+sign(value,config)+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800'}});
}
export async function cloudRequest(config:CloudConfig,path:string,owner:string,init:RequestInit={},fetcher:typeof fetch=fetch){
 const response=await fetcher(config.base+path,{...init,headers:{Authorization:'Bearer '+config.token,'X-Mercury-Owner':owner,'Content-Type':'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.any([init.signal||new AbortController().signal,AbortSignal.timeout(12000)])});
 return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
