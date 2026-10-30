import type {FamilyScope} from './family-portfolio.ts';
export type WealthPoint={date:string;value:number;contributions:number;growth:number};
// Independent teaching fixture. Never calibrated to current holdings or represented as bank history.
const books=[{id:'pf_okonkwo_global',bank:'UBS',opening:10000000,flow:100000,risk:1},{id:'pf_okonkwo_thematic',bank:'UBS',opening:3000000,flow:25000,risk:1},{id:'pf_okonkwo_corp',bank:'Julius Baer',opening:4000000,flow:0,risk:.45}];
const returns=[.012,-.008,.016,.004,-.014,.009,.021,-.006,.008,.011,-.019,.014,.006,.017,-.012,.003,.015,-.007,.009,.013,-.004,.018,-.011,.007];
export function illustrativeWealthHistory(scope:FamilyScope):WealthPoint[]{
 const selected=books.filter(b=>(scope.bank==='all'||b.bank===scope.bank)&&(scope.book==='all'||b.id===scope.book));if(!selected.length)return [];
 let values=selected.map(b=>b.opening),contributions=values.reduce((a,b)=>a+b,0),growth=100;
 const out:WealthPoint[]=[{date:'2024-06-19',value:contributions,contributions,growth}];
 returns.forEach((r,i)=>{const before=values.reduce((a,b)=>a+b,0),flows=selected.map(b=>i%3===2?b.flow:0);values=values.map((value,j)=>value*(1+r*selected[j].risk)+flows[j]);const value=values.reduce((a,b)=>a+b,0),flow=flows.reduce((a,b)=>a+b,0);growth*= (value-flow)/before;contributions+=flow;out.push({date:new Date(Date.UTC(2024,6+i,19)).toISOString().slice(0,10),value,contributions,growth});});return out;
}
export function historyWindow(points:WealthPoint[],period:string){if(!points.length)return points;const end=new Date(points.at(-1)!.date+'T00:00:00Z'),start=new Date(end);if(period==='All')return points;if(period==='YTD')start.setUTCMonth(0,1);else start.setUTCMonth(start.getUTCMonth()-({'1M':1,'3M':3,'6M':6,'1Y':12}[period]||24));return points.filter(p=>p.date>=start.toISOString().slice(0,10));}
