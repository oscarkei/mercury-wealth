import {AI_TIMEOUTS} from '../src/lib/ai-timeouts.ts';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {runPlannedAssistant} from '../src/lib/fed-engine.ts';
import {withWealthRuntime} from '../src/lib/wealth-runtime.ts';
import {withGeminiModel} from '../src/lib/gemini-model-server.ts';
import {familySnapshotSchema} from '../src/lib/family-contract.ts';
import family from '../src/lib/okonkwo-data.json' with {type:'json'};
const require=createRequire(import.meta.url);require('@next/env').loadEnvConfig(process.cwd());
const input={conversationId:randomUUID(),requestId:randomUUID(),revision:1,message:'Explain the main concentration in my selected portfolio using the supplied holdings. Do not fetch market prices.',context:'Your whole portfolio',view:'overview',product:'phoenix',path:[100,98,96,94,97,95,92],history:[],portfolioScope:{household:'hh_okonkwo',bank:'all',book:'all'}};
const events=[],calls=[];const original=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 const start=Date.now();try{const response=await original(url,options);calls.push({service:new URL(String(url)).hostname,status:response.status,elapsed_ms:Date.now()-start});return response;}catch(error){calls.push({service:new URL(String(url)).hostname,transport_error:error?.cause?.code||error?.name||'unknown',elapsed_ms:Date.now()-start});throw error;}
};
try{
 await withWealthRuntime({input,state:{topics:[]},client:familySnapshotSchema.parse({source:'supabase',dataMode:'mock',household:family.household,householdId:'hh_okonkwo',asOf:family.asOf,retrievedAt:new Date().toISOString(),holdings:family.holdings,total:family.total}),skills:['mercury-response-ui'],depth:'medium'},()=>withGeminiModel('gemini-3.6-flash',()=>runPlannedAssistant(input,AbortSignal.timeout(AI_TIMEOUTS.workflow),event=>events.push(event))));
}finally{globalThis.fetch=original;}
const report={kind:'live_provider_check',model:'gemini-3.6-flash',snapshot:'imported demo baseline; no live Supabase refresh in this check',reply:events.find(e=>e.type==='reply')?.text||null,errors:events.filter(e=>e.type==='error').map(({code,message,stage,service})=>({code,message,stage,service})),calls,completed:events.some(e=>e.type==='reply')&&!events.some(e=>e.type==='error')};
await writeFile(new URL('../../../outputs/wealth-live-provider.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({completed:report.completed,errors:report.errors,calls:report.calls,replyCharacters:report.reply?.length||0}));
