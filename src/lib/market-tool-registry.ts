import {z} from 'zod';
import {companyQuerySchema} from './company-evidence-contract.ts';
import {companyNews,companyFilings,financialFacts} from './company-evidence-server.ts';
import {portfolioScopeSchema,loadPortfolioContext} from './portfolio-context-server.ts';
import {calculatePortfolioExposure} from './portfolio-impact.ts';
import {familySnapshotSchema} from './family-contract.ts';
import {definitions} from './tool-definitions.ts';
import {accumulatorModel} from './accumulator-model.ts';
import family from './okonkwo-data.json' with {type:'json'};
export {marketToolRegistry,toolIds} from './tool-definitions.ts';
export const publicEvidenceTools=['company_news','company_filings','financial_facts'] as const;
export type PublicEvidenceTool=typeof publicEvidenceTools[number];
export async function executeEvidenceTool(tool:PublicEvidenceTool,input:unknown,signal:AbortSignal){
 const query=companyQuerySchema.parse(input),combined=AbortSignal.any([signal,AbortSignal.timeout(definitions[tool].timeoutMs)]);
 const operation={company_news:companyNews,company_filings:companyFilings,financial_facts:financialFacts}[tool];
 return operation(query,combined);
}
// Only server-owned scope can enter this gateway; model-returned account IDs are never accepted.
export async function executePortfolioTool(scope:unknown,symbols:string[],signal:AbortSignal){
 const validScope=portfolioScopeSchema.parse(scope),validSymbols=z.array(z.string().regex(/^[A-Z][A-Z0-9.-]{0,10}$/)).max(6).parse(symbols);
 const snapshot=familySnapshotSchema.parse(await loadPortfolioContext(validScope,signal));
 return calculatePortfolioExposure(snapshot,validSymbols,validScope);
}
export function executeAccumulatorTool(tool:'accumulator_terms'|'accumulator_scenario',snapshot:unknown,input:unknown={}){
 const client=familySnapshotSchema.parse(snapshot);
 if(!client.holdings.some(h=>h.instrumentId===family.accumulator.instrumentId))throw Error('This scope does not contain the supported accumulator.');
 if(tool==='accumulator_terms')return {terms:family.accumulator,path:null};
 const parameters=z.object({shockPct:z.number().min(-100).max(30),days:z.number().int().min(1).max(60)}).strict().parse(input);
 return {terms:family.accumulator,path:accumulatorModel(100+parameters.shockPct,parameters.days,family.accumulator.initialFixing)};
}
