import {currentWealthRuntime} from './wealth-runtime.ts';
import {AI_TIMEOUTS} from './ai-timeouts.ts';
import {z} from 'zod';
import {geminiJSON} from './gemini-json.ts';
import {bindEvidenceText,bindWithOneRepair} from './evidence-text.ts';
export async function explainWealth(instruction:string,payload:unknown,bindings:Record<string,string>,signal:AbortSignal,onRetry?:(delayMs:number)=>void){
 const detailed=/detail|in.depth|詳細|详细|深入|完整|逐項|逐项/i.test(currentWealthRuntime()?.input.message||'');
 const maxSections=detailed?3:1;
 const schema={type:'object',properties:{sections:{type:'array',minItems:1,maxItems:maxSections,items:{type:'object',properties:{heading:{type:'string'},text:{type:'string'}},required:['heading','text'],additionalProperties:false}}},required:['sections'],additionalProperties:false};
 const rules=' Write one key judgment and at most three explanatory sentences in a single short section unless the user explicitly requests detail in the requested response language. Lead with a judgment, explain the mechanism and connect it to the selected client. Use verified {{metric.key}} tokens for any numerical quantities or dates. Never insert numerical claims as literal digits or spelled-out numbers. Interpret the data rather than listing every holding. These approved demo facts may be used for personalized analysis. Do not repeat generic demo disclaimers. Do not claim unsupported calculations or actions. Do not infer index/active management style or constituent holdings from a fund name. No beta, covariance or look-through has been computed. Separate observed asset-class concentration from unmeasured factor overlap. When the answer is complete, stop without a closing question or unsolicited next step.';
 const initial=await geminiJSON(instruction+rules,{task:payload,verifiedMetrics:bindings},schema,signal,2400,{timeoutMs:AI_TIMEOUTS.explanation,attemptTimeoutMs:AI_TIMEOUTS.explanationAttempt,onRetry});
 const parse=(v:unknown)=>z.object({sections:z.array(z.object({heading:z.string().max(120),text:z.string().min(1).max(2800)}).strict()).min(1).max(maxSections)}).strict().parse(v).sections.map(s=>({heading:bindEvidenceText(s.heading,bindings),text:bindEvidenceText(s.text,bindings)}));
 const sections=await bindWithOneRepair(initial.data,parse,async(draft,error)=>(await geminiJSON(instruction+rules+' Repair the invalid reference or format. Copy token names exactly from verifiedMetrics; never invent a token alias. Replace every raw amount, percentage and date with its supplied token. Keep the answer direct and do not add new claims.',{task:payload,draft,error,verifiedMetrics:bindings},schema,signal,2400,{timeoutMs:AI_TIMEOUTS.explanationRepair,attemptTimeoutMs:AI_TIMEOUTS.explanationRepair})).data);
 return {...initial,text:sections.map(s=>s.heading+'\n'+s.text).join('\n\n')};
}
