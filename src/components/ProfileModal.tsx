"use client";

import React from 'react';
import type { StaffProfile, Achievement } from '@/lib/types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: StaffProfile;
  onSave: (profile: StaffProfile) => void;
  onUploadAvatar: (file: File) => Promise<string | null>;
  achievements: Achievement[];
  unlockedIds: string[];
}

export default function ProfileModal({ isOpen, onClose, profile, onSave, onUploadAvatar, achievements, unlockedIds }: ProfileModalProps) {
  const [form, setForm] = React.useState(profile);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setForm(profile);
  }, [profile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const publicUrl = await onUploadAvatar(file);
    if (publicUrl) {
      setForm(prev => ({ ...prev, photoUrl: publicUrl }));
    }
    setIsUploading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-surface-container-lowest rounded-[40px] p-8 shadow-2xl w-full max-w-md border border-outline-variant/10 max-h-[90vh] overflow-y-auto no-scrollbar relative animate-in zoom-in-95 duration-300"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Identity & Status</p>
            <h3 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">Staff Biodata</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-error/10 hover:text-error transition-all active:scale-90 text-on-surface-variant shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Avatar Section */}
        <div className="flex justify-center mb-10">
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all scale-110" />
            <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-white shadow-xl relative z-10 bg-slate-100 ring-4 ring-primary/5 flex items-center justify-center">
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-[8px] font-bold text-primary uppercase tracking-widest">Uploading</span>
                </div>
              ) : (
                <img src={form.photoUrl} className="object-cover w-full h-full" alt="Profile" />
              )}
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-2 border-white z-20 hover:scale-110 transition-transform active:scale-90 disabled:opacity-50 disabled:scale-100"
            >
              <span className="material-symbols-outlined text-[14px]">photo_camera</span>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Input Fields */}
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Full Name</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Department</label>
              <input
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value })}
                className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Employment Type</label>
              <select
                value={form.employmentType}
                onChange={e => setForm({ ...form, employmentType: e.target.value as any })}
                className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
              >
                <option value="Staff">Staff</option>
                <option value="Intern">Intern</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Designation</label>
              <input
                value={form.designation}
                onChange={e => setForm({ ...form, designation: e.target.value })}
                className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
              />
            </div>

          </div>

          {/* Achievements - Redesigned horizontal scroll */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">System Matrix Badges</label>
              <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{achievements.length} Badges</span>
            </div>
            <div
              className="rounded-2xl p-3 flex overflow-x-auto gap-1.5 pb-3 snap-x no-scrollbar border border-outline-variant/5 bg-surface-container-low shadow-inner"
            >
              {achievements.map(ach => {
                const isUnlocked = unlockedIds.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`min-w-[60px] max-w-[60px] snap-center p-1.5 rounded-lg flex flex-col items-center text-center transition-all duration-300 border shadow-sm ${
                      isUnlocked 
                        ? 'bg-white border-primary/20 scale-[1.02] shadow-primary/5' 
                        : 'bg-surface-container-high/50 border-transparent opacity-60'
                    }`}
                  >
                    <div className={`mb-1 w-5 h-5 flex items-center justify-center rounded transition-colors ${
                      isUnlocked ? 'bg-primary/5 text-primary' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: isUnlocked ? "'FILL' 1" : undefined }}>
                        {isUnlocked ? ach.icon : 'lock'}
                      </span>
                    </div>
                    <p className={`text-[7px] font-extrabold uppercase tracking-tighter leading-tight line-clamp-2 ${isUnlocked ? 'text-on-surface' : 'text-slate-400'}`}>
                      {ach.title}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-8 grid grid-cols-2 gap-4">
            <button
               onClick={onClose}
               className="py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition-all border border-outline-variant/10 active:scale-90 shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSave(form); onClose(); }}
              disabled={isUploading}
              className="mission-gradient text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            >
              Synchronize
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
