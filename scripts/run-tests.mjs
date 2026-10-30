import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const state=mkdtempSync(join(tmpdir(),'mercury-suite-'));
try{
 const files=readdirSync('tests').filter(name=>name.endsWith('.test.ts')).sort().map(name=>'tests/'+name);
 const result=spawnSync(process.execPath,['--experimental-strip-types','--test',...files],{stdio:'inherit',env:{...process.env,MERCURY_STATE_DIR:state}});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
}finally{rmSync(state,{recursive:true,force:true});}
