'use client';
import {useAppPreferences} from '../lib/app-preferences';
export default function AppPreferencesProvider({children}:{children:React.ReactNode}){useAppPreferences();return children;}
