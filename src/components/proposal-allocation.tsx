'use client';
import {copy,localize} from '../lib/app-preferences';
import {assetColors} from '../lib/family-portfolio';
export type AllocationRow={id:string;name:string;before:number;after:number};
export default function ProposalAllocation({rows,beforeLabel,afterLabel}:{rows:AllocationRow[];beforeLabel?:string;afterLabel?:string}){
 const before=beforeLabel||localize('Current'),after=afterLabel||copy('Proposed','建議後','建议后');
 return <div className="proposal-allocation"><div className="allocation-key"><span><i className="key-before"/>{before}</span><span><i className="key-after"/>{after}</span></div>{rows.map(r=><div className="allocation-pair" key={r.id} style={{'--allocation-color':assetColors[r.id]||'var(--asset-equity)'} as React.CSSProperties}><div><strong>{localize(r.name)}</strong><span>{r.after-r.before>0?'+':''}{(r.after-r.before).toFixed(1)} <small>pp</small></span></div><div className="allocation-bar-line"><div className="allocation-bar-track"><i className="before" style={{width:r.before+'%'}}/></div><span><span className="sr-only">{before} </span>{r.before.toFixed(1)}%</span></div><div className="allocation-bar-line"><div className="allocation-bar-track"><i style={{width:r.after+'%'}}/></div><span><span className="sr-only">{after} </span>{r.after.toFixed(1)}%</span></div></div>)}</div>;
}
