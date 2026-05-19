"use client";

import React, { useState } from 'react';
import type { MeritConfig, ActivityLog, KeywordRule } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';

interface ManagerLedgerViewProps {
  config: MeritConfig;
  setConfig: (c: MeritConfig) => void;
  activityLog: ActivityLog[];
  viewedIds: string[];
  markViewed: (id: string) => void;
}

export default function ManagerLedgerView({
  config,
  setConfig,
  activityLog,
  viewedIds,
  markViewed
}: ManagerLedgerViewProps) {
  const handleSaveMeritConfig = async () => {
    const { error } = await supabase
      .from('system_configs')
      .upsert({ key: 'merit_config', value: config }, { onConflict: 'key' });
    
    if (error) {
      alert('Error saving merit configuration: ' + error.message);
    } else {
      alert('Merit logic updated successfully across the organization.');
    }
  };

  // Unified system activity + points ledger

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2 text-primary">Antigravity Logic</p>
          <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">Points Ledger</h2>
          <p className="text-on-surface-variant mt-2 text-lg">Configure the Antigravity Efficiency Engine and monitor distributions.</p>
        </div>
        <button 
          onClick={handleSaveMeritConfig}
          className="px-8 py-3 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          Deploy Global Logic
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* LEFT: Engine Configuration */}
        <div className="space-y-8">
          <div className="bg-white rounded-[40px] border border-outline-variant/10 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-outline-variant/10 bg-surface-container-lowest flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">speed</span>
              </div>
              <div>
                <h3 className="font-extrabold text-on-surface">Efficiency Configuration</h3>
                <p className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant opacity-60">5-Tier Global Multipliers</p>
              </div>
            </div>
            
            <div className="p-8 space-y-8">
              {[
                { id: 1, nameKey: 'tier1Name', multKey: 'multiplierTier1', desc: 'Routine, high-frequency tasks with low cognitive load.' },
                { id: 2, nameKey: 'tier2Name', multKey: 'multiplierTier2', desc: 'Standard operations with standardized calibration.' },
                { id: 3, nameKey: 'tier3Name', multKey: 'multiplierTier3', desc: 'Technical work requiring specialized expertise.' },
                { id: 4, nameKey: 'tier4Name', multKey: 'multiplierTier4', desc: 'Urgent resolutions and high-impact critical items.' },
                { id: 5, nameKey: 'tier5Name', multKey: 'multiplierTier5', desc: 'Expert-level breakthroughs or massive value delivery.' }
              ].map((tier) => (
                <div key={tier.id} className="group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-primary bg-primary/5 w-6 h-6 rounded-lg flex items-center justify-center">T{tier.id}</span>
                      <input 
                        className="font-black text-on-surface bg-transparent border-none focus:ring-0 outline-none p-0 text-base placeholder:opacity-30 w-48"
                        value={(config as any)[tier.nameKey]}
                        placeholder={`Tier ${tier.id} Name`}
                        onChange={e => setConfig({...config, [tier.nameKey]: e.target.value})}
                      />
                    </div>
                    <div className="flex items-center gap-2 bg-surface-container rounded-xl px-3 py-1.5 border border-outline-variant/10 group-focus-within:border-primary/30 transition-colors">
                      <span className="text-[10px] font-black text-on-surface-variant">x</span>
                      <input 
                        type="number" 
                        step="0.1"
                        className="w-12 bg-transparent border-none focus:ring-0 outline-none text-sm font-black text-primary p-0 text-right"
                        value={(config as any)[tier.multKey]}
                        onChange={e => setConfig({...config, [tier.multKey]: parseFloat(e.target.value) || 1})}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mb-4 leading-relaxed opacity-60">{tier.desc}</p>
                  <TierKeywordManager tierLevel={tier.id} config={config} setConfig={setConfig} />
                  {tier.id < 5 && <div className="mt-8 border-b border-outline-variant/5" />}
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 rounded-[32px] bg-primary/5 border border-primary/10 flex items-start gap-4">
             <span className="material-symbols-outlined text-primary">info</span>
             <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
               <strong className="text-primary uppercase tracking-widest text-[10px]">Multiplier Logic:</strong> Increasing multipliers elevates the value of specialized work relative to routine tasks. The Antigravity Mode uses these values as the ceiling for efficiency rewards.
             </p>
          </div>
        </div>

        {/* RIGHT: Unified System Activity Feed */}
        <div className="bg-white rounded-[40px] border border-outline-variant/10 shadow-xl overflow-hidden flex flex-col h-[900px]">
          <div className="px-8 py-6 border-b border-outline-variant/10 bg-surface-container-lowest flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined">analytics</span>
              </div>
              <div>
                <h3 className="font-extrabold text-on-surface">System Activity</h3>
                <p className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant opacity-60">Real-time Organization Feed</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-surface-container rounded-full text-[10px] font-black text-on-surface-variant">
              {activityLog.length} Events
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {activityLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30 grayscale">
                  <span className="material-symbols-outlined text-[64px]">database_off</span>
                  <p className="text-sm font-black mt-4 uppercase tracking-[0.2em]">No activity recorded</p>
                </div>
             ) : activityLog.slice(0, 50).map(entry => {
                const isUnread = entry.managerViewed === false && !viewedIds.includes(entry.id);
                const isPoints = entry.type === 'points_earned';
                
                return (
                  <div 
                    key={entry.id} 
                    onClick={() => markViewed(entry.id)}
                    className={`group flex items-center justify-between p-5 rounded-[24px] transition-all border cursor-pointer ${
                      isUnread || entry.isFlagged 
                        ? 'bg-error/5 border-error/20 shadow-sm' 
                        : 'bg-surface-container-low border-outline-variant/5 hover:border-primary/20 hover:bg-white hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center relative transition-transform group-hover:scale-110 ${
                        entry.isFlagged ? 'bg-error/10 text-error' : 
                        isPoints ? 'bg-primary/10 text-primary' :
                        'bg-on-surface/5 text-on-surface-variant'
                      }`}>
                        <span className="material-symbols-outlined text-[24px]">
                          {entry.isFlagged ? 'report' : 
                           isPoints ? 'military_tech' :
                           'info'}
                        </span>
                        {isUnread && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-error border-2 border-white animate-pulse shadow-sm shadow-error/50"></span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-black text-sm text-on-surface group-hover:text-primary transition-colors truncate">
                            {entry.staffName || 'System'}
                          </p>
                          {entry.isFlagged && <span className="text-[8px] font-black bg-error text-white px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">Flagged</span>}
                        </div>
                        <p className={`text-[10px] font-bold tracking-tight truncate ${entry.isFlagged ? 'text-error/70' : 'text-on-surface-variant opacity-60'}`}>
                          {entry.desc}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {isPoints ? (
                        <>
                          <p className={`text-xl font-black font-headline tracking-tighter ${entry.isFlagged ? 'text-error' : 'text-primary'}`}>
                            +{entry.points}
                          </p>
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-30">Merit Points</p>
                        </>
                      ) : (
                        <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-surface-container text-on-surface-variant`}>
                          Update
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
          
          <div className="p-6 bg-surface-container-lowest border-t border-outline-variant/10 text-center">
             <p className="text-[10px] font-bold text-on-surface-variant opacity-40 uppercase tracking-widest">Authorized system activity monitoring</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TierKeywordManager({ tierLevel, config, setConfig }: { tierLevel: number, config: MeritConfig, setConfig: (c: MeritConfig) => void }) {
  const [newKeyword, setNewKeyword] = useState('');
  const [newPoints, setNewPoints] = useState(0);

  // We use tierLevel for association to keep it stable.
  const rules = (config.keywordRules || []).filter(r => r.tierLevel === tierLevel);

  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    const rule: KeywordRule = {
      id: crypto.randomUUID(),
      keyword: newKeyword.trim(),
      points: newPoints,
      tierLevel
    };
    const newConfig = { ...config, keywordRules: [...(config.keywordRules || []), rule] };
    setConfig(newConfig);
    setNewKeyword('');
    setNewPoints(0);

    // Auto-save
    await supabase
      .from('system_configs')
      .upsert({ key: 'merit_config', value: newConfig }, { onConflict: 'key' });
  };

  const handleRemove = async (id: string) => {
    const newConfig = { ...config, keywordRules: (config.keywordRules || []).filter(r => r.id !== id) };
    setConfig(newConfig);
    
    // Auto-save
    await supabase
      .from('system_configs')
      .upsert({ key: 'merit_config', value: newConfig }, { onConflict: 'key' });
  };

  return (
    <div className="bg-surface-container rounded-3xl p-5 border border-outline-variant/10 shadow-inner">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
           <span className="material-symbols-outlined text-primary text-[16px]">key</span>
           <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">Keyword Overrides</p>
        </div>
        <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg">{rules.length} Active</span>
      </div>
      
      <div className="space-y-2 mb-4 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
        {rules.length === 0 ? (
          <p className="text-[9px] italic text-on-surface-variant opacity-40 py-2">No fixed point rules for this tier.</p>
        ) : rules.map(rule => (
          <div key={rule.id} className="flex items-center justify-between bg-white/50 p-3 rounded-2xl border border-outline-variant/5 group hover:border-primary/20 transition-all">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-on-surface">"{rule.keyword}"</span>
              <span className="text-[9px] font-bold text-primary uppercase tracking-tighter">{rule.points} Fixed Points</span>
            </div>
            <button onClick={() => handleRemove(rule.id)} className="text-on-surface-variant hover:text-error transition-colors p-1.5 hover:bg-error/5 rounded-xl">
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-white/30 p-2 rounded-2xl border border-outline-variant/5">
        <input 
          placeholder="New keyword..." 
          value={newKeyword}
          onChange={e => setNewKeyword(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none p-1 text-[11px] font-bold placeholder:opacity-30 min-w-0"
        />
        <div className="flex items-center gap-2">
          <div className="flex-1 sm:flex-none flex items-center gap-1 bg-white rounded-xl px-2 py-1 shadow-sm border border-outline-variant/10">
            <input 
              type="number"
              placeholder="Pts" 
              value={newPoints}
              onChange={e => setNewPoints(parseInt(e.target.value) || 0)}
              className="w-full sm:w-10 bg-transparent border-none outline-none text-[11px] font-black text-primary text-center p-0"
            />
            <span className="text-[9px] font-black text-on-surface-variant opacity-30 uppercase">Pts</span>
          </div>
          <button onClick={handleAdd} className="bg-primary text-white w-10 h-10 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
      </div>
    </div>
  );
}
