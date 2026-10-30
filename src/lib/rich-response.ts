import {z} from 'zod';
import type {ResearchAnalysis} from './research-contract.ts';
const dataRef=z.string().startsWith('research:').max(500);
export const richResponseSchema=z.object({version:z.literal('1'),blocks:z.array(z.discriminatedUnion('type',[
 z.object({type:z.literal('company_evidence'),dataRef}).strict(),
 z.object({type:z.literal('cited_narrative'),heading:z.string().max(120),text:z.string().min(1).max(3000),kind:z.enum(['fact','inference','limitation']),evidenceIds:z.array(z.string()).max(16)}).strict(),
 z.object({type:z.literal('research_panel'),dataRef}).strict(),
 z.object({type:z.literal('comparison_table'),dataRef}).strict(),
 z.object({type:z.literal('narrative'),heading:z.string().max(100),text:z.string().min(1).max(2500)}).strict(),
 z.object({type:z.literal('sources'),dataRef,reused:z.boolean()}).strict(),
])).min(1).max(16)}).strict();
export type RichResponse=z.infer<typeof richResponseSchema>;
// The chart, table and model evidence use exactly the same common dates and prices.
export function comparisonRows(analysis:ResearchAnalysis){
 const histories=analysis.data.histories.filter(h=>h.status==='observed'&&h.points.length>0);
 if(!histories.length)return [];
 const maps=histories.map(h=>new Map(h.points.map(p=>[p.date,p.close])));
 const dates=histories[0].points.map(p=>p.date).filter(d=>maps.every(m=>m.has(d)));
 if(dates.length<2)return [];
 return histories.map((h,i)=>({symbol:h.symbol,firstDate:dates[0],lastDate:dates.at(-1)!,observations:dates.length,firstClose:maps[i].get(dates[0])!,lastClose:maps[i].get(dates.at(-1)!)!,priceChangePct:(maps[i].get(dates.at(-1)!)!/maps[i].get(dates[0])!-1)*100}));
}
export function researchResultId(a:ResearchAnalysis){return 'research:'+(a.data.run_id||a.data.histories.map(h=>h.snapshot_id||'missing').join(':'));}
export function buildRichResponse(analysis:ResearchAnalysis,reused:boolean,sections:{heading:string;text:string}[]=[],layout?:string[]):RichResponse{
 const ref=researchResultId(analysis),hasData=analysis.data.histories.some(h=>h.status==='observed'&&h.points.length>1),available:Record<string,unknown[]>={
 chart:hasData&&!reused?[{type:'research_panel',dataRef:ref}]:[],comparison:comparisonRows(analysis).length>0&&!analysis.data.optimization?[{type:'comparison_table',dataRef:ref}]:[],evidence:analysis.companyEvidence?[{type:'company_evidence',dataRef:ref}]:[],explanation:sections.map(s=>({type:'narrative',...s})),sources:[{type:'sources',dataRef:ref,reused}]};
 const order=[...new Set([...(layout?.length?layout:['chart','comparison','evidence','explanation']),'explanation','sources'])];
 return richResponseSchema.parse({version:'1',blocks:order.flatMap(k=>available[k]||[])});
}
