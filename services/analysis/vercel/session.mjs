import {createHmac,createCipheriv,createDecipheriv,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {deflateSync,inflateSync} from 'node:zlib';
const TTL=8*3600000;
export function createSessions(secret,now=Date.now){
 if(!secret||secret.length<16)throw Error('Server credential required.');
 // Independent purpose-derived keys; never expose provider or signing secrets.
 const derive=purpose=>createHmac('sha256',secret).update('mercury-vercel-v1:'+purpose).digest();
 const signing=derive('visitor'),encryption=derive('continuation');
 const sign=s=>createHmac('sha256',signing).update(s).digest('base64url');
 function owner(request){
  const raw=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('mw_cloud='))?.slice(9)||'';
  const [id,expiry,signature,...extra]=raw.split('.');
  if(extra.length||!/^[-a-f0-9]{36}$/.test(id||'')||!/^\d{13}$/.test(expiry||'')||Number(expiry)<now()||!signature)return null;
  const expected=sign(id+'.'+expiry);return signature.length===expected.length&&timingSafeEqual(Buffer.from(signature),Buffer.from(expected))?id:null;
 }
 function cookie(request){const id=owner(request)||randomUUID(),value=id+'.'+(now()+TTL);return 'mw_cloud='+value+'.'+sign(value)+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800';}
 function seal(run,id,conversationId){
  // Trace duplicates entire tool outputs. It is not needed to continue a conversation.
  const {trace,usage,validation,raw_answer,ui_decision,owner:ignored,...context}=run;
  const raw=Buffer.from(JSON.stringify({v:1,owner:id,conversationId,expiry:now()+TTL,run:context}));
  if(raw.length>2_000_000)return null;
  const compressed=deflateSync(raw);if(compressed.length>190_000)return null;
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryption,iv);
  return Buffer.concat([iv,cipher.update(compressed),cipher.final(),cipher.getAuthTag()]).toString('base64url');
 }
 function open(token,id,cid,scope,previousId){
  if(typeof token!=='string'||token.length>260000||!/^[\w-]+$/.test(token))throw Error('Invalid continuation.');
  const bytes=Buffer.from(token,'base64url');if(bytes.length<29)throw Error('Invalid continuation.');
  const decipher=createDecipheriv('aes-256-gcm',encryption,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(-16));
  const packed=Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]);
  const state=JSON.parse(inflateSync(packed,{maxOutputLength:2_000_000}).toString());
  if(state.v!==1||state.owner!==id||state.conversationId!==cid||state.expiry<now()||state.run.id!==previousId||state.run.portfolio_scope?.key!==scope.key)throw Error('Continuation expired or belongs to another scope/session.');
  return state.run;
 }
 return {owner,cookie,seal,open};
}
