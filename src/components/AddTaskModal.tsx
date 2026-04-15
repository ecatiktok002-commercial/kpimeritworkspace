"use client";

import React, { useState } from 'react';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, note: string, mins: number, status: 'queued' | 'running') => void;
}

export default function AddTaskModal({ isOpen, onClose, onSubmit }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [mins, setMins] = useState(120);
  const [status, setStatus] = useState<'queued' | 'running'>('queued');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!title || mins <= 0) {
      alert('Valid Title and Time required.');
      return;
    }
    onSubmit(title, note, mins, status);
    setTitle('');
    setNote('');
    setMins(120);
    setStatus('queued');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(19,27,46,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="rounded-3xl p-8 shadow-2xl w-full max-w-md border" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.2)' }}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold font-[Plus_Jakarta_Sans]" style={{ color: 'var(--on-surface)' }}>Queue New Task</h3>
          <button onClick={onClose} className="rounded-full p-1 transition-colors hover:text-red-500" style={{ color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>Task Title <span style={{ color: 'var(--error)' }}>*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-xl py-3 px-4 outline-none transition-all border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }} placeholder="E.g., Q3 Analytics Report" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>Time Limit (Minutes) <span style={{ color: 'var(--error)' }}>*</span></label>
            <input type="number" value={mins} onChange={e => setMins(parseInt(e.target.value) || 0)} className="w-full rounded-xl py-3 px-4 outline-none transition-all border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>Drop Note (Optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full rounded-xl py-3 px-4 outline-none transition-all resize-none h-20 border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }} placeholder="E.g., Require dataset access from Alex" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>Initial Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as 'queued' | 'running')} className="w-full rounded-xl py-3 px-4 outline-none transition-all cursor-pointer border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }}>
              <option value="queued">Send to Queue</option>
              <option value="running">Start Immediately</option>
            </select>
          </div>
          <div className="pt-4">
            <button onClick={handleSubmit} className="w-full text-white py-3.5 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg hover:scale-[1.02] active:scale-95 transition-all mission-gradient" style={{ boxShadow: '0 10px 15px -3px rgba(0,104,95,0.2)' }}>
              Submit to AI Advisor
            </button>
            <p className="text-[10px] text-center mt-3 px-2 leading-relaxed" style={{ color: 'var(--on-surface-variant)' }}>AI Advisor will assess scope and automatically assign Merit Points prior to queuing.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
