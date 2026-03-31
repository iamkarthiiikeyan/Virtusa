import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import Chatbot from './Chatbot';

interface LayoutProps { children: ReactNode; }

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Subtle grid pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015] z-0"
        style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.4) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
      {/* Ambient glow */}
      <div className="fixed top-0 left-64 right-0 h-96 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-64 bg-cyan-500/[0.02] rounded-full blur-[100px]" />
        <div className="absolute top-0 right-1/4 w-96 h-64 bg-blue-600/[0.02] rounded-full blur-[100px]" />
      </div>
      <Sidebar />
      <Header />
      <main className="ml-64 pt-16 min-h-screen relative z-10">
        <div className="p-6">{children}</div>
      </main>
      <Chatbot />
    </div>
  );
}
