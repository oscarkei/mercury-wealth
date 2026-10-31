import {research} from '../engine.mjs';
import {executeTool} from '../research-tools.mjs';
import {portfolioSchemas,executePortfolio} from '../portfolio-tools.mjs';
import {publicPortfolio} from './portfolio.mjs';

// Cloud uses the existing native tool/UI mode. Local hybrid mode remains separate.
export function createCloudResearch({key,providerFetch=fetch,publicToolExecutor=executeTool}){
 return args=>research({...args,key,providerFetch,mode:'deepseek',selectUI:undefined,
  toolExecutor:(name,raw,run,options)=>Object.hasOwn(portfolioSchemas,name)
   ?executePortfolio(name,raw,run,{...options,portfolioLoader:async scope=>publicPortfolio(scope)})
   :publicToolExecutor(name,raw,run,options)});
}
