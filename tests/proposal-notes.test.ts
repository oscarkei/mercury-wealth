import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProposalNotes} from '../src/lib/proposal-notes.ts';
import {proposalsInScope,adviserProposals} from '../src/lib/advisor-proposals.ts';
test('proposal notes persist and remain isolated by owner and proposal',()=>{
 const path=mkdtempSync(join(tmpdir(),'proposal-notes-'));let store=new ProposalNotes(path);
 try {const note=store.add('owner-a','proposal-a','Question about the cash reserve');assert.equal(store.list('owner-b','proposal-a').length,0);assert.equal(store.list('owner-a','proposal-b').length,0);store.close();store=new ProposalNotes(path);const rows=store.list('owner-a','proposal-a') as {id:string;body:string}[];assert.equal(rows.length,1);assert.equal(rows[0].id,note.id);assert.equal(rows[0].body,note.body);}finally{store.close();rmSync(path,{recursive:true,force:true});}
});
test('adviser records are scoped to the recorded bank and book, with source states intact',()=>{
 assert.equal(proposalsInScope({bank:'all',book:'all'}).length,2);
 assert.equal(proposalsInScope({bank:'UBS',book:'pf_okonkwo_corp'}).length,0);
 assert.equal(proposalsInScope({bank:'all',book:'pf_okonkwo_global'}).length,0);
 assert.equal(proposalsInScope({bank:'Julius Baer',book:'all'})[0].status,'sent');
 assert.equal(proposalsInScope({bank:'UBS',book:'pf_okonkwo_thematic'})[0].status,'executed');
 for(const p of adviserProposals){assert.equal(p.before.reduce((n,x)=>n+x,0),100);assert.equal(p.after.reduce((n,x)=>n+x,0),100);}
});
