// Presentation contract mirrors the 3009 catalog. No analysis or tool selection here.
export type Point={date:string;value:number};
export type Component={type:string;title?:string;text?:string;kind?:string;field?:string;result_id?:string;result_ids?:string[];source_ids?:string[];headers?:string[];rows?:unknown[];items?:string[];steps?:{label:string;detail:string;source_ids?:string[]}[];question?:string;choices?:string[]};
export type Result={id:string;kind:string;title:string;source_id?:string;unit?:string;series_id?:string;provider?:string;frequency?:string;observations?:number;classification?:string;points?:Point[];first?:Point;last?:Point;change_pct?:number;change_absolute?:number;data?:Record<string,unknown>};
export type Source={id:string;title:string;url:string;publisher?:string;observation_end?:string;published_at?:string;coverage?:string};
export type HybridRun={id:string;question:string;answer:string;status:string;error?:string;components:Component[];results:Result[];sources:Source[];followups?:{label:string;question:string}[];warnings?:string[];elapsed_ms?:number;research_depth?:{depth:string};ui_decision?:{accepted?:Record<string,boolean>};trace?:{name:string;status:string;elapsed_ms?:number}[];test_review_status?:string;test_review?:string[];validation?:{status:string}};
export function clientComponents(run:HybridRun,titles={lead:'重點判斷',body:'重點與風險'}):Component[]{
 const best=new Map<string,Result>();
 for(const c of run.components||[]){if(c.type!=='chart')continue;const r=run.results.find(r=>r.id===c.result_id);if(!r)continue;const key=r.series_id||r.id;if(!best.has(key)||(r.observations||0)>(best.get(key)?.observations||0))best.set(key,r);}
 const items=(run.components||[]).filter(c=>{if(c.type!=='chart')return true;const r=run.results.find(r=>r.id===c.result_id);return r&&best.get(r.series_id||r.id)?.id===r.id;});
 if(run.research_depth?.depth!=='quick')return items;
 const first=items.find(c=>c.type==='research_section');if(!first)return items;
 const paragraphs=(first.text||'').split(/\n\s*\n/);if(paragraphs.length<2)return items;
 return [{...first,title:titles.lead,text:paragraphs.shift()},...items.filter(c=>c!==first&&c.type!=='research_section'),{...first,title:titles.body,text:paragraphs.join('\n\n')},...items.filter(c=>c!==first&&c.type==='research_section')];
}
export function comparisonSeries(rows:Result[]){
 if(rows.length<2)return [];
 const shared=(rows[0].points||[]).map(p=>p.date).filter(date=>rows.every(r=>r.points?.some(p=>p.date===date)));
 if(shared.length<2)return [];
 const result=rows.map(row=>{const values=new Map(row.points?.map(p=>[p.date,p.value]));const base=values.get(shared[0]);return {id:row.id,title:row.title,points:shared.map(date=>({date,value:base?values.get(date)!/base*100:NaN}))};});
 return result.every(r=>r.points.every(p=>Number.isFinite(p.value)))?result:[];
}
export function boundSources(run:HybridRun){
 const ids=new Set<string>();const add=(id:string)=>{const source=id.startsWith('R')?run.results.find(r=>r.id===id)?.source_id:id;if(source)ids.add(source);};
 for(const match of (run.answer||'').matchAll(/\[(?:source:)?([SR]\d+)\]/g))add(match[1]);
 for(const c of run.components||[]){for(const id of [c.result_id,...(c.result_ids||[]),...(c.source_ids||[])])if(id)add(id);for(const match of (c.text||'').matchAll(/\[(?:source:)?([SR]\d+)\]/g))add(match[1]);}
 return (run.sources||[]).filter(s=>ids.has(s.id));
}
