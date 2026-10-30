'use client';
import {useEffect,useState} from 'react';
import {usePublicMock} from './mobile-preview-content';
import {clientAPI} from '../lib/client-api';
import {copy,localize,useAppPreferences} from '../lib/app-preferences';
export type ClientNotice={id:string;title:string;body:string;category:'products'|'insights'|'documents';destination:string;source:string};
const demoKey='mercury-public-demo-notifications';
function demoRecords(){
 const data=JSON.parse(localStorage.getItem(demoKey)||'{}');
 return {documents:[],notifications:Array.isArray(data.notifications)?data.notifications.filter((n:any)=>typeof n?.id==='string'&&['read','unread','cleared'].includes(n.state)):[],preferences:{products:data.preferences?.products!==false,insights:data.preferences?.insights!==false,documents:data.preferences?.documents!==false}};
}
export function useClientRecords(){const publicMock=usePublicMock();const [records,setRecords]=useState<{documents:any[];notifications:{id:string;state:string}[];preferences:{products:boolean;insights:boolean;documents:boolean}}>({documents:[],notifications:[],preferences:{products:true,insights:true,documents:true}}),[error,setError]=useState(false);
 const saveDemo=(next:typeof records)=>{localStorage.setItem(demoKey,JSON.stringify(next));setRecords(next);setError(false);};
 const refresh=async()=>{try{setRecords(publicMock?demoRecords():await clientAPI({action:'list'}));setError(false);}catch{setError(true);}};
 useEffect(()=>{void refresh();const handler=()=>void refresh();window.addEventListener('mercury-records-changed',handler);return()=>window.removeEventListener('mercury-records-changed',handler);},[publicMock]);
 return {records,error,refresh,mark:async(id:string,state:string)=>{try{if(publicMock){const current=demoRecords();saveDemo({...current,notifications:[...current.notifications.filter((n:{id:string})=>n.id!==id),{id,state}]});return;}const notifications=await clientAPI({action:'mark',id,state});setRecords(r=>({...r,notifications}));setError(false);}catch{setError(true);}},preferences:async(value:typeof records.preferences)=>{try{if(publicMock){saveDemo({...demoRecords(),preferences:value});return;}const preferences=await clientAPI({action:'preferences',value});setRecords(r=>({...r,preferences}));setError(false);}catch{setError(true);}}};
}
export default function ClientNotifications({notices,states,error,onMark,onOpen}:{notices:ClientNotice[];states:{id:string;state:string}[];error:boolean;onMark:(id:string,state:string)=>Promise<void>;onOpen:(destination:string)=>void}){
 useAppPreferences();const [filter,setFilter]=useState('all');const state=(id:string)=>states.find(s=>s.id===id)?.state||'unread';
 const visible=notices.filter(n=>state(n.id)!=='cleared'&&(filter==='all'||filter==='unread'&&state(n.id)==='unread'||n.category===filter));
 return <section className="notification-center"><h2 id="modal-title">{localize('Notifications')}</h2>{error&&<p role="alert">{copy('Notification changes could not be saved. Please retry.','通知狀態暫時未能儲存，請重試。','通知状态暂时未能保存，请重试。')}</p>}<div className="segmented">{['all','unread','products','insights','documents'].map(f=><button key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{localize({all:'All',unread:'Unread',products:'Products',insights:'Insights',documents:'Documents'}[f]!)}</button>)}</div><button onClick={()=>void Promise.all(notices.filter(n=>state(n.id)==='read').map(n=>onMark(n.id,'cleared')))}>{localize('Clear read notifications')}</button>
 {visible.map(n=><article className="notification-item" key={n.id}><span className="badge">{localize(n.source)} · {localize(state(n.id)==='unread'?'Unread':'Read')}</span><h3>{localize(n.title)}</h3><p>{localize(n.body)}</p><div className="vault-actions"><button onClick={()=>{void onMark(n.id,'read');onOpen(n.destination);}}>{localize('View details')}</button><button onClick={()=>void onMark(n.id,state(n.id)==='read'?'unread':'read')}>{localize(state(n.id)==='read'?'Mark unread':'Mark read')}</button></div></article>)}{!visible.length&&<p>{localize('No notifications in this category.')}</p>}</section>;
}
