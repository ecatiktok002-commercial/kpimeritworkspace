"use client";

import React from 'react';

interface AppHeaderProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onProfileClick: () => void;
  avatarUrl: string;
}

const navItems = [
  { key: 'staff', label: 'Staff App', mIcon: 'dashboard' },
  { key: 'manager', label: 'Exec Dashboard', mIcon: 'insights' },
  { key: 'triage', label: 'Triage', mIcon: 'rule' },
  { key: 'skills', label: 'Skills', mIcon: 'psychology' },
];

export default function AppHeader({ activeView, onViewChange, onProfileClick, avatarUrl }: AppHeaderProps) {
  return (
    <>
      {/* Desktop Header */}
      <header className="w-full sticky top-0 z-[100] flex items-center justify-between px-6 py-4 border-b glass-header" style={{ borderColor: 'var(--outline-variant)', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: 'rgba(188,201,198,0.1)' }}>
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>grid_view</span>
          <h1 className="text-xl font-bold tracking-widest uppercase font-[Plus_Jakarta_Sans]" style={{ color: 'var(--primary)' }}>MeritKPI</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-8 mr-4">
            <nav className="flex gap-2 relative z-10">
              {navItems.map(item => (
                <button
                  key={item.key}
                  onClick={() => onViewChange(item.key)}
                  className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                    activeView === item.key ? 'font-bold' : 'hover:bg-gray-100'
                  }`}
                  style={{
                    color: activeView === item.key ? 'var(--primary)' : 'var(--on-surface-variant)',
                    backgroundColor: activeView === item.key ? 'rgba(0,104,95,0.1)' : undefined,
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div
            className="h-10 w-10 rounded-full overflow-hidden border-2 cursor-pointer hover:ring-2 transition-all shadow-sm"
            style={{ borderColor: 'var(--primary-container)', outlineColor: 'var(--primary)' }}
            onClick={onProfileClick}
          >
            <img src={avatarUrl} alt="User profile avatar" className="object-cover w-full h-full" />
          </div>
        </div>
      </header>

      {/* Mobile Bottom NavBar — only visible on small screens */}
      <nav className="fixed bottom-0 left-0 w-full z-[150] flex md:hidden justify-around items-center px-4 pb-6 pt-3 bg-white/95 backdrop-blur-xl border-t shadow-[0_-10px_40px_rgba(0,0,0,0.08)] rounded-t-3xl" style={{ borderColor: 'rgba(0,131,120,0.1)' }}>
        {navItems.map(item => (
          <a
            key={item.key}
            href="#"
            onClick={(e) => { e.preventDefault(); onViewChange(item.key); }}
            className="flex flex-col items-center justify-center p-2 transition-all"
            style={{
              color: activeView === item.key ? 'var(--primary)' : '#94a3b8',
              fontWeight: activeView === item.key ? 700 : 400,
            }}
          >
            <span
              className="material-symbols-outlined mb-1 text-[28px]"
              style={activeView === item.key ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.mIcon}
            </span>
          </a>
        ))}
      </nav>
    </>
  );
}
