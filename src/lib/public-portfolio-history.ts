export type PortfolioHistory={points:{date:string;value:number}[];total:number;coveragePct:number;priceAsOf:string|null;valuationAsOf:string;symbols:string[];savedDemo?:boolean};
type Scope={bank:string;book:string};
type Holding={id:string;value:number};
export type PublicHistoryDataset={histories:(PortfolioHistory&{scope:Scope;holdings:Holding[]})[]};

export function selectPublicHistory(data:PublicHistoryDataset,rows:Holding[],scope:Scope):PortfolioHistory {
 const result=data.histories.find(h=>h.scope.bank===scope.bank&&h.scope.book===scope.book);
 if(!result||!rows.length||result.holdings.length!==rows.length)throw Error('No matching demo history.');
 const values=new Map(result.holdings.map(h=>[h.id,h.value]));
 if(rows.some(h=>values.get(h.id)!==h.value)||Math.abs(result.total-rows.reduce((n,h)=>n+h.value,0))>.01)throw Error('Demo history does not match the displayed holdings.');
 if(result.points.length<2||result.points.some((p,i)=>!Number.isFinite(p.value)||p.value<0||(i>0&&p.date<=result.points[i-1].date)))throw Error('Invalid demo curve.');
 return result;
}
