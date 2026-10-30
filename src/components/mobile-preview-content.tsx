'use client';
import {createContext,useContext,useEffect,type ReactNode} from 'react';

const PublicMock=createContext(false);
export const usePublicMock=()=>useContext(PublicMock);

export default function MobilePreviewContent({publicMock,children}:{publicMock:boolean;children:ReactNode}) {
 useEffect(()=>{
  if(window.self===window.top)window.location.replace('/phone?size=fit'+window.location.hash);
 },[]);
 return <PublicMock.Provider value={publicMock}>{children}</PublicMock.Provider>;
}
