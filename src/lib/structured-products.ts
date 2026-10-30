export type ProductId='phoenix'|'note-a'|'fcn';
export type PathPreset='base'|'autocall'|'stress'|'recovery';
export const products=[
 {id:'phoenix' as const,name:'US Technology Autocall',subtitle:'Worst-of autocallable coupon note',issuer:'Issuer B',notional:450400,annualCoupon:10.2,tenor:6,strike:100,couponBarrier:70,protectionBarrier:60,autocallLevel:100,autocallFrom:3,maturity:'04 Jan 2027',underlyings:['AAPL','MSFT','NVDA'],color:'#746aa8'},
 {id:'note-a' as const,name:'Note A · Equity-linked note',subtitle:'Single-underlying, fixed coupon',issuer:'Issuer A',notional:250000,annualCoupon:8,tenor:6,strike:80,couponBarrier:0,protectionBarrier:80,autocallLevel:0,autocallFrom:0,maturity:'20 Nov 2026',underlyings:['AAPL'],color:'#9b8460'},
 {id:'fcn' as const,name:'Asia Equity Income Note',subtitle:'Worst-of fixed coupon note',issuer:'Issuer C',notional:310000,annualCoupon:12,tenor:6,strike:80,couponBarrier:0,protectionBarrier:80,autocallLevel:0,autocallFrom:0,maturity:'15 Dec 2026',underlyings:['0700.HK','9988.HK'],color:'#538278'}
];
export type Product=typeof products[number];
export const scenarioPaths:Record<PathPreset,number[]>={base:[100,98,96,94,97,95,92],autocall:[100,99,98,104,106,108,110],stress:[100,94,88,82,73,65,45],recovery:[100,94,68,56,66,74,82]};
export function productById(id:ProductId):Product{return products.find(p=>p.id===id)!;}
export function evaluateProduct(id:ProductId,path:number[],notional?:number){
 const p=productById(id),principal=notional??p.notional;
 if(!p||path.length!==7||path.some(x=>!Number.isFinite(x)||x<0||x>150)||!Number.isFinite(principal)||principal<=0)throw new Error('Invalid product scenario.');
 let coupon=0,calledAt:number|null=null;
 const observations:{month:number;level:number;coupon:number;called:boolean;active:boolean}[]=[];
 for(let month=1;month<=6;month++){
  const active=calledAt===null,level=path[month];
  const paid=active&&(p.couponBarrier===0||level>=p.couponBarrier)?principal*p.annualCoupon/100/12:0;
  const called=active&&p.autocallLevel>0&&month>=p.autocallFrom&&level>=p.autocallLevel;
  coupon+=paid;observations.push({month,level,coupon:paid,called,active});if(called)calledAt=month;
 }
 const final=path[6];
 const redemption=calledAt!==null?principal:id==='phoenix'?(final>=p.protectionBarrier?principal:principal*final/100):principal*Math.min(1,final/p.strike);
 const round=(n:number)=>Math.round(n*100)/100;
 return {principal,redemption:round(redemption),coupon:round(coupon),total:round(redemption+coupon),net:round(redemption+coupon-principal),calledAt,observations,final,capitalLoss:round(principal-redemption),missedCoupons:observations.filter(x=>x.active&&x.coupon===0).length};
}
export function projectedPayoff(id:ProductId,final:number){
 // A terminal-only view conditional on no earlier autocall. Historical coupons are separate.
 const p=productById(id);
 return id==='phoenix'?(final>=p.protectionBarrier?100:final):Math.min(100,final/p.strike*100);
}
