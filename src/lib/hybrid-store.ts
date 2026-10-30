import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {conversationStore,stateDirectory} from './conversation-store.ts';
export type StoredHybridRun={id:string;question:string;answer:string;status:string;[key:string]:unknown};
export class HybridStore {
 private db:DatabaseSync;
 constructor(path?:string){if(!path)conversationStore();this.db=new DatabaseSync(path||join(stateDirectory(),'conversations.sqlite'));this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS hybrid_runs(id TEXT NOT NULL,owner TEXT NOT NULL,conversation_id TEXT NOT NULL,scope TEXT NOT NULL,run TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(owner,id));
 CREATE INDEX IF NOT EXISTS hybrid_conversation ON hybrid_runs(owner,conversation_id,created);
 CREATE TABLE IF NOT EXISTS hybrid_resets(owner TEXT NOT NULL,conversation_id TEXT NOT NULL,PRIMARY KEY(owner,conversation_id));`);}
 save(owner:string,conversationId:string,scope:{bank:string;book:string},run:StoredHybridRun){
  if(this.db.prepare('SELECT 1 FROM hybrid_resets WHERE owner=? AND conversation_id=?').get(owner,conversationId))return;
  this.db.prepare('INSERT OR IGNORE INTO hybrid_runs VALUES(?,?,?,?,?,?)').run(run.id,owner,conversationId,JSON.stringify(scope),JSON.stringify(run),Date.now());
 }
 run(owner:string,id:string){const row=this.db.prepare('SELECT run FROM hybrid_runs WHERE owner=? AND id=?').get(owner,id) as {run:string}|undefined;return row?JSON.parse(row.run):undefined;}
 history(owner:string,conversationId?:string){const id=conversationId||(this.db.prepare('SELECT conversation_id FROM hybrid_runs WHERE owner=? ORDER BY created DESC LIMIT 1').get(owner) as {conversation_id:string}|undefined)?.conversation_id;if(!id)return {conversationId:null,turns:[]};const rows=this.db.prepare('SELECT scope,run FROM (SELECT scope,run,created FROM hybrid_runs WHERE owner=? AND conversation_id=? ORDER BY created DESC LIMIT 30) ORDER BY created').all(owner,id) as {scope:string;run:string}[];return {conversationId:id,turns:rows.map(row=>({scope:JSON.parse(row.scope),run:JSON.parse(row.run)}))};}
 reset(owner:string,id:string){this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('INSERT OR IGNORE INTO hybrid_resets VALUES(?,?)').run(owner,id);this.db.prepare('DELETE FROM hybrid_runs WHERE owner=? AND conversation_id=?').run(owner,id);this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}}
 close(){this.db.close();}
}
let store:HybridStore|undefined;export const hybridStore=()=>store??=new HybridStore();
