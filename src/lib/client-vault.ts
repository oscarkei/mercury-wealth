import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,writeFileSync,readFileSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {stateDirectory} from './conversation-store.ts';
export const documentCategories=['Identity & Account','Statements','Product Documents','Agreements','Reports'] as const;
export const documentStatuses=['Uploaded','Ready for review','Reviewed','Awaiting signature','Archived'] as const;
export class ClientVault {
 db:DatabaseSync;root:string;
 constructor(root=stateDirectory()){this.root=join(root,'vault');mkdirSync(this.root,{recursive:true,mode:0o700});this.db=new DatabaseSync(join(root,'client-experience.sqlite'));chmodSync(join(root,'client-experience.sqlite'),0o600);this.db.exec(`PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS documents(id TEXT NOT NULL,owner TEXT NOT NULL,title TEXT NOT NULL,category TEXT NOT NULL,scope TEXT NOT NULL,product TEXT NOT NULL,status TEXT NOT NULL,current_version INTEGER NOT NULL,created TEXT NOT NULL,PRIMARY KEY(owner,id));
 CREATE TABLE IF NOT EXISTS document_versions(id TEXT NOT NULL,owner TEXT NOT NULL,version INTEGER NOT NULL,blob TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,created TEXT NOT NULL,PRIMARY KEY(owner,id,version));
 CREATE TABLE IF NOT EXISTS document_activity(event TEXT PRIMARY KEY,id TEXT NOT NULL,owner TEXT NOT NULL,version INTEGER NOT NULL,action TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS notification_state(owner TEXT NOT NULL,id TEXT NOT NULL,state TEXT NOT NULL,PRIMARY KEY(owner,id));
 CREATE TABLE IF NOT EXISTS client_preferences(owner TEXT PRIMARY KEY,value TEXT NOT NULL);`);if(!this.db.prepare('PRAGMA table_info(documents)').all().some(c=>c.name==='tags'))this.db.exec("ALTER TABLE documents ADD COLUMN tags TEXT NOT NULL DEFAULT ''");}
 list(owner:string){return this.db.prepare('SELECT d.*,v.mime,v.size FROM documents d JOIN document_versions v ON d.owner=v.owner AND d.id=v.id AND d.current_version=v.version WHERE d.owner=? ORDER BY d.created DESC').all(owner);}
 detail(owner:string,id:string){const doc=this.db.prepare('SELECT * FROM documents WHERE owner=? AND id=?').get(owner,id);if(!doc)throw Error('NOT_FOUND');return {document:doc,versions:this.db.prepare('SELECT version,mime,size,created FROM document_versions WHERE owner=? AND id=? ORDER BY version DESC').all(owner,id),activity:this.db.prepare('SELECT version,action,created FROM document_activity WHERE owner=? AND id=? ORDER BY created DESC,rowid DESC').all(owner,id)};}
 upload(owner:string,input:{id?:string;expectedVersion?:number;title:string;category:string;scope:string;product:string;mime:string;bytes:Uint8Array;tags?:string}){
  const size=input.bytes.length;if(size===0||size>10*1024*1024)throw Error('INVALID_SIZE');
  const head=Buffer.from(input.bytes.slice(0,16));
  const valid=input.mime==='application/pdf'?head.subarray(0,5).toString()==='%PDF-':input.mime==='image/png'?head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):input.mime==='image/jpeg'?head[0]===255&&head[1]===216&&head[2]===255:input.mime==='text/plain'?!Buffer.from(input.bytes).includes(0):false;
  if(!valid||!documentCategories.includes(input.category as typeof documentCategories[number])||!input.title.trim()||input.title.length>160)throw Error('INVALID_FILE');
  const id=input.id||randomUUID(),blob=randomUUID(),now=new Date().toISOString();
  this.db.exec('BEGIN IMMEDIATE');
  try{const existing=this.db.prepare('SELECT current_version FROM documents WHERE owner=? AND id=?').get(owner,id) as {current_version:number}|undefined;
   if(input.id&&!existing)throw Error('NOT_FOUND');if(existing&&existing.current_version!==input.expectedVersion)throw Error('VERSION_CONFLICT');
   const version=(existing?.current_version||0)+1;
   writeFileSync(join(this.root,blob),input.bytes,{flag:'wx',mode:0o600});
   if(!existing)this.db.prepare('INSERT INTO documents(id,owner,title,category,scope,product,status,current_version,created,tags) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,owner,input.title.trim(),input.category,input.scope,input.product,'Uploaded',version,now,(input.tags||'').slice(0,200));
   else this.db.prepare("UPDATE documents SET current_version=?,status='Uploaded' WHERE owner=? AND id=?").run(version,owner,id);
   this.db.prepare('INSERT INTO document_versions VALUES(?,?,?,?,?,?,?)').run(id,owner,version,blob,input.mime,size,now);
   this.db.prepare('INSERT INTO document_activity VALUES(?,?,?,?,?,?)').run(randomUUID(),id,owner,version,existing?'New version uploaded':'Uploaded',now);this.db.exec('COMMIT');return this.detail(owner,id);
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 status(owner:string,id:string,status:string,expectedVersion:number){
  const transitions:Record<string,string[]>={'Uploaded':['Ready for review','Archived'],'Ready for review':['Reviewed','Archived'],'Reviewed':['Awaiting signature','Archived'],'Awaiting signature':['Reviewed','Archived'],'Archived':['Ready for review']};
  this.db.exec('BEGIN IMMEDIATE');try{const row=this.db.prepare('SELECT status,current_version FROM documents WHERE owner=? AND id=?').get(owner,id) as {status:string;current_version:number}|undefined;
   if(!row)throw Error('NOT_FOUND');if(row.current_version!==expectedVersion)throw Error('VERSION_CONFLICT');if(!transitions[row.status]?.includes(status))throw Error('INVALID_TRANSITION');
   this.db.prepare('UPDATE documents SET status=? WHERE owner=? AND id=?').run(status,owner,id);this.db.prepare('INSERT INTO document_activity VALUES(?,?,?,?,?,?)').run(randomUUID(),id,owner,row.current_version,status,new Date().toISOString());this.db.exec('COMMIT');return this.detail(owner,id);
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 file(owner:string,id:string,version:number){const row=this.db.prepare('SELECT v.blob,v.mime,d.title FROM document_versions v JOIN documents d ON d.owner=v.owner AND d.id=v.id WHERE v.owner=? AND v.id=? AND v.version=?').get(owner,id,version) as {blob:string;mime:string;title:string}|undefined;if(!row)throw Error('NOT_FOUND');return {...row,bytes:readFileSync(join(this.root,row.blob))};}
 notifications(owner:string){return this.db.prepare('SELECT id,state FROM notification_state WHERE owner=?').all(owner);}
 mark(owner:string,id:string,state:string){if(!['read','unread','cleared'].includes(state)||id.length>240)throw Error('INVALID_STATE');this.db.prepare('INSERT INTO notification_state VALUES(?,?,?) ON CONFLICT(owner,id) DO UPDATE SET state=excluded.state').run(owner,id,state);return this.notifications(owner);}
 preferences(owner:string,value?:unknown){if(value!==undefined)this.db.prepare('INSERT INTO client_preferences VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET value=excluded.value').run(owner,JSON.stringify(value));const row=this.db.prepare('SELECT value FROM client_preferences WHERE owner=?').get(owner) as {value:string}|undefined;return row?JSON.parse(row.value):{products:true,insights:true,documents:true};}
 close(){this.db.close();}
}
let vault:ClientVault|undefined;
export function clientVault(){return vault??=new ClientVault();}
