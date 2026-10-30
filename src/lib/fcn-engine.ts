import {z} from 'zod';
import data from './held-fcn-data.json' with {type:'json'};
export const fcnInputSchema=z.object({kind:z.literal('fcn_scenario'),instrumentId:z.literal('inst_sn_fcn_ustech'),basis:z.enum(['initial','snapshot']),shockPct:z.number().finite().min(-100).max(100),path:z.enum(['terminal_only','constant_path']),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict().superRefine((p,c)=>{if(!Number.isFinite(Date.parse(p.date))||new Date(p.date).toISOString().slice(0,10)!==p.date||p.date<data.asOf||p.date>data.terms.maturityDate)c.addIssue({code:'custom',message:'Date must be within the recorded snapshot and maturity.'});if(p.path==='terminal_only'&&p.date!==data.terms.maturityDate)c.addIssue({code:'custom',message:'Terminal-only payoff requires the maturity date.'});});
export type FCNInput=z.infer<typeof fcnInputSchema>;
export function evaluateHeldFCN(raw:FCNInput,notional:number){
 const input=fcnInputSchema.parse(raw);if(!Number.isFinite(notional)||notional<=0)throw Error('Invalid notional');
 const rows=data.underlyings.map(u=>{const initial=u.initialFixing.amount,base=input.basis==='initial'?initial:u.sourcePrice,price=base*(1+input.shockPct/100);return {symbol:u.symbol,initial,price,level:price/initial*100};});
 const worst=rows.reduce((a,b)=>a.level<b.level?a:b);const candidate=new Date((input.date>data.terms.autocallWindowStart?input.date:data.terms.autocallWindowStart)+'T00:00:00Z');while([0,6].includes(candidate.getUTCDay()))candidate.setUTCDate(candidate.getUTCDate()+1);const callDate=candidate.toISOString().slice(0,10);
 const called=input.path==='constant_path'&&worst.level>=data.terms.autocallLevelPct&&callDate<=data.terms.autocallWindowEnd;
 const principal=called||worst.level>=data.terms.strikePct?notional:notional*worst.level/data.terms.strikePct;
 return {kind:'fcn' as const,instrumentId:input.instrumentId,termsVersion:data.version,sourceImportId:data.sourceImportId,asOf:data.asOf,input,notional,underlyings:rows,worstSymbol:worst.symbol,worstLevel:worst.level,baselinePrincipal:notional,scenarioPrincipal:principal,principalDifference:principal-notional,called,callDate:called?callDate:null,eventDate:called?callDate:data.terms.maturityDate,settlementDate:null,observationCalendarVerified:false,coupon:null,totalPayoff:null,settlement:!called&&worst.level<data.terms.strikePct?'physical_share_equivalent':'cash',shareEquivalent:!called&&worst.level<data.terms.strikePct?notional/(worst.initial*data.terms.strikePct/100):null,limitations:data.limitations};
}
export type FCNResult=ReturnType<typeof evaluateHeldFCN>;
