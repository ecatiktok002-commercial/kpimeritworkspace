"use client";

import React, { useState } from 'react';

interface AddAchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (icon: string, title: string, desc: string, trigger: string, taskReq?: string, triggerVal?: number) => void;
}

export default function AddAchievementModal({ isOpen, onClose, onSubmit }: AddAchievementModalProps) {
  const [icon, setIcon] = useState('military_tech');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [trigger, setTrigger] = useState('TASK_TIER_3');
  const [taskReq, setTaskReq] = useState('');
  const [triggerVal, setTriggerVal] = useState<number>(1);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!title) {
      alert('Achievement Title required.');
      return;
    }
    onSubmit(icon, title, desc, trigger, taskReq || undefined, triggerVal);
    setIcon('military_tech');
    setTitle('');
    setDesc('');
    setTrigger('TASK_TIER_3');
    setTaskReq('');
    setTriggerVal(1);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-surface-container-lowest rounded-[40px] p-8 shadow-2xl w-full max-w-md border border-outline-variant/10 relative animate-in zoom-in-95 duration-300"
      >
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Badge Registry</p>
            <h3 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">System Milestone</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-error/10 hover:text-error transition-all active:scale-90 text-on-surface-variant shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto no-scrollbar space-y-6">
          <div className="grid grid-cols-1 gap-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-3 text-on-surface-variant ml-1">Select Icon</label>
            <div className="grid grid-cols-5 gap-2 mb-4 bg-surface-container rounded-3xl p-4 shadow-inner">
              {[
                'star', 'bolt', 'military_tech', 'workspace_premium', 'trophy', 
                'verified', 'local_fire_department', 'rocket', 'speed', 'terminal', 
                'code', 'psychology', 'group', 'leaderboard', 'insights', 
                'auto_awesome', 'diamond', 'shield', 'celebration', 'emoji_events'
              ].map(i => (
                <button 
                  key={i}
                  onClick={() => setIcon(i)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    icon === i 
                      ? 'bg-primary text-white shadow-lg scale-110' 
                      : 'bg-white/50 text-on-surface-variant hover:bg-white hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{i}</span>
                </button>
              ))}
            </div>
            
            <div className="relative">
              <input 
                value={icon} 
                onChange={e => setIcon(e.target.value)} 
                className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-secondary/30 focus:ring-4 focus:ring-secondary/5 transition-all shadow-inner pl-12" 
                placeholder="Or type custom material icon name..." 
              />
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary">
                {icon || 'help'}
              </span>
            </div>
          </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Achievement Name</label>
              <input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-secondary/30 focus:ring-4 focus:ring-secondary/5 transition-all shadow-inner" 
                placeholder="E.g., Infrastructure Architect" 
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Logic Trigger</label>
              <div className="relative">
                <select 
                  value={trigger} 
                  onChange={e => setTrigger(e.target.value)} 
                  className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-secondary/30 focus:ring-4 focus:ring-secondary/5 transition-all cursor-pointer shadow-inner appearance-none pr-12"
                >
                  <option value="TASK_COMPLETED">Task Completed</option>
                  <option value="TASK_TIER_3">Task Tier 3 Efficiency</option>
                  <option value="LOGIN_SEQ">7-Day Sync Sequence</option>
                  <option value="MODULE_DONE">Capability Module Mastery</option>
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">unfold_more</span>
              </div>
            </div>

            {trigger === 'TASK_COMPLETED' && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-primary ml-1">Required Task</label>
                  <input 
                    value={taskReq} 
                    onChange={e => setTaskReq(e.target.value)} 
                    className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner" 
                    placeholder="Task Name" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-primary ml-1">Trigger Count</label>
                  <input 
                    type="number"
                    value={triggerVal} 
                    onChange={e => setTriggerVal(parseInt(e.target.value) || 0)} 
                    className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner" 
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Achievement Description</label>
              <textarea 
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface text-sm focus:border-secondary/30 focus:ring-4 focus:ring-secondary/5 transition-all resize-none h-24 shadow-inner" 
                placeholder="Describe the requirements for this milestone..." 
              />
            </div>
          </div>
        </div>

        <div className="pt-6">
          <button 
            onClick={handleSubmit} 
            className="mission-gradient w-full text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all border border-white/10"
          >
            Deploy Milestone
          </button>
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-on-surface-variant font-bold uppercase tracking-tighter">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            Live synchronization enabled for all accounts
          </div>
        </div>
      </div>
    </div>
  );
}
