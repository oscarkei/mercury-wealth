import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {mkdirSync,chmodSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {stateDirectory} from './conversation-store.ts';
export class WealthResults{
 db:DatabaseSync;
 constructor(root=stateDirectory()){mkdirSync(root,{recursive:true,mode:0o700});this.db=new DatabaseSync(join(root,'wealth-results.sqlite'));chmodSync(join(root,'wealth-results.sqlite'),0o600);this.db.exec(`PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS results(id TEXT PRIMARY KEY,owner TEXT NOT NULL,scope TEXT NOT NULL,snapshot TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY,owner TEXT NOT NULL,result_id TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL);`);}
 put(owner:string,scope:unknown,snapshot:string,kind:string,body:unknown){const id=randomUUID(),created=Date.now();this.db.prepare('INSERT INTO results VALUES(?,?,?,?,?,?,?)').run(id,owner,JSON.stringify(scope),snapshot,kind,JSON.stringify(body),created);return {id,created,snapshot,scope,kind,body};}
 get(owner:string,id:string,scope:unknown){const row=this.db.prepare('SELECT * FROM results WHERE id=? AND owner=? AND scope=?').get(id,owner,JSON.stringify(scope)) as {id:string;created:number;snapshot:string;kind:string;body:string;scope:string}|undefined;if(!row)throw Error('RESULT_NOT_FOUND');return {...row,scope:JSON.parse(row.scope),body:JSON.parse(row.body)};}
 save(owner:string,id:string,scope:unknown){const result=this.get(owner,id,scope),draft=randomUUID();this.db.prepare('INSERT INTO drafts VALUES(?,?,?,?,?)').run(draft,owner,id,JSON.stringify(result),Date.now());return {id:draft,resultId:id,status:'Draft',sent:false};}
 close(){this.db.close();}
}
let store:WealthResults|undefined;export function wealthResults(){return store??=new WealthResults();}
