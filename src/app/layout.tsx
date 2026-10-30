import type { Metadata } from 'next';
import './globals.css';
import AppPreferencesProvider from '../components/app-preferences-provider';
export const metadata: Metadata = {
  title: 'Mercury Wealth',
  description: 'Your wealth, in perspective. An interactive client portal demonstration.'
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><AppPreferencesProvider>{children}</AppPreferencesProvider></body></html>;
}
