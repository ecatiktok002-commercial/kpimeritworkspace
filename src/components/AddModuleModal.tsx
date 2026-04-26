"use client";

import React, { useState } from 'react';

interface AddModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (code: string, title: string, desc: string, points: number) => void;
}

export default function AddModuleModal({ isOpen, onClose, onSubmit }: AddModuleModalProps) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [points, setPoints] = useState(100);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!title || !code) {
      alert('Module Code and Title are required.');
      return;
    }
    onSubmit(code, title, desc, points);
    setCode('');
    setTitle('');
    setDesc('');
    setPoints(100);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-surface-container-lowest rounded-[40px] p-8 shadow-2xl w-full max-w-md border border-outline-variant/10 relative animate-in zoom-in-95 duration-300"
      >
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Skills Curriculum</p>
            <h3 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">New Module</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-error/10 hover:text-error transition-all active:scale-90 text-on-surface-variant shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Module Code <span className="text-error">*</span></label>
              <input 
                value={code} 
                onChange={e => setCode(e.target.value)} 
                className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner" 
                placeholder="E.g., DEV-301" 
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Module Title <span className="text-error">*</span></label>
              <input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner" 
                placeholder="E.g., Intro to Microservices" 
              />
            </div>

            <div>
               <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Merit Points Reward</label>
               <input 
                 type="number"
                 value={points} 
                 onChange={e => setPoints(parseInt(e.target.value) || 0)} 
                 className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner" 
               />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Brief Description</label>
              <textarea 
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface text-sm focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all resize-none h-24 shadow-inner" 
                placeholder="What will participants learn?" 
              />
            </div>
          </div>
        </div>

        <div className="pt-6">
          <button 
            onClick={handleSubmit} 
            className="mission-gradient w-full text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all border border-white/10"
          >
            Create Module
          </button>
        </div>
      </div>
    </div>
  );
}
