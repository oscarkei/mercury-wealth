'use client';
import {useEffect,useSyncExternalStore} from 'react';
import catalog from '../content/app-translations.json';
export type Language='en'|'zh-Hant'|'zh-Hans';
export type Theme='light'|'dark'|'system';
type Preferences={language:Language;theme:Theme};
const initial:Preferences={language:'en',theme:'system'};
let current=initial,loaded=false,watching=false;
const listeners=new Set<()=>void>();
function publish(){for(const fn of listeners)fn();}
function apply(){if(typeof document==='undefined')return;document.documentElement.lang=current.language;document.documentElement.dataset.theme=current.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):current.theme;}
export function updatePreferences(patch:Partial<Preferences>){current={...current,...patch};try{localStorage.setItem('mercury-preferences',JSON.stringify(current));}catch{}apply();publish();}
function load(){if(loaded||typeof window==='undefined')return;loaded=true;try{const p=JSON.parse(localStorage.getItem('mercury-preferences')||'{}');current={language:['en','zh-Hant','zh-Hans'].includes(p.language)?p.language:'en',theme:['light','dark','system'].includes(p.theme)?p.theme:'system'};}catch{}apply();publish();if(watching)return;watching=true;matchMedia('(prefers-color-scheme: dark)').addEventListener('change',apply);window.addEventListener('storage',e=>{if(e.key==='mercury-preferences'){loaded=false;load();}});}
export function useAppPreferences(){const prefs=useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>current,()=>initial);useEffect(load,[]);return {...prefs,setLanguage:(language:Language)=>updatePreferences({language}),setTheme:(theme:Theme)=>updatePreferences({theme})};}
export function locale(){return current.language==='zh-Hant'?'zh-HK':current.language==='zh-Hans'?'zh-CN':'en-US';}
export function translate(text:string,language:Language=current.language){if(language==='en')return text;const key=text.replace(/\s+/g,' ').trim();const retry=key.match(/^Retry explanation in (\d+)s$/);if(retry)return language==='zh-Hant'?retry[1]+' 秒後重試解說':retry[1]+' 秒后重试解释';const entry=(catalog as Record<string,string[]>)[key];return entry?.[language==='zh-Hant'?0:1]??text;}
export function localize<T>(value:T):T {return (typeof value==='string'?translate(value):Array.isArray(value)?value.map(v=>localize(v)):value) as T;}
export function copy(en:string,hant:string,hans:string){return current.language==='en'?en:current.language==='zh-Hant'?hant:hans;}

export function statusText(text:string,kind:'error'|'progress'='progress'){const translated=translate(text);if(current.language==='en'||translated!==text||/[\u3400-\u9fff]/.test(text))return translated;const seconds=text.match(/(?:in |Waiting )(\d+)(?:s| seconds)/i)?.[1];if(seconds)return copy('Retry available in '+seconds+' seconds.',seconds+' 秒後可重試。',seconds+' 秒后可重试。');return kind==='error'?copy('The request could not complete. Existing results are preserved. Please retry.','未能完成此要求，已有結果已保留，請重試。','未能完成此请求，已有结果已保留，请重试。'):copy('Working on your analysis…','正在處理分析…','正在处理分析…');}
