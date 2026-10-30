import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import type {AssistantInput,AssistantEvent} from './assistant-contract.ts';
import type {ResearchMemory} from './research-memory.ts';
import type {FedPlan} from './fed-contract.ts';
import type {FamilySnapshot} from './family-contract.ts';

export type SavedTurn={id:string;role:'user'|'assistant';text:string;status:'running'|'complete'|'partial'|'failed';createdAt:number};
export type ConversationState={declinedInputs?:string[];selectedInstrumentId?:string;research?:ResearchMemory;topics:{kind:string;question:string;result:unknown;updatedAt:number}[];product?:AssistantInput['product'];path?:number[];lastPlan?:unknown};
export type AnalysisCheckpoint={input:AssistantInput;plan:FedPlan;model:string;client?:FamilySnapshot;research?:ResearchMemory;createdAt:number};
export function stateDirectory(){return resolve(process.env.MERCURY_STATE_DIR||join(process.cwd(),'.mercury'));}
export function persistentSessionSecret(){
 const root=stateDirectory();mkdirSync(root,{recursive:true,mode:0o700});const path=join(root,'session-secret');
 try{return readFileSync(path,'utf8').trim();}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 try{writeFileSync(path,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
 return readFileSync(path,'utf8').trim();
}
export class ConversationStore{
 private db:DatabaseSync;
 constructor(path=join(stateDirectory(),'conversations.sqlite')){
  mkdirSync(resolve(path,'..'),{recursive:true,mode:0o700});this.db=new DatabaseSync(path);chmodSync(path,0o600);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS conversations(key TEXT PRIMARY KEY,state TEXT NOT NULL DEFAULT '{}',revision INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS messages(key TEXT NOT NULL,id TEXT NOT NULL,role TEXT NOT NULL,text TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(key,id));
   CREATE TABLE IF NOT EXISTS results(key TEXT NOT NULL,id TEXT NOT NULL,event TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(key,id));
   CREATE TABLE IF NOT EXISTS reset_conversations(key TEXT PRIMARY KEY);
   CREATE TABLE IF NOT EXISTS tool_cache(key TEXT PRIMARY KEY,value TEXT NOT NULL,expires INTEGER NOT NULL);`);
 }
 key(owner:string,id:string,scope:unknown){return createHash('sha256').update(JSON.stringify([owner,id,scope||null])).digest('hex');}
 state(key:string):ConversationState{const row=this.db.prepare('SELECT state FROM conversations WHERE key=?').get(key) as {state:string}|undefined;return row?JSON.parse(row.state):{topics:[]};}
 messages(key:string):SavedTurn[]{return (this.db.prepare('SELECT id,role,text,status,created AS createdAt FROM messages WHERE key=? ORDER BY created,rowid').all(key) as unknown as SavedTurn[]);}
 private saveState(key:string,state:ConversationState){this.db.prepare('INSERT INTO conversations(key,state) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET state=excluded.state,revision=revision+1').run(key,JSON.stringify(state));}
 declineInput(key:string,kind:string){const state=this.state(key);state.declinedInputs=[...new Set([...(state.declinedInputs||[]),kind])];this.saveState(key,state);}
 setPlan(key:string,plan:unknown){if(this.db.prepare('SELECT key FROM reset_conversations WHERE key=?').get(key))return;const state=this.state(key);state.lastPlan=plan;this.saveState(key,state);}
 checkpoint(key:string,id:string):AnalysisCheckpoint|undefined{
  const row=this.db.prepare('SELECT event FROM results WHERE key=? AND id=?').get(key,id+':checkpoint') as {event:string}|undefined;
  return row?JSON.parse(row.event).checkpoint:undefined;
 }
 saveCheckpoint(key:string,input:AssistantInput,plan:FedPlan,model:string,client?:FamilySnapshot,research?:ResearchMemory){
  if(this.db.prepare('SELECT key FROM reset_conversations WHERE key=?').get(key))return;
  const checkpoint:AnalysisCheckpoint={input,plan,model,client,research,createdAt:Date.now()};
  this.db.prepare('INSERT OR REPLACE INTO results VALUES(?,?,?,?)').run(key,input.requestId+':checkpoint',JSON.stringify({type:'checkpoint',checkpoint}),Date.now());
 }
 resume(key:string,id:string){
  const checkpoint=this.checkpoint(key,id);
  const message=this.db.prepare('SELECT status FROM messages WHERE key=? AND id=?').get(key,id) as {status:string}|undefined;
  const row=this.db.prepare('SELECT event FROM results WHERE key=? AND id=?').get(key,id+':error') as {event:string}|undefined;
  const error=row?JSON.parse(row.event):undefined;
  if(!checkpoint||Date.now()-checkpoint.createdAt>2*60*60*1000||!['failed','partial'].includes(message?.status||'')||error?.stage!=='explanation')return undefined;
  const events=(this.db.prepare('SELECT event FROM results WHERE key=? AND id LIKE ? ORDER BY created,rowid').all(key,id+':%') as {event:string}[]).map(r=>JSON.parse(r.event) as AssistantEvent).filter(e=>['research_analysis','stock_analysis','analysis','portfolio_impact','wealth_scenario'].includes(e.type));
  return {checkpoint,events,retryAfterMs:Math.max(0,(error.retryAt||0)-Date.now())};
 }
 begin(key:string,input:AssistantInput){
  if(this.db.prepare('SELECT key FROM reset_conversations WHERE key=?').get(key))throw Error('CONVERSATION_RESET');
  const existing=this.db.prepare('SELECT status FROM messages WHERE key=? AND id=?').get(key,input.requestId);
  if(existing)throw Error('DUPLICATE_REQUEST');
  this.db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').run(key,input.requestId,'user',input.message,'running',Date.now());
  const state=this.state(key);if(input.interaction?.kind==='held_product')state.selectedInstrumentId=input.interaction.instrumentId;state.product=input.product;state.path=input.path;this.saveState(key,state);
 }
 record(key:string,input:AssistantInput,event:AssistantEvent){
  if(this.db.prepare('SELECT key FROM reset_conversations WHERE key=?').get(key))return;
  if(event.type==='input_request'){this.db.prepare('INSERT OR REPLACE INTO results VALUES(?,?,?,?)').run(key,input.requestId+':input_request',JSON.stringify(event),Date.now());return;}
  if(event.type==='error'){
   this.db.prepare('INSERT OR REPLACE INTO results VALUES(?,?,?,?)').run(key,input.requestId+':error',JSON.stringify({...event,retryAt:Date.now()+(event.retryAfterMs||0)}),Date.now());return;
  }
  if(!['research_analysis','stock_analysis','analysis','portfolio_impact','wealth_scenario','decision'].includes(event.type))return;
  const state=this.state(key),result=event.researchAnalysis||event.stockAnalysis||event.analysis||event.portfolioImpact||event.wealthScenario;
  if(event.researchAnalysis)state.research={analysis:event.researchAnalysis,reply:'',savedAt:Date.now()};
  if(result){state.topics.push({kind:event.type,question:input.message,result,updatedAt:Date.now()});state.topics=state.topics.slice(-24);}
  if(event.product)state.product=event.product;if(event.path)state.path=event.path;
  this.saveState(key,state);
  this.db.prepare('INSERT OR REPLACE INTO results VALUES(?,?,?,?)').run(key,input.requestId+':'+event.type,JSON.stringify(event),Date.now());
 }
 finish(key:string,input:AssistantInput,text:string,status:SavedTurn['status']){
  if(this.db.prepare('SELECT key FROM reset_conversations WHERE key=?').get(key))return;
  const state=this.state(key);if(state.research&&text&&this.db.prepare('SELECT id FROM results WHERE key=? AND id=?').get(key,input.requestId+':research_analysis'))state.research.reply=text;
  this.db.exec('BEGIN IMMEDIATE');try{
   this.db.prepare('UPDATE messages SET status=? WHERE key=? AND id=?').run(status,key,input.requestId);
   if(text)this.db.prepare('INSERT OR REPLACE INTO messages VALUES(?,?,?,?,?,?)').run(key,input.requestId+':reply','assistant',text,status,Date.now());
   this.saveState(key,state);this.db.exec('COMMIT');
  }catch(error){this.db.exec('ROLLBACK');throw error;}
 }
 context(key:string,message:string){
  const turns=this.messages(key).filter(t=>t.text&&t.status!=='running');
  const recent=turns.slice(-20),terms=message.toLowerCase().match(/[a-z]{3,}/g)||[];
  const older=turns.slice(0,-20).filter(t=>terms.some(term=>t.text.toLowerCase().includes(term))).slice(-6);
  return [...older,...recent].map(t=>({role:t.role,text:t.text.slice(0,6000)}));
 }
 clear(key:string){this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('INSERT OR IGNORE INTO reset_conversations VALUES(?)').run(key);for(const table of ['conversations','messages','results'])this.db.prepare('DELETE FROM '+table+' WHERE key=?').run(key);this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}}
 cached<T>(key:string,now=Date.now()):T|undefined{const row=this.db.prepare('SELECT value,expires FROM tool_cache WHERE key=?').get(key) as {value:string;expires:number}|undefined;return row&&row.expires>now?JSON.parse(row.value):undefined;}
 cache(key:string,value:unknown,ttlMs:number){this.db.prepare('INSERT OR REPLACE INTO tool_cache VALUES(?,?,?)').run(key,JSON.stringify(value),Date.now()+ttlMs);}
 close(){this.db.close();}
}
let store:ConversationStore|undefined;
export function conversationStore(){return store??=new ConversationStore();}
