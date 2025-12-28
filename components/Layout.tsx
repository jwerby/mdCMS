
import React from 'react';
import { Page, AuthState } from '../types';
import { Menu, Search, Github, Twitter, Cpu, EyeOff, UserCircle, BookOpen } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  auth: AuthState;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, auth, onNavigate, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <button 
            onClick={() => onNavigate(Page.HOME)}
            className="flex items-center gap-3 group"
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white group-hover:rotate-6 transition-transform shadow-lg shadow-indigo-200">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-xl font-black tracking-tighter text-slate-900">Lumina<span className="text-indigo-600">CMS</span></span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">Engine v2.1</span>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-10 text-sm font-bold text-slate-500 uppercase tracking-widest">
            <button 
              onClick={() => onNavigate(Page.HOME)} 
              className={`hover:text-indigo-600 transition-colors ${currentPage === Page.HOME ? 'text-indigo-600' : ''}`}
            >
              Journal
            </button>
            <button 
              onClick={() => onNavigate(Page.DOCUMENTATION)} 
              className={`hover:text-indigo-600 flex items-center gap-2 transition-colors ${currentPage === Page.DOCUMENTATION ? 'text-indigo-600' : ''}`}
            >
              Docs
            </button>
            {auth.isLoggedIn && (
              <button 
                onClick={() => onNavigate(Page.DRAFTS)} 
                className={`hover:text-indigo-600 flex items-center gap-2 transition-colors ${currentPage === Page.DRAFTS ? 'text-indigo-600' : ''}`}
              >
                <EyeOff className="w-4 h-4" /> Drafts
              </button>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {auth.isLoggedIn ? (
              <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
                <span className="text-xs font-bold text-slate-400 hidden sm:inline">Admin: {auth.user}</span>
                <button 
                  onClick={onLogout}
                  className="px-5 py-2.5 bg-slate-100 text-slate-900 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button 
                onClick={() => onNavigate(Page.ADMIN_LOGIN)}
                className="hidden sm:flex px-6 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
              >
                Admin Login
              </button>
            )}
            <button className="md:hidden p-2"><Menu className="w-6 h-6" /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="bg-slate-50 border-t border-slate-100 py-20 mt-32">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <Cpu className="w-7 h-7 text-indigo-600" />
                <span className="text-2xl font-black tracking-tighter">LuminaCMS</span>
              </div>
              <p className="text-slate-500 max-w-sm mb-10 leading-relaxed">
                The high-performance Markdown engine. Built for technical writers who demand speed and beauty without the database overhead.
              </p>
              <div className="flex gap-6">
                <a href="https://twitter.com" target="_blank" className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 transition-colors">
                  <Twitter className="w-4 h-4" />
                </a>
                <a href="https://github.com" target="_blank" className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-slate-900 transition-colors">
                  <Github className="w-4 h-4" />
                </a>
              </div>
            </div>
            <div>
              <h5 className="font-bold mb-6 uppercase text-xs tracking-[0.2em] text-slate-400">Navigation</h5>
              <ul className="space-y-4 text-slate-600 text-sm font-medium">
                <li onClick={() => onNavigate(Page.HOME)} className="hover:text-indigo-600 cursor-pointer transition-colors">Journal</li>
                <li onClick={() => onNavigate(Page.DOCUMENTATION)} className="hover:text-indigo-600 cursor-pointer transition-colors">Documentation</li>
                <li onClick={() => onNavigate(Page.ADMIN_LOGIN)} className="hover:text-indigo-600 cursor-pointer transition-colors">Admin Login</li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold mb-6 uppercase text-xs tracking-[0.2em] text-slate-400">Support</h5>
              <ul className="space-y-4 text-slate-600 text-sm font-medium">
                <li className="hover:text-indigo-600 cursor-pointer transition-colors">API Reference</li>
                <li className="hover:text-indigo-600 cursor-pointer transition-colors">Discord Community</li>
                <li className="hover:text-indigo-600 cursor-pointer transition-colors">Style Guide</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200/50 mt-20 pt-10 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            <span>© 2024 LuminaCMS Engine. All rights reserved.</span>
            <div className="flex gap-8">
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> Status: Operational</span>
              <span>Region: Global Edge</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
