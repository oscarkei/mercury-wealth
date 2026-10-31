import {DatabaseSync} from 'node:sqlite';
import {chmodSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export class CloudStore {
 constructor(path){mkdirSync(dirname(path),{recursive:true,mode:0o700});this.db=new DatabaseSync(path);chmodSync(path,0o600);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,conversation TEXT NOT NULL,state TEXT NOT NULL,payload TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,conversation TEXT NOT NULL,payload TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS runs_owner ON runs(owner,conversation,created);`);
 this.db.prepare("UPDATE jobs SET state='failed',payload=? WHERE state IN ('queued','running')").run(JSON.stringify({error:'The analysis service restarted. Please retry.'}));
 }
 create(id,owner,conversation){this.db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?)').run(id,owner,conversation,'queued','{}',Date.now());}
 update(id,state,payload){this.db.prepare('UPDATE jobs SET state=?,payload=? WHERE id=?').run(state,JSON.stringify(payload),id);}
 job(owner,id){const r=this.db.prepare('SELECT state,payload FROM jobs WHERE owner=? AND id=?').get(owner,id);return r?{status:r.state,...JSON.parse(r.payload)}:null;}
 save(owner,conversation,run){this.db.prepare('INSERT OR REPLACE INTO runs VALUES(?,?,?,?,?)').run(run.id,owner,conversation,JSON.stringify(run),Date.now());}
 run(owner,id,conversation){const r=this.db.prepare('SELECT payload,conversation FROM runs WHERE owner=? AND id=?').get(owner,id);return r&&(!conversation||conversation===r.conversation)?JSON.parse(r.payload):null;}
 history(owner,conversation){const id=conversation||this.db.prepare('SELECT conversation FROM runs WHERE owner=? ORDER BY created DESC LIMIT 1').get(owner)?.conversation;if(!id)return {conversationId:null,turns:[]};return {conversationId:id,turns:this.db.prepare('SELECT payload FROM (SELECT payload,created FROM runs WHERE owner=? AND conversation=? ORDER BY created DESC LIMIT 30) ORDER BY created').all(owner,id).map(r=>{const run=JSON.parse(r.payload);return {scope:{bank:run.portfolio_scope.bank,book:run.portfolio_scope.book},run};})};}
 allowed(owner,dailyLimit){const now=Date.now();return this.db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE created>?').get(now-86400000).n<dailyLimit&&this.db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE owner=? AND created>?').get(owner,now-3600000).n<20;}
 close(){this.db.close();}
}
