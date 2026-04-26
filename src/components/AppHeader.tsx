"use client";

import React from 'react';

interface AppHeaderProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onProfileClick: () => void;
  avatarUrl: string;
  onSignOut: () => void;
  isManager: boolean;
}

export default function AppHeader({ activeView, onViewChange, onProfileClick, avatarUrl, onSignOut, isManager }: AppHeaderProps) {
  const navItems = [
    { key: 'staff', label: 'Staff App', mIcon: 'dashboard', showToStaff: true },
    { key: 'manager', label: 'Exec Dashboard', mIcon: 'insights', showToStaff: false },
    { key: 'triage', label: 'Triage', mIcon: 'rule', showToStaff: false },
    { key: 'skills', label: 'Skills', mIcon: 'psychology', showToStaff: true },
  ];

  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <header className="w-full fixed top-0 z-[100] glass-header">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            className="lg:hidden p-2 -ml-2 text-on-surface"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined font-black">grid_view</span>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-[0.2em] uppercase text-on-surface font-headline leading-tight">KPI</h1>
            <p className="text-[10px] font-bold tracking-[0.4em] uppercase text-primary -mt-1 opacity-80">MERIT</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <nav className="hidden lg:flex items-center gap-2">
            {navItems.filter(i => isManager || i.showToStaff).map(item => (
              <button
                key={item.key}
                onClick={() => onViewChange(item.key)}
                className={`nav-pill ${
                  activeView === item.key ? 'nav-pill-active' : 'nav-pill-inactive'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          
          <div className="h-10 w-px bg-outline-variant/30 mx-2 hidden lg:block" />

          <div className="flex items-center gap-4">
            <button 
              onClick={onSignOut} 
              className="text-xs font-bold uppercase tracking-widest text-error hover:bg-error/10 px-3 py-2 rounded-xl transition-all"
            >
              Sign Out
            </button>
            <div 
              className="h-12 w-12 rounded-2xl overflow-hidden border-2 border-surface-container cursor-pointer hover:border-primary transition-all shadow-sm shrink-0"
              onClick={onProfileClick}
            >
              <img alt="User profile" className="object-cover w-full h-full" src={avatarUrl}/>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-20 left-0 w-full bg-surface-container-high border-b border-outline-variant shadow-xl animate-in slide-in-from-top duration-300">
          <nav className="flex flex-col p-4 gap-2">
            {navItems.filter(i => isManager || i.showToStaff).map(item => (
              <button
                key={item.key}
                onClick={() => {
                  onViewChange(item.key);
                  setIsMobileMenuOpen(false);
                }}
                className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold transition-all ${
                  activeView === item.key 
                    ? 'bg-primary text-on-primary shadow-md' 
                    : 'text-on-surface hover:bg-surface-container-highest'
                }`}
              >
                <span className="material-symbols-outlined">{item.mIcon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
