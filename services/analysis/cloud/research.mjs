import {research} from '../engine.mjs';
import {executeTool} from '../research-tools.mjs';
import {portfolioSchemas,executePortfolio} from '../portfolio-tools.mjs';
import {publicPortfolio} from './portfolio.mjs';

// Analysis completes before evidence-bound presentation. No Laya runtime.
export function createCloudResearch({key,providerFetch=fetch,publicToolExecutor=executeTool}){
 return args=>research({...args,key,providerFetch,mode:'analysis-first',selectUI:undefined,
  toolExecutor:(name,raw,run,options)=>Object.hasOwn(portfolioSchemas,name)
   ?executePortfolio(name,raw,run,{...options,portfolioLoader:async scope=>publicPortfolio(scope)})
   :publicToolExecutor(name,raw,run,options)});
}
