"use client";

import React, { useState } from 'react';

interface ModuleStepInput {
  title: string;
  description: string;
  contentUrl?: string;
}

interface AddModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (code: string, title: string, desc: string, points: number, steps: ModuleStepInput[]) => void;
}

export default function AddModuleModal({ isOpen, onClose, onSubmit }: AddModuleModalProps) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [points, setPoints] = useState(100);
  const [steps, setSteps] = useState<ModuleStepInput[]>([
    { title: 'Foundations', description: 'Basic introduction and core concepts.' }
  ]);

  if (!isOpen) return null;

  const handleAddStep = () => {
    setSteps([...steps, { title: '', description: '' }]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: keyof ModuleStepInput, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const handleSubmit = () => {
    if (!title || !code) {
      alert('Module Code and Title are required.');
      return;
    }
    if (steps.some(s => !s.title)) {
      alert('All steps must have at least a title.');
      return;
    }
    onSubmit(code, title, desc, points, steps);
    setCode('');
    setTitle('');
    setDesc('');
    setPoints(100);
    setSteps([{ title: 'Foundations', description: 'Basic introduction and core concepts.' }]);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-surface-container-lowest rounded-[40px] p-8 shadow-2xl w-full max-w-2xl border border-outline-variant/10 relative animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-8 sticky top-0 bg-surface-container-lowest z-10 pb-4 border-b border-outline-variant/5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Skills Curriculum</p>
            <h3 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">New Learning Module</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-error/10 hover:text-error transition-all active:scale-90 text-on-surface-variant shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-6">
             <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/40">Core Configuration</p>
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

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/40">Coursework Steps (A to Z)</p>
              <button 
                onClick={handleAddStep}
                className="text-primary font-bold text-[10px] uppercase tracking-widest flex items-center gap-1 hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">add</span> Add Step
              </button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
              {steps.map((step, idx) => (
                <div key={idx} className="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/10 relative group">
                  <div className="flex justify-between items-center mb-3">
                    <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                    <button 
                      onClick={() => handleRemoveStep(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant hover:text-error transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                  <div className="space-y-3">
                    <input 
                      value={step.title}
                      onChange={e => handleStepChange(idx, 'title', e.target.value)}
                      placeholder="Step Title"
                      className="w-full bg-white rounded-xl py-2 px-3 text-xs font-bold outline-none border border-outline-variant/5"
                    />
                    <textarea 
                      value={step.description}
                      onChange={e => handleStepChange(idx, 'description', e.target.value)}
                      placeholder="Step Description"
                      className="w-full bg-white rounded-xl py-2 px-3 text-[11px] outline-none border border-outline-variant/5 resize-none h-16"
                    />
                    <input 
                      value={step.contentUrl}
                      onChange={e => handleStepChange(idx, 'contentUrl', e.target.value)}
                      placeholder="Resource URL (Optional)"
                      className="w-full bg-white rounded-xl py-2 px-3 text-[10px] outline-none border border-outline-variant/5"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-outline-variant/5">
          <button 
            onClick={handleSubmit} 
            className="mission-gradient w-full text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all border border-white/10"
          >
            Initialize Module with {steps.length} Steps
          </button>
        </div>
      </div>
    </div>
  );
}
