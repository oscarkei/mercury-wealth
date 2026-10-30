import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {mkdirSync,chmodSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {stateDirectory} from './conversation-store.ts';
export class ProposalNotes{
 db:DatabaseSync;
 constructor(root=stateDirectory()){mkdirSync(root,{recursive:true,mode:0o700});const path=join(root,'proposal-notes.sqlite');this.db=new DatabaseSync(path);chmodSync(path,0o600);this.db.exec('PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,owner TEXT NOT NULL,proposal TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL);');}
 list(owner:string,proposal:string){return this.db.prepare('SELECT id,body,created FROM notes WHERE owner=? AND proposal=? ORDER BY created,id').all(owner,proposal);}
 add(owner:string,proposal:string,body:string){const id=randomUUID(),created=Date.now();this.db.prepare('INSERT INTO notes VALUES(?,?,?,?,?)').run(id,owner,proposal,body,created);return {id,body,created};}
 close(){this.db.close();}
}
let store:ProposalNotes|undefined;export const proposalNotes=()=>store??=new ProposalNotes();
