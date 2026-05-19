import React, { useState } from 'react';
import BountyBoardPage from './BountyBoardPage';
import RewardsStorePage from './RewardsStorePage';

import type { Task } from '@/lib/types';

interface StaffEconomyPageProps {
  currentUserId: string;
  totalPoints: number;
  weeklyEfficiency: number;
  onBountyClaimed: (task: Task) => void;
  onPointsDeducted: (deducted: number) => void;
}

export default function StaffEconomyPage({ currentUserId, totalPoints, weeklyEfficiency, onBountyClaimed, onPointsDeducted }: StaffEconomyPageProps) {
  const [activeTab, setActiveTab] = useState<'bounties' | 'rewards'>('bounties');

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pt-28 px-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Economy Header & Navigation */}
      <div className="bg-surface-container rounded-3xl p-6 sm:p-8 border border-outline-variant/10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative z-10">
          <div>
            <h1 className="text-3xl font-black font-headline text-on-surface flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-4xl">local_play</span>
              Bounty & Rewards
            </h1>
            <p className="text-on-surface-variant font-medium mt-1">
              Earn points through bounties and spend them in the store.
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-surface p-4 rounded-2xl shadow-sm border border-outline-variant/10 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined font-black">wallet</span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Your Balance</p>
              <p className="text-2xl font-black font-headline text-tertiary">{totalPoints.toLocaleString()} <span className="text-sm">pts</span></p>
            </div>
            <div className="w-px h-10 bg-outline-variant/20 mx-2 hidden sm:block"></div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <span className="material-symbols-outlined font-black text-sm">bolt</span>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Weekly Efficiency</p>
                <p className="text-xl font-black font-headline text-emerald-500">{Math.round(weeklyEfficiency * 100)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Tab Switcher */}
        <div className="flex bg-surface p-1 rounded-xl mt-8 max-w-md mx-auto sm:mx-0 shadow-inner">
          <button
            onClick={() => setActiveTab('bounties')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-300 ${
              activeTab === 'bounties'
                ? 'bg-primary text-white shadow-md'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-lg">target</span>
            Bounty Board
          </button>
          <button
            onClick={() => setActiveTab('rewards')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-300 ${
              activeTab === 'rewards'
                ? 'bg-tertiary text-white shadow-md'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-lg">storefront</span>
            Rewards Store
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-6">
        {activeTab === 'bounties' ? (
          <BountyBoardPage currentUserId={currentUserId} onBountyClaimed={onBountyClaimed} />
        ) : (
          <RewardsStorePage currentUserId={currentUserId} totalPoints={totalPoints} onPointsDeducted={onPointsDeducted} />
        )}
      </div>
    </div>
  );
}
