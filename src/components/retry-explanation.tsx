"use client";
// mercury-localized
import {localize,useAppPreferences,locale} from "../lib/app-preferences";
import {useEffect,useState} from 'react';
export default function RetryExplanation({readyAt,disabled,onRetry}:{readyAt:number;disabled:boolean;onRetry:()=>void}){
 useAppPreferences();

 const [now,setNow]=useState(Date.now());
 const remaining=Math.max(0,Math.ceil((readyAt-now)/1000));
 useEffect(()=>{if(readyAt<=Date.now()){setNow(Date.now());return;}const timer=setInterval(()=>{const current=Date.now();setNow(current);if(current>=readyAt)clearInterval(timer);},1000);return ()=>clearInterval(timer);},[readyAt]);
 return <button className="chat-action" type="button" disabled={disabled||remaining>0} onClick={onRetry}>{localize(remaining>0?`Retry explanation in ${remaining}s`:'Retry explanation')}<small>{localize("Reuse the saved plan and observations")}</small></button>;
}
