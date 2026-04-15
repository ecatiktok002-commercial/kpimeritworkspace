"use client";

import React from 'react';
import type { StaffProfile, Achievement } from '@/lib/types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: StaffProfile;
  onSave: (profile: StaffProfile) => void;
  achievements: Achievement[];
  unlockedIds: string[];
}

export default function ProfileModal({ isOpen, onClose, profile, onSave, achievements, unlockedIds }: ProfileModalProps) {
  const [form, setForm] = React.useState(profile);

  React.useEffect(() => {
    setForm(profile);
  }, [profile]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(19,27,46,0.4)', backdropFilter: 'blur(8px)' }}>
      <div className="rounded-3xl p-8 shadow-2xl w-full max-w-md border max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.2)' }}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold font-[Plus_Jakarta_Sans]" style={{ color: 'var(--on-surface)' }}>Staff Biodata</h3>
          <button onClick={onClose} className="rounded-full p-1 transition-colors hover:text-red-500" style={{ color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Avatar */}
        <div className="flex justify-center mb-6">
          <div className="h-24 w-24 rounded-full overflow-hidden border-4" style={{ borderColor: 'var(--surface-container-high)', backgroundColor: 'var(--surface-container)' }}>
            <img src={form.photoUrl} className="object-cover w-full h-full" alt="Profile" />
          </div>
        </div>

        <div className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>Full Name</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl py-3 px-4 outline-none transition-all border"
              style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }}
            />
          </div>

          {/* Designation */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>Designation</label>
            <input
              value={form.designation}
              onChange={e => setForm({ ...form, designation: e.target.value })}
              className="w-full rounded-xl py-3 px-4 outline-none transition-all border"
              style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }}
            />
          </div>

          {/* IC Number */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>IC Number</label>
            <input
              value={form.ic}
              onChange={e => setForm({ ...form, ic: e.target.value })}
              className="w-full rounded-xl py-3 px-4 outline-none transition-all border"
              style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }}
            />
          </div>

          {/* Photo URL */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>Photo URL</label>
            <input
              value={form.photoUrl}
              onChange={e => setForm({ ...form, photoUrl: e.target.value })}
              className="w-full rounded-xl py-3 px-4 outline-none transition-all border text-sm"
              style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }}
            />
          </div>

          {/* System Achievements — Carousel */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>System Achievements</label>
            <div
              className="rounded-xl p-4 flex overflow-x-auto gap-3 pb-4 snap-x no-scrollbar border"
              style={{ backgroundColor: 'var(--surface-container-low)', borderColor: 'rgba(188,201,198,0.2)' }}
            >
              {achievements.map(ach => {
                const isUnlocked = unlockedIds.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className="min-w-[140px] max-w-[140px] snap-center p-3 rounded-xl flex flex-col items-center text-center transition-all select-none border"
                    style={{
                      backgroundColor: isUnlocked ? 'rgba(0,104,95,0.1)' : 'var(--surface-container)',
                      color: isUnlocked ? 'var(--primary)' : 'rgba(61,73,71,0.5)',
                      borderColor: isUnlocked ? 'rgba(0,104,95,0.2)' : 'transparent',
                    }}
                  >
                    <div className="mb-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/50 shadow-sm">
                      <span
                        className="material-symbols-outlined text-[16px]"
                        style={isUnlocked ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {isUnlocked ? ach.icon : 'lock'}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wide leading-tight">{ach.title}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] mt-2 italic px-1" style={{ color: 'var(--on-surface-variant)' }}>Achievements are automatically tracked. Scroll right to view locked badges.</p>
          </div>

          {/* Save */}
          <div className="pt-4">
            <button
              onClick={() => { onSave(form); onClose(); }}
              className="w-full text-white py-3.5 rounded-xl font-bold uppercase tracking-widest text-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
