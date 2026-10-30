import {inputRequestSchema} from './interactive-ui';
import {wealthScenarioSchema} from './wealth-scenario-contract';
import {portfolioImpactSchema} from './portfolio-impact';
import {richResponseSchema} from './rich-response';
import {stockAnalysisSchema} from './stock-contract';
import {fedAnalysisSchema} from './fed-contract';
import {researchAnalysisSchema} from './research-contract';
import {destinations,focuses,type AssistantInput,type AssistantEvent} from './assistant-contract';
export async function requestAssistant(input:AssistantInput,signal:AbortSignal,onEvent:(event:AssistantEvent)=>void){
 const headers={'Content-Type':'application/json','x-mercury-client':'portal'};
 const session=await fetch('/api/session',{method:'POST',headers,signal,credentials:'same-origin'});
 if(!session.ok)throw Error('Could not start the local AI session. Reopen the AI demo and retry.');
 const response=await fetch('/api/assistant',{method:'POST',headers,signal,credentials:'same-origin',body:JSON.stringify(input)});
 if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(typeof body.error==='string'?body.error:'AI connection failed. Check the local server.');}
 if(!response.body)throw Error('The AI service returned an empty response.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',done=false;
 function line(raw:string){if(!raw.trim())return;const event=JSON.parse(raw) as AssistantEvent;if(event.requestId!==input.requestId||event.revision!==input.revision||signal.aborted)return;
  if(event.type==='decision'&&(!event.destination||!destinations.includes(event.destination)||!event.focus||!focuses.includes(event.focus)||!['phoenix','note-a','fcn'].includes(event.product||'')||event.path?.length!==7||event.path.some(n=>!Number.isFinite(n)||n<0||n>150)))throw Error('The AI service returned an invalid action.');
  if(event.type==='input_request')event.inputRequest=inputRequestSchema.parse(event.inputRequest);
  if(event.type==='wealth_scenario')event.wealthScenario=wealthScenarioSchema.parse(event.wealthScenario);
  if(event.type==='portfolio_impact')event.portfolioImpact=portfolioImpactSchema.parse(event.portfolioImpact);
  if(event.type==='rich_response')event.richResponse=richResponseSchema.parse(event.richResponse);
  if(event.type==='analysis')event.analysis=fedAnalysisSchema.parse(event.analysis);
  if(event.type==='stock_analysis')event.stockAnalysis=stockAnalysisSchema.parse(event.stockAnalysis);
  if(event.type==='research_analysis')event.researchAnalysis=researchAnalysisSchema.parse(event.researchAnalysis);
  if(event.type==='done')done=true;onEvent(event);
 }
 try{while(true){const {value,done:ended}=await reader.read();if(ended)break;buffer+=decoder.decode(value,{stream:true});if(buffer.length>2000000)throw Error('AI response exceeded the supported size.');let at;while((at=buffer.indexOf('\n'))!==-1){line(buffer.slice(0,at));buffer=buffer.slice(at+1);}}buffer+=decoder.decode();line(buffer);if(!done&&!signal.aborted)throw Error('The AI response was interrupted. Please retry.');}finally{reader.releaseLock();}
}
