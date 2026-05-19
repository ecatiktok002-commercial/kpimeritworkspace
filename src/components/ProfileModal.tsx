"use client";

import React, { useState, useEffect } from 'react';
import type { TeamMember } from '@/lib/types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any; // Flexible for both StaffProfile and TeamMember
  onSave: (p: any) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<string | null>;
  onDeleteAvatar: (url: string) => Promise<void>;
}

export default function ProfileModal({ 
  isOpen, 
  onClose, 
  profile, 
  onSave, 
  onUploadAvatar,
  onDeleteAvatar
}: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'metrics'>('details');
  const [name, setName] = useState(profile.name || profile.full_name || '');
  const [bio, setBio] = useState(profile.department || '');
  const [designation, setDesignation] = useState(profile.role || profile.designation || '');
  const [avatarPreview, setAvatarPreview] = useState(profile.imgUrl || profile.photoUrl || profile.photo_url || '');
  const [isUploading, setIsUploading] = useState(false);

  // Sync state when profile changes
  useEffect(() => {
    setName(profile.name || profile.full_name || '');
    setBio(profile.department || '');
    setDesignation(profile.role || profile.designation || '');
    setAvatarPreview(profile.imgUrl || profile.photoUrl || profile.photo_url || '');
  }, [profile]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAvatarPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        
        const uploadedUrl = await onUploadAvatar(file);
        if (uploadedUrl) {
          setAvatarPreview(uploadedUrl);
        }
      } catch (err) {
        console.error("Upload failed", err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-2xl bg-surface rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Left: Branding & Visuals */}
        <div className="w-full md:w-72 bg-surface-container-low p-8 flex flex-col items-center text-center border-b md:border-b-0 md:border-r border-outline-variant/10 shrink-0">
          <div className="relative group mb-6">
            <div className="w-32 h-32 rounded-[32px] overflow-hidden ring-8 ring-white shadow-xl transition-transform group-hover:scale-105 duration-500 bg-surface-container flex items-center justify-center">
              {avatarPreview ? (
                <img 
                  src={avatarPreview} 
                  alt={profile.name}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${isUploading ? 'opacity-40' : 'opacity-100'}`}
                />
              ) : (
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant opacity-20">person</span>
              )}
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                </div>
              )}
            </div>
            
            <label className="absolute bottom-1 right-1 w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 active:scale-95 transition-all group-hover:rotate-12">
              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
            </label>

            {avatarPreview && !avatarPreview.includes('placeholder') && !avatarPreview.includes('pravatar.cc') && (
              <button 
                onClick={() => onDeleteAvatar(avatarPreview)}
                className="absolute -top-1 -right-1 w-8 h-8 bg-error text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
                title="Remove photo"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            )}
          </div>

          <h3 className="text-2xl font-black text-on-surface font-headline leading-tight mb-1">{profile.name || profile.full_name}</h3>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary bg-primary/10 px-4 py-1.5 rounded-full inline-block mb-8">
            {profile.role || profile.designation || 'Personnel'}
          </p>

          <div className="w-full space-y-3">
             <div className="bg-white/50 p-4 rounded-3xl border border-outline-variant/5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-40 mb-1">Rank</p>
                <p className="text-sm font-bold text-on-surface">Efficiency Tier {profile.tier || 1}</p>
             </div>
             <div className="bg-white/50 p-4 rounded-3xl border border-outline-variant/5 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-40 mb-1">Current Yield</p>
                <p className="text-sm font-bold text-on-surface">{profile.monthPoints?.toLocaleString() || 0} Points</p>
             </div>
          </div>
        </div>

        {/* Right: Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex border-b border-outline-variant/10 px-8 pt-8 shrink-0">
            <button 
              onClick={() => setActiveTab('details')}
              className={`pb-4 px-2 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'details' ? 'text-primary' : 'text-on-surface-variant opacity-40 hover:opacity-100'}`}
            >
              System Profile
              {activeTab === 'details' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full animate-in slide-in-from-bottom-1" />}
            </button>
            <button 
              onClick={() => setActiveTab('metrics')}
              className={`pb-4 px-6 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'metrics' ? 'text-primary' : 'text-on-surface-variant opacity-40 hover:opacity-100'}`}
            >
              Yield Analytics
              {activeTab === 'metrics' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full animate-in slide-in-from-bottom-1" />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 thin-scrollbar">
            {activeTab === 'details' ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60 ml-4 mb-2 block">Canonical Name</label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-surface-container-low border-2 border-transparent focus:border-primary/20 rounded-2xl px-5 py-3.5 text-sm font-bold text-on-surface transition-all outline-none" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60 ml-4 mb-2 block">Domain / Department</label>
                    <input 
                      type="text" 
                      value={bio} 
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full bg-surface-container-low border-2 border-transparent focus:border-primary/20 rounded-2xl px-5 py-3.5 text-sm font-bold text-on-surface transition-all outline-none" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60 ml-4 mb-2 block">Designation</label>
                    <input 
                      type="text" 
                      value={designation} 
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full bg-surface-container-low border-2 border-transparent focus:border-primary/20 rounded-2xl px-5 py-3.5 text-sm font-bold text-on-surface transition-all outline-none" 
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => onSave({ ...profile, name, department: bio, designation, photoUrl: avatarPreview })}
                    className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Commit Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-container-low p-6 rounded-[32px] border border-outline-variant/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-40 mb-1">Weekly Velocity</p>
                    <p className="text-2xl font-black text-on-surface">{Math.round((profile.monthPoints || 0) / 4)}</p>
                  </div>
                  <div className="bg-surface-container-low p-6 rounded-[32px] border border-outline-variant/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-40 mb-1">Efficiency Score</p>
                    <p className="text-2xl font-black text-emerald-500">{Math.round((profile.efficiencyScore || 0.85) * 100)}%</p>
                  </div>
                </div>
                
                <div className="bg-surface-container-lowest p-6 rounded-[32px] border border-outline-variant/10">
                   <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4">Historical Performance</p>
                   <div className="h-40 w-full bg-surface-container-low/50 rounded-2xl flex items-center justify-center">
                      <p className="text-[10px] font-bold text-on-surface-variant opacity-30 uppercase tracking-[0.2em]">Data stream pending</p>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 w-12 h-12 rounded-2xl bg-white/50 backdrop-blur-md text-on-surface hover:bg-white hover:shadow-xl transition-all flex items-center justify-center z-10"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  );
}
