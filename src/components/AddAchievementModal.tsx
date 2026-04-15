"use client";

import React, { useState } from 'react';

interface AddAchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (icon: string, title: string, desc: string, trigger: string) => void;
}

export default function AddAchievementModal({ isOpen, onClose, onSubmit }: AddAchievementModalProps) {
  const [icon, setIcon] = useState('military_tech');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [trigger, setTrigger] = useState('TASK_TIER_3');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!title) {
      alert('Title required.');
      return;
    }
    onSubmit(icon, title, desc, trigger);
    setIcon('military_tech');
    setTitle('');
    setDesc('');
    setTrigger('TASK_TIER_3');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(19,27,46,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="rounded-3xl p-8 shadow-2xl w-full max-w-md border" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.2)' }}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold font-[Plus_Jakarta_Sans]" style={{ color: 'var(--on-surface)' }}>System Achievement</h3>
          <button onClick={onClose} className="rounded-full p-1 transition-colors hover:text-red-500" style={{ color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>Badge Icon (Material Symbol)</label>
            <input value={icon} onChange={e => setIcon(e.target.value)} className="w-full rounded-xl py-3 px-4 outline-none transition-all border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }} placeholder="E.g., star, bolt, verified" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>Achievement Name</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-xl py-3 px-4 outline-none transition-all border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }} placeholder="E.g., Bug Squasher" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full rounded-xl py-3 px-4 outline-none transition-all resize-none h-16 border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }} placeholder="Details about this milestone." />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>System Trigger</label>
            <select value={trigger} onChange={e => setTrigger(e.target.value)} className="w-full rounded-xl py-3 px-4 outline-none transition-all cursor-pointer border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }}>
              <option value="TASK_TIER_3">Task Tier 3 (Complex)</option>
              <option value="LOGIN_SEQ">Login Sequence</option>
              <option value="MODULE_DONE">Module Completed</option>
            </select>
          </div>
          <div className="pt-4">
            <button onClick={handleSubmit} className="w-full text-white py-3.5 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg hover:scale-[1.02] active:scale-95 transition-all mission-gradient" style={{ boxShadow: '0 10px 15px -3px rgba(0,104,95,0.2)' }}>
              Enable Achievement
            </button>
            <p className="text-[10px] text-center mt-3 px-2 leading-relaxed" style={{ color: 'var(--on-surface-variant)' }}>Once enabled, staff will immediately unlock this badge if they hit the designated Trigger.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
