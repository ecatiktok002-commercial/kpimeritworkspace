"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/AppHeader';
import ProfileModal from '@/components/ProfileModal';
import AddTaskModal from '@/components/AddTaskModal';
import AddAchievementModal from '@/components/AddAchievementModal';
import AddModuleModal from '@/components/AddModuleModal';
import type { Task, TaskFrequency, Achievement, StaffProfile, TeamMember, AppealItem, SkillModule, MeritConfig, OrganizationConfig, ActivityLog } from '@/lib/types';
import { AI_POINT_CONFIG, SEED_TASKS, SEED_ACHIEVEMENTS, SEED_UNLOCKED_ACHIEVEMENTS, SEED_PROFILE, SEED_TEAM, SEED_APPEALS, SEED_MODULES, SEED_MERIT_CONFIG, SEED_ORG_CONFIG } from '@/lib/mockDb';
import { calculateTaskPoints, checkAchievementTriggers, checkRetroactiveUnlock } from '@/lib/taskEngine';
import { supabase } from '@/lib/supabaseClient';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN APP â€” Single-Page with Tab-Based View Switching
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function MeritKPIApp() {
  // â”€â”€ Auth & Global State â”€â”€
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authProfile, setAuthProfile] = useState<any>(null); // Real profile from Supabase
  const [activeView, setActiveView] = useState('staff');
  const [managerSubView, setManagerSubView] = useState('dashboard');
  
  // Real DB state (No more mock seeds except config fallback)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>(SEED_ACHIEVEMENTS); // Hardcoded UI list for now unless configured in DB
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [profile, setProfile] = useState<StaffProfile>(SEED_PROFILE); // Fallback structure
  const [team, setTeam] = useState<any[]>([]); // Dynamic profiles
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [modules, setModules] = useState<SkillModule[]>(SEED_MODULES); // Changed to allow adding
  const [meritConfig, setMeritConfig] = useState<MeritConfig>(SEED_MERIT_CONFIG);
  const [orgConfig, setOrgConfig] = useState<OrganizationConfig>(SEED_ORG_CONFIG);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);

  // â”€â”€ Database Fetching â”€â”€
  useEffect(() => {
    if (isLoggedIn) {
      const fetchData = async () => {
        // Fetch TEAM for managers
        if (authProfile?.is_manager) {
          const { data: teamData } = await supabase.from('profiles').select('*').eq('is_manager', false);
          if (teamData) setTeam(teamData.map(t => ({
            id: t.id,
            name: t.full_name || 'Staff Member',
            imgUrl: t.photo_url || "https://i.pravatar.cc/150?u="+t.id,
            status: 'online',
            currentTask: 'Awaiting Task',
            department: t.department || 'General',
            monthPoints: t.total_points || 0,
            rank: 1,
            elapsed: ''
          })));

          // Load org_config from Supabase
          const { data: configData, error: configError } = await supabase
            .from('org_config')
            .select('config')
            .eq('workspace_id', 'default')
            .maybeSingle();  // maybeSingle() returns null (not error) when no row exists
          if (configError) {
            console.error('[org_config] fetch error:', configError);
          } else if (configData?.config) {
            setOrgConfig(configData.config);
          }
        }

        // Auto assignments will be generated below if tasks are empty
      };
      fetchData();
    }
  }, [isLoggedIn, authProfile]);

  // NOTE: Auto-Assignment removed â€” role tasks are now shown as guidelines in the Mission Brief
  // sidebar, not auto-injected into the task list. Staff create their own tasks aligned to goals.


  // â”€â”€ Modal State â”€â”€
  const [profileOpen, setProfileOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addAchOpen, setAddAchOpen] = useState(false);
  const [addModuleOpen, setAddModuleOpen] = useState(false);

  // â”€â”€ Timer for running tasks â”€â”€
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(prev => prev.map(t => {
        if (t.status !== 'running') return t;
        if (t.elapsedSec >= t.totalSec) return { ...t, status: 'completed' as const };
        return { ...t, elapsedSec: t.elapsedSec + 1 };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // â”€â”€ Task Actions â”€â”€
  const handleAddTask = useCallback((title: string, note: string, mins: number, status: 'queued' | 'running', commencementDate: string, collaborators: string[] = [], workflow: { id: string; name: string; isCompleted: boolean }[] = [], collaboratorIds: string[] = [], frequency: TaskFrequency = { type: 'once' }) => {
    const calc = calculateTaskPoints(title, note, mins, AI_POINT_CONFIG);
    const currentUserId = authProfile?.id || authProfile?.access_id || 'local';
    const task: Task = {
      id: Date.now().toString(),
      title, note,
      totalSec: mins * 60,
      elapsedSec: 0,
      status,
      tierName: calc.tierName,
      tierVal: calc.tierVal,
      points: calc.points,
      commencementDate: commencementDate || getKLTime(),
      ownerId: currentUserId,
      collaborators,
      collaboratorIds,
      frequency,
      workflow
    };

    // Achievement trigger check
    const newUnlocks = checkAchievementTriggers(task, achievements, unlockedIds);
    if (newUnlocks.length > 0) {
      setUnlockedIds(prev => [...prev, ...newUnlocks]);
      const achTitle = achievements.find(a => a.id === newUnlocks[0])?.title;
      setTimeout(() => alert(`ðŸ† ACHIEVEMENT UNLOCKED: ${achTitle}`), 300);
      
      setActivityLog(prev => [{
        id: 'act-' + Date.now().toString() + Math.random(),
        type: 'achievement',
        desc: `Milestone Verified: ${achTitle}`,
        timestamp: getKLTime(),
        staffName: authProfile?.full_name || profile.name || 'Staff'
      }, ...prev]);
    }

    setTasks(prev => [...prev, task]);
    setAddTaskOpen(false);
  }, [achievements, unlockedIds, authProfile, profile.name]);

  const startTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'running' as const } : t));
  };

  // â”€â”€ Helper: get next recurrence date string â”€â”€
  const getNextRecurrenceDate = (task: Task): string => {
    const now = new Date();
    const klNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    if (task.frequency?.type === 'daily') {
      // Tomorrow same time
      const next = new Date(klNow);
      next.setDate(next.getDate() + 1);
      next.setHours(8, 0, 0, 0);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${next.getFullYear()}-${pad(next.getMonth()+1)}-${pad(next.getDate())}T08:00`;
    }
    if (task.frequency?.type === 'weekly' && task.frequency.days && task.frequency.days.length > 0) {
      const today = klNow.getDay();
      // Find next matching day
      const sortedDays = [...task.frequency.days].sort((a, b) => a - b);
      let daysAhead = sortedDays.find(d => d > today);
      if (daysAhead === undefined) daysAhead = sortedDays[0]; // wrap to next week
      const diff = daysAhead > today ? daysAhead - today : 7 - today + daysAhead;
      const next = new Date(klNow);
      next.setDate(next.getDate() + diff);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${next.getFullYear()}-${pad(next.getMonth()+1)}-${pad(next.getDate())}T08:00`;
    }
    return getKLTime();
  };

  const completeTask = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        setActivityLog(acts => [{
          id: 'act-' + Date.now().toString(),
          type: 'points_earned',
          desc: `Completed Task: ${t.title}`,
          timestamp: getKLTime(),
          points: t.points,
          staffName: authProfile?.full_name || profile.name || 'Staff'
        }, ...acts]);

        const isRecurring = t.frequency && t.frequency.type !== 'once';
        if (isRecurring) {
          // Reset task for next occurrence â€” keeps id, frequency, ownership
          return {
            ...t,
            status: 'queued' as const,
            elapsedSec: 0,
            lastCompletedDate: getKLTime(),
            commencementDate: getNextRecurrenceDate(t),
            // Reset workflow steps
            workflow: t.workflow ? t.workflow.map(w => ({ ...w, isCompleted: false })) : t.workflow,
          };
        }

        return { ...t, status: 'completed' as const, elapsedSec: t.totalSec };
      }
      return t;
    }));
  };

  const toggleWorkflowStep = (taskId: string, stepId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId && t.workflow) {
        return {
          ...t,
          workflow: t.workflow.map(w => w.id === stepId ? { ...w, isCompleted: !w.isCompleted } : w)
        };
      }
      return t;
    }));
  };

  // â”€â”€ Achievement Actions (Exec Dashboard) â”€â”€
  const handleAddAchievement = useCallback((icon: string, title: string, desc: string, trigger: string, taskReq?: string, triggerVal?: number) => {
    const newAch: Achievement = { id: 'ach-' + Date.now(), icon, title, desc, trigger, taskRequired: taskReq, triggerValue: triggerVal };
    setAchievements(prev => [...prev, newAch]);

    // Retroactive unlock check
    if (checkRetroactiveUnlock(newAch, tasks, unlockedIds)) {
      setUnlockedIds(prev => [...prev, newAch.id]);
      setTimeout(() => alert(`âš¡ RETROACTIVE UNLOCK: Staff already qualified â†’ ${title}`), 300);
    }

    setAddAchOpen(false);
  }, [tasks, unlockedIds]);

  const handleDeleteAchievement = (id: string) => {
    if (!confirm('Are you sure you want to remove this achievement milestone?')) return;
    setAchievements(prev => prev.filter(a => a.id !== id));
    setUnlockedIds(prev => prev.filter(uid => uid !== id));
  };

  const handleDeleteModule = (id: string) => {
    if (!confirm('Are you sure you want to remove this learning module?')) return;
    setModules(prev => prev.filter(m => m.id !== id));
  };

  const handleAddModule = useCallback((code: string, title: string, desc: string, points: number) => {
    setModules(prev => [...prev, { id: 'mod-' + Date.now(), code, title, description: desc, meritValue: points, participants: 0 }]);
    setAddModuleOpen(false);
  }, []);

  const handleUpdateProfile = async (newProfile: StaffProfile) => {
    setProfile(newProfile);
    if (isLoggedIn && authProfile) {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: newProfile.name,
          department: newProfile.department,
          employmentType: newProfile.employmentType,
          designation: newProfile.designation,
          ic: newProfile.ic,
          photo_url: newProfile.photoUrl
        })
        .eq('id', authProfile.id);
        
      if (error) alert('Failed to sync profile change: ' + error.message);
      else alert('Profile updated successfully.');
    }
  };

  const handleUploadAvatar = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${authProfile?.id || 'temp'}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error: any) {
      alert('Error uploading avatar: ' + error.message);
      return null;
    }
  };

  const resolveAppeal = (appealId: string, finalPoints: number, message: string) => {
    setAppeals(prev => prev.map(a => a.id === appealId ? { ...a, resolved: true, finalPoints, resolutionMessage: message } : a));
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to completely remove ${name} from this organization?`)) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      alert('Failed to delete staff: ' + error.message);
    } else {
      alert(`Staff ${name} removed.`);
      setTeam(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleSaveRoleSync = async (config: OrganizationConfig) => {
    console.log('[org_config] Saving config:', config);
    const { data, error } = await supabase
      .from('org_config')
      .upsert({ workspace_id: 'default', config }, { onConflict: 'workspace_id' })
      .select();
    if (error) {
      console.error('[org_config] upsert error:', error);
      alert('Failed to save role configuration: ' + error.message);
    } else {
      console.log('[org_config] upsert success:', data);
      alert('Role configuration saved successfully!');
    }
  };



  // â”€â”€ Timezone Helper (GMT+8 Kuala Lumpur) â”€â”€
  const getKLTime = () => {
    const now = new Date();
    // Use Intl to get formatted KL time
    const klString = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);
    
    // Format: "YYYY-MM-DD HH:mm" -> transform to datetime-local friendly "YYYY-MM-DDTHH:mm"
    const [date, time] = klString.split(', ');
    return `${date}T${time}`;
  };

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // â”€â”€ Auth Handling â”€â”€
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const aid = (form.elements.namedItem('accessId') as HTMLInputElement).value;
    const pass = (form.elements.namedItem('passcode') as HTMLInputElement).value;
    
    if(aid === 'ecaworkspace' && pass === '123456') {
      setIsLoggedIn(true);
      setAuthProfile({ is_manager: true, role: 'Manager', full_name: 'ECA Workspace', access_id: 'ecaworkspace' });
      setActiveView('manager');
    } else {
      const { data, error } = await supabase.from('profiles').select('*').eq('access_id', aid).eq('passcode', pass).single();
      if (data) {
        setIsLoggedIn(true);
        setAuthProfile(data);
        setActiveView(data.is_manager ? 'manager' : 'staff');
      } else {
        alert('Invalid Access ID or Passcode');
      }
    }
  };

  const currentProfile = authProfile || profile; // Fallback to seed if testing
  const currentUserId = authProfile?.id || authProfile?.access_id || 'local';

  // â”€â”€ Data Isolation: Only show tasks owned by or shared with current user â”€â”€
  const visibleTasks = tasks.filter(task => {
    // No owner stamp = legacy/auto-assigned task, always visible to creator
    if (!task.ownerId) return true;
    // Owner always sees their own tasks
    if (task.ownerId === currentUserId) return true;
    // Collaborators see tasks they've been invited to
    if (task.collaboratorIds && task.collaboratorIds.includes(currentUserId)) return true;
    return false;
  });

  // â”€â”€ Staff list for collaborator dropdown (exclude self) â”€â”€
  const collaboratorStaffList = team
    .filter(t => t.id !== currentUserId)
    .map(t => ({ id: t.id, name: t.name }));

  // â”€â”€ Derived State (depends on visibleTasks â”€â”€ must be after) â”€â”€
  const completedPoints = visibleTasks.filter(t => t.status === 'completed').reduce((s, t) => s + t.points, 0);
  const lifetimePoints = completedPoints; // starting at 0 for fresh app


  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest p-6">
        <div className="w-full max-w-md bg-white p-10 rounded-[40px] shadow-2xl border border-outline-variant/10 text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
           <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-secondary to-tertiary" />
           <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 relative">
             <span className="material-symbols-outlined text-[40px] text-primary">fingerprint</span>
           </div>
           <h2 className="text-3xl font-extrabold font-headline tracking-tight mb-2 text-on-surface">Access Portal</h2>
           <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-8">KPI Merit System</p>
           
           <form onSubmit={handleAuth} className="space-y-5 text-left">
             <div>
                <label className="text-[10px] font-black uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Access ID</label>
                <input name="accessId" required className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all" placeholder="Enter ID..." />
             </div>
             <div>
                <label className="text-[10px] font-black uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Passcode</label>
                <input type="password" name="passcode" required className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢" />
             </div>
             <button type="submit" className="w-full bg-primary text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 mt-4 mission-gradient">
               Authenticate
             </button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface)' }}>
      <AppHeader 
        activeView={activeView} 
        onViewChange={setActiveView} 
        onProfileClick={() => setProfileOpen(true)} 
        avatarUrl={currentProfile.photoUrl || currentProfile.photo_url || "https://i.pravatar.cc/150?u=a042581f4e29026704d"} 
        onSignOut={() => {
          setIsLoggedIn(false);
          setAuthProfile(null);
        }}
        isManager={currentProfile.is_manager}
      />

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          VIEW: STAFF DASHBOARD
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeView === 'staff' && (
        <main className="pt-28 px-6 max-w-6xl mx-auto pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">

          {/* Merit Summary Card */}
          <section className="mb-12">
            <div className="merit-card-pattern rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
              <div className="relative z-10 w-full">
                <div className="flex justify-center mb-6">
                  <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20">
                    <span className="material-symbols-outlined text-white text-3xl font-light">analytics</span>
                  </div>
                </div>
                
                <p className="text-[11px] uppercase font-black tracking-[0.3em] opacity-60 mb-3">Current Month (May 2026)</p>
                <h2 className="text-6xl font-black font-headline tracking-tight mb-2">
                  {completedPoints.toLocaleString()} <span className="text-xl font-medium opacity-40 -ml-2">Points</span>
                </h2>
                <div className="inline-flex items-center gap-2 bg-black/10 px-4 py-2 rounded-full backdrop-blur-sm border border-white/5 mt-2">
                  <p className="text-xs font-bold opacity-70">Lifetime Points:</p>
                  <p className="text-xs font-black text-white">{lifetimePoints.toLocaleString()} Points</p>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-12 max-w-lg mx-auto">
                  <div className="bg-white/5 rounded-3xl p-5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all">
                    <p className="text-[9px] uppercase font-black tracking-widest opacity-60 mb-2">Active Tasks</p>
                    <p className="text-2xl font-black font-headline">{visibleTasks.filter(t => t.status === 'running').length.toString().padStart(2, '0')}</p>
                  </div>
                  <div className="bg-white/5 rounded-3xl p-5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all">
                    <p className="text-[9px] uppercase font-black tracking-widest opacity-60 mb-2">Queue</p>
                    <p className="text-2xl font-black font-headline">{visibleTasks.filter(t => t.status === 'queued').length.toString().padStart(2, '0')}</p>
                  </div>
                  <div className="bg-white/5 rounded-3xl p-5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all">
                    <p className="text-[9px] uppercase font-black tracking-widest opacity-60 mb-2">Completed</p>
                    <p className="text-2xl font-black font-headline">{visibleTasks.filter(t => t.status === 'completed').length.toString().padStart(2, '0')}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          
          {/* Achievement Quick View â€” Carousel */}
          <section className="mb-8 overflow-hidden">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 px-1">My Milestones</h3>
            <div className="flex overflow-x-auto gap-2 pb-4 no-scrollbar -mx-1 px-1 snap-x">
              {achievements.map(ach => {
                const isUnlocked = unlockedIds.includes(ach.id);
                return (
                  <div 
                    key={ach.id} 
                    className={`min-w-[90px] max-w-[90px] snap-center p-2 rounded-xl border flex flex-col items-center text-center transition-all bg-white shadow-sm ${
                      isUnlocked ? 'border-primary/20' : 'border-outline-variant/5 bg-slate-50/50 opacity-40 grayscale'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full mb-1.5 flex items-center justify-center ${
                      isUnlocked ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      <span className={`material-symbols-outlined text-[16px] ${isUnlocked ? 'fill-1' : ''}`} style={isUnlocked ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                        {isUnlocked ? ach.icon : 'lock'}
                      </span>
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-tighter leading-tight line-clamp-1">{ach.title}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* â”€â”€ 2-Column Layout: Task Timeline + Mission Brief Sidebar â”€â”€ */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 items-start">

            {/* LEFT: Task Timeline */}
            <div>
              {/* Planner Header */}
              <div className="flex justify-between items-end mb-8 px-2 mt-6">
                <div>
                  <h3 className="text-2xl font-black text-on-surface font-headline tracking-tight">Today's Itinerary</h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant mt-1 opacity-60">Calendar Projection</p>
                </div>
                <button 
                  onClick={() => setAddTaskOpen(true)} 
                  className="text-[10px] font-black uppercase tracking-[0.2em] bg-on-surface text-white px-5 py-3 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group mission-gradient"
                >
                  <span className="material-symbols-outlined text-[18px] group-hover:rotate-90 transition-transform">add_task</span> 
                  New Mission
                </button>
              </div>

              {/* Data Isolation Notice */}
              <div className="mb-4 px-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest">
                  <span className="material-symbols-outlined text-[14px] text-primary/50">lock</span>
                  Tasks visible only to you Â· Add collaborators to share
                </div>
              </div>

              {/* Calendar Timeline Layout */}
              <div className="relative pl-8 pb-10">
                {/* Vertical timeline spine */}
                <div className="absolute left-3 top-4 bottom-0 w-[2px] bg-gradient-to-b from-primary/30 via-tertiary/20 to-transparent rounded-full" />
                
                {visibleTasks.length === 0 && (
                  <div className="text-center py-12 rounded-3xl border-2 border-dashed border-outline-variant text-on-surface-variant relative z-10 bg-surface-container-lowest">
                    <span className="material-symbols-outlined text-[48px] mb-3 block opacity-30 text-primary">event_available</span>
                    <p className="font-bold text-lg">Schedule Cleared</p>
                    <p className="text-sm mt-1 opacity-70">Use your Role Mission Brief â†’  to plan today's tasks.</p>
                  </div>
                )}
                
                {(() => {
                  const sortedTasks = [...visibleTasks].sort((a, b) => {
                    const priority = { 'running': 1, 'queued': 2, 'completed': 3 };
                    if (priority[a.status] !== priority[b.status]) {
                      return priority[a.status] - priority[b.status];
                    }
                    const dateA = a.commencementDate ? new Date(a.commencementDate).getTime() : 0;
                    const dateB = b.commencementDate ? new Date(b.commencementDate).getTime() : 0;
                    if (dateA !== dateB) return dateA - dateB;
                    return 0;
                  });

                  return sortedTasks.map((task, idx) => {
                    const pct = task.totalSec > 0 ? Math.min(100, Math.round((task.elapsedSec / task.totalSec) * 100)) : 0;
                  const remaining = Math.max(0, task.totalSec - task.elapsedSec);
                  const isActive = task.status === 'running';
                  const isDone = task.status === 'completed';

                  return (
                    <div key={task.id} className="relative mb-6 group">
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[27px] top-6 w-[18px] h-[18px] rounded-full border-[3px] border-surface shadow-sm z-10 flex items-center justify-center transition-all ${
                        isActive ? 'bg-primary ring-4 ring-primary/20 scale-125' : 
                        isDone ? 'bg-green-500' : 'bg-surface-container-high'
                      }`}>
                        {isDone && <span className="material-symbols-outlined text-[10px] text-white font-bold">check</span>}
                      </div>

                      <div className={`rounded-3xl p-6 border transition-all duration-300 shadow-sm overflow-hidden relative ${
                        isActive ? 'bg-primary/5 border-primary/20 shadow-primary/10 scale-[1.01]' : 
                        isDone ? 'bg-surface-container-lowest/50 border-outline-variant/10 opacity-70' : 
                        'bg-surface-container-lowest border-outline-variant/10 hover:border-primary/20 hover:shadow-md'
                      }`}>
                        {/* Active strip */}
                        {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}

                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-2 flex-wrap">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                              isActive ? 'bg-primary text-white shadow-sm' : 
                              isDone ? 'bg-surface-container text-on-surface-variant' : 
                              'bg-surface-container-high text-on-surface-variant'
                            }`}>
                              {isActive ? 'â— IN PROGRESS' : isDone ? 'âœ“ COMPLETED' : 'â—Œ SCHEDULED'}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider bg-surface-container text-on-surface-variant px-2.5 py-1 rounded-lg">
                              {task.tierName}
                            </span>
                            {/* Frequency badge */}
                            {task.frequency && task.frequency.type !== 'once' && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-secondary/10 text-secondary flex items-center gap-1">
                                <span className="material-symbols-outlined text-[11px]">autorenew</span>
                                {task.frequency.type === 'daily'
                                  ? 'Daily'
                                  : task.frequency.days && task.frequency.days.length > 0
                                  ? task.frequency.days.sort().map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join('Â·')
                                  : 'Weekly'}
                              </span>
                            )}
                          </div>
                          
                          <div className="text-right">
                            <span className="text-primary font-black font-headline text-lg">+{task.points} <span className="text-[10px] text-on-surface-variant opacity-70">PTS</span></span>
                          </div>
                        </div>

                        <h4 className={`font-black text-on-surface text-xl tracking-tight mb-2 ${isDone && 'line-through decoration-on-surface-variant/30'}`}>{task.title}</h4>
                        {task.note && <p className="text-on-surface-variant text-sm mb-5 opacity-80 leading-relaxed font-medium">{task.note}</p>}

                        {/* Collaborators */}
                        {task.collaborators && task.collaborators.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center pr-1">Collaborators:</span>
                            {task.collaborators.map((c, i) => (
                              <span key={i} className="text-[10px] font-bold px-2 py-1 rounded bg-secondary/10 text-secondary">{c}</span>
                            ))}
                          </div>
                        )}

                        {/* Workflow Visualization */}
                        {task.workflow && task.workflow.length > 0 && (
                          <div className="mb-5 bg-slate-50/50 dark:bg-slate-800/50 p-5 rounded-2xl border border-outline-variant/10 shadow-inner">
                            <p className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant mb-4 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">account_tree</span> Workflow Breakdown
                            </p>
                            <div className="space-y-4">
                              {task.workflow.map((step, idx) => (
                                <div key={step.id} className="flex relative">
                                  {/* Connector piece */}
                                  {idx < task.workflow!.length - 1 && (
                                    <div className={`absolute left-[11px] top-6 w-[2px] h-[110%] -z-0 rounded-full ${step.isCompleted ? 'bg-primary' : 'bg-outline-variant/20'}`} />
                                  )}
                                  <div className="flex items-start gap-3 relative z-10 w-full">
                                    <button 
                                      onClick={() => toggleWorkflowStep(task.id, step.id)}
                                      disabled={!isActive}
                                      className={`w-6 h-6 mt-0.5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                                        step.isCompleted ? 'bg-primary border-primary text-white shadow-md shadow-primary/20' : 
                                        isActive ? 'border-primary bg-white hover:bg-primary/5' : 'border-outline-variant/30 bg-surface-container opacity-50 cursor-not-allowed'
                                      }`}
                                    >
                                      {step.isCompleted && <span className="material-symbols-outlined text-[12px] font-bold">check</span>}
                                    </button>
                                    <span className={`text-sm font-bold pt-0.5 ${step.isCompleted ? 'text-on-surface-variant line-through opacity-70' : 'text-on-surface'}`}>
                                      {step.name}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Progress / Timer Section */}
                        {isActive && (
                           <div className="bg-white rounded-2xl p-4 border border-primary/10 mb-4 shadow-sm">
                              <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-primary flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">timer</span> Running</span>
                                <span className="text-on-surface-variant font-mono">{fmt(remaining)} left</span>
                              </div>
                              <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-1000 striped-progress" style={{ width: `${pct}%` }} />
                              </div>
                           </div>
                        )}

                        {!isActive && !isDone && (
                          <div className="flex items-center gap-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">
                             <span className="material-symbols-outlined text-[14px]">schedule</span>
                             Allocated Time: {Math.round(task.totalSec / 60)} minutes
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                           {task.status === 'queued' && (
                             <button onClick={() => startTask(task.id)} className="flex-1 bg-surface-container-high text-on-surface py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2">
                               <span className="material-symbols-outlined text-[16px]">play_arrow</span> Begin Now
                             </button>
                           )}
                           {task.status === 'running' && (
                             <button onClick={() => completeTask(task.id)} className="flex-1 bg-primary text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 mission-gradient active:scale-95 hover:brightness-110">
                               <span className="material-symbols-outlined text-[16px]">check_circle</span> Mark Done
                             </button>
                           )}
                           {task.status !== 'completed' && (
                             <button onClick={() => {
                               const msg = prompt('Enter your evidence/reasoning for this dispute:');
                               if(msg) {
                                 setAppeals(prev => [...prev, { id: Date.now().toString(), staffName: currentProfile.name || authProfile?.full_name || 'Staff', department: currentProfile.department || 'General', taskTitle: task.title, originalPoints: task.points, appealComment: msg, imgUrl: currentProfile.photoUrl || currentProfile.photo_url || "https://i.pravatar.cc/150", resolved: false }]);
                                 alert('Dispute submitted for Triage.');
                               }
                             }} className="bg-surface-container-lowest text-tertiary border border-outline-variant/20 py-3 px-5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-error/10 hover:text-error hover:border-error/20 transition-all flex items-center justify-center">
                               Dispute
                             </button>
                           )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
              </div>
            </div>

            {/* RIGHT: Role Mission Brief Sidebar */}
            {(() => {
              const cp = authProfile || profile;
              const roleKey = cp?.role || `${cp?.employmentType}-${cp?.department}`;
              const roleGoals = orgConfig.autoAssignments[roleKey];
              // Only show if there are goals defined for this role
              if (!roleGoals || roleGoals.tasks.length === 0) return null;
              return (
                <aside className="lg:sticky lg:top-28">
                  {/* Glowing ambient decoration */}
                  <div className="relative bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-lg overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-secondary/5 rounded-full blur-3xl" />

                    {/* Header */}
                    <div className="relative p-6 pb-4 border-b border-outline-variant/10">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary text-[18px]">flag</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Role Mission Brief</p>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">{roleKey}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed mt-3">
                        These are your role's expected objectives. Use them as a guide when planning your daily tasks.
                      </p>
                    </div>

                    {/* Goal List */}
                    <div className="relative p-4 space-y-3">
                      {roleGoals.tasks.map((goal, i) => (
                        <div
                          key={i}
                          className="group flex items-start gap-3 p-3 rounded-2xl bg-surface-container border border-outline-variant/5 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-default"
                        >
                          <div className="w-6 h-6 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center mt-0.5">
                            <span className="text-[11px] font-black">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-on-surface leading-snug">{goal}</p>
                          </div>
                          <button
                            onClick={() => setAddTaskOpen(true)}
                            title="Create a task aligned to this goal"
                            className="shrink-0 opacity-0 group-hover:opacity-100 w-7 h-7 rounded-xl bg-primary text-white flex items-center justify-center shadow-md shadow-primary/20 hover:scale-110 transition-all"
                          >
                            <span className="material-symbols-outlined text-[14px]">add</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* CTA Footer */}
                    <div className="relative p-4 pt-0">
                      <button
                        onClick={() => setAddTaskOpen(true)}
                        className="w-full py-3 rounded-2xl border-2 border-dashed border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-white hover:border-primary transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">add_task</span>
                        Log New Mission
                      </button>
                    </div>
                  </div>

                  {/* Tip card */}
                  <div className="mt-4 p-4 rounded-2xl bg-secondary/5 border border-secondary/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">lightbulb</span> Tip
                    </p>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      Your manager uses these goals to align team output. Create tasks that match these objectives to maximize your merit score.
                    </p>
                  </div>
                </aside>
              );
            })()}

          </div>
        </main>
      )}


      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          VIEW: EXEC DASHBOARD
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeView === 'manager' && (
        <div className="h-full">
          {/* Sidebar (Desktop) */}
          <aside className="hidden lg:flex flex-col fixed left-0 top-0 pt-24 w-64 h-full z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-r border-outline-variant/10">
            <div className="px-6 mb-8 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div>
                <p className="text-sm font-bold font-headline text-on-surface">Merit Admin</p>
                <p className="text-[10px] uppercase tracking-widest font-bold text-primary">Strategic Oversight</p>
              </div>
            </div>
            <nav className="flex-1 space-y-1">
              <div 
                onClick={() => setManagerSubView('dashboard')}
                className={`px-4 py-3 font-bold flex items-center gap-3 cursor-pointer transition-all ${
                  managerSubView === 'dashboard' ? 'bg-primary/10 text-primary border-r-4 border-primary' : 'text-on-surface-variant hover:pl-6'
                }`}
              >
                <span className="material-symbols-outlined">dashboard</span>
                <span className="font-headline text-sm">Dashboard</span>
              </div>
              <div 
                onClick={() => setManagerSubView('achieve')}
                className={`px-4 py-3 font-bold flex items-center gap-3 cursor-pointer transition-all ${
                  managerSubView === 'achieve' ? 'bg-primary/10 text-primary border-r-4 border-primary' : 'text-on-surface-variant hover:pl-6'
                }`}
              >
                <span className="material-symbols-outlined">military_tech</span>
                <span className="font-headline text-sm">Achieve Setting</span>
              </div>
              <div 
                onClick={() => setManagerSubView('ledger')}
                className={`px-4 py-3 font-bold flex items-center gap-3 cursor-pointer transition-all ${
                  managerSubView === 'ledger' ? 'bg-primary/10 text-primary border-r-4 border-primary' : 'text-on-surface-variant hover:pl-6'
                }`}
              >
                <span className="material-symbols-outlined">payments</span>
                <span className="font-headline text-sm">Points Ledger</span>
              </div>
              <div 
                onClick={() => setManagerSubView('org')}
                className={`px-4 py-3 font-bold flex items-center gap-3 cursor-pointer transition-all ${
                  managerSubView === 'org' ? 'bg-primary/10 text-primary border-r-4 border-primary' : 'text-on-surface-variant hover:pl-6'
                }`}
              >
                <span className="material-symbols-outlined">corporate_fare</span>
                <span className="font-headline text-sm">Organization Settings</span>
              </div>
            </nav>
          </aside>

          {/* Exec Canvas */}
          <main className="pt-28 pb-32 lg:ml-64 px-6 animate-in fade-in duration-300">
            <div className="max-w-7xl mx-auto">
              {managerSubView === 'dashboard' && <ManagerDashboardView team={team} achievements={achievements} activityLog={activityLog} setAddAchOpen={setAddAchOpen} onDeleteStaff={handleDeleteStaff} />}
              {managerSubView === 'achieve' && <ManagerAchieveView achievements={achievements} setAddAchOpen={setAddAchOpen} onRemoveAchievement={handleDeleteAchievement} />}
              {managerSubView === 'ledger' && <ManagerLedgerView config={meritConfig} setConfig={setMeritConfig} />}
              {managerSubView === 'org' && <ManagerOrgView config={orgConfig} setConfig={setOrgConfig} onDeleteStaff={handleDeleteStaff} team={team} setTeam={setTeam} onSaveRoleSync={handleSaveRoleSync} />}
            </div>
          </main>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          VIEW: TRIAGE (Appeals)
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeView === 'triage' && (
        <main className="pt-28 px-6 max-w-3xl mx-auto pb-32 animate-in fade-in duration-300">
          <div className="mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2 text-primary">Resolution Queue</p>
            <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">Skill Triage</h2>
            <p className="text-on-surface-variant mt-2 text-lg">Review competence claims and evidence.</p>
          </div>

          {appeals.length === 0 && (
            <div className="text-center py-20 rounded-3xl border-2 border-dashed border-outline-variant text-on-surface-variant">
              <span className="material-symbols-outlined text-[64px] mb-4 block opacity-20">inbox</span>
              <p className="font-bold text-lg">No appeals pending</p>
              <p className="text-sm mt-2 opacity-60">When staff debate AI points, their appeals will appear here.</p>
            </div>
          )}

          <div className="space-y-6">
            {appeals.map(appeal => (
              <AppealCard key={appeal.id} appeal={appeal} onResolve={resolveAppeal} />
            ))}
          </div>
        </main>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          VIEW: SKILLS ACCELERATOR
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {activeView === 'skills' && (
        <SkillsView modules={modules} setAddModuleOpen={setAddModuleOpen} isManager={currentProfile.is_manager} onRemoveModule={handleDeleteModule} />
      )}

      {/* â”€â”€ Modals â”€â”€ */}
      <ProfileModal 
        isOpen={profileOpen} 
        onClose={() => setProfileOpen(false)} 
        profile={profile} 
        onSave={handleUpdateProfile} 
        onUploadAvatar={handleUploadAvatar}
        achievements={achievements} 
        unlockedIds={unlockedIds} 
      />
      <AddTaskModal 
        isOpen={addTaskOpen} 
        onClose={() => setAddTaskOpen(false)} 
        onSubmit={handleAddTask}
        staffList={collaboratorStaffList}
      />
      <AddAchievementModal isOpen={addAchOpen} onClose={() => setAddAchOpen(false)} onSubmit={handleAddAchievement} />
      <AddModuleModal isOpen={addModuleOpen} onClose={() => setAddModuleOpen(false)} onSubmit={handleAddModule} />
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Appeal Card (Triage)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function AppealCard({ appeal, onResolve }: { appeal: AppealItem; onResolve: (id: string, pts: number, msg: string) => void }) {
  const [pts, setPts] = useState(appeal.originalPoints);
  const [msg, setMsg] = useState('');

  return (
    <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm group hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-200 ring-2 ring-primary/20 ring-offset-2 overflow-hidden shadow-sm">
            <img src={appeal.imgUrl} alt={appeal.staffName} className="w-full h-full object-cover" />
          </div>
          <div>
            <h4 className="font-bold text-on-surface text-lg">{appeal.staffName}</h4>
            <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">
              {appeal.department} â€¢ {appeal.taskTitle}
            </p>
          </div>
        </div>
        {appeal.resolved ? (
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary/10 shadow-sm">
            Resolved
          </div>
        ) : (
          <div className="bg-error/10 text-error px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-error/10 shadow-sm animate-pulse">
            Pending Resolution
          </div>
        )}
      </div>

      <div className="mb-6 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/5 italic text-on-surface-variant text-sm border-l-4 border-l-primary leading-relaxed shadow-inner">
        &quot;{appeal.appealComment}&quot;
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center bg-surface-container-low p-4 rounded-2xl border border-outline-variant/5">
        <div className="flex-1 text-center">
          <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant mb-1">AI Recommendation</p>
          <p className="text-2xl font-extrabold text-on-surface font-headline">{appeal.originalPoints} <span className="text-sm font-medium opacity-60">Points</span></p>
        </div>
        <div className="bg-outline-variant/20 p-2 rounded-full">
          <span className="material-symbols-outlined text-on-surface-variant text-base">arrow_forward</span>
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase font-bold tracking-widest text-primary mb-2">Final Merit Award</p>
          <div className="relative">
            <input 
              type="number" 
              value={pts} 
              onChange={e => setPts(parseInt(e.target.value) || 0)}
              disabled={appeal.resolved}
              className="w-full bg-surface-container-lowest border border-primary/20 rounded-xl py-3 px-4 font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">Points</span>
          </div>
        </div>
      </div>

      {!appeal.resolved && (
        <div className="mt-6 flex flex-col gap-4">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest block mb-1 text-on-surface-variant">Resolution Note</label>
            <textarea 
              value={msg} 
              onChange={e => setMsg(e.target.value)} 
              className="w-full rounded-2xl py-3 px-4 outline-none resize-none h-20 border border-outline-variant/20 text-sm shadow-inner bg-surface-container" 
              placeholder="e.g., Complexity verified via cross-browser logs." 
            />
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => onResolve(appeal.id, pts, msg)}
              className="flex-[2] bg-primary text-white py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all mission-gradient"
            >
              Confirm Resolution
            </button>
            <button className="flex-1 bg-surface-container-lowest text-on-surface-variant py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest border border-outline-variant/20 hover:bg-surface-container transition-all">
              Reject Claim
            </button>
          </div>
        </div>
      )}

      {appeal.resolved && appeal.resolutionMessage && (
        <div className="mt-6 p-4 rounded-2xl border border-primary/20 bg-primary/5 shadow-inner">
          <p className="text-[10px] uppercase font-bold tracking-widest mb-1 text-primary">Resolution Sent</p>
          <p className="text-sm font-medium text-on-surface">{appeal.resolutionMessage}</p>
          <p className="text-sm font-extrabold mt-2 text-primary">Final Points: {appeal.finalPoints} Points</p>
        </div>
      )}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Skills View
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function SkillsView({ modules, setAddModuleOpen, isManager, onRemoveModule }: { modules: SkillModule[], setAddModuleOpen: (v: boolean) => void, isManager: boolean, onRemoveModule: (id: string) => void }) {
  const [selectedModule, setSelectedModule] = useState<SkillModule | null>(null);

  if (selectedModule) {
    return (
      <main className="pt-28 px-6 max-w-5xl mx-auto pb-32 animate-in fade-in duration-300">
        <button 
          onClick={() => setSelectedModule(null)} 
          className="mb-8 flex items-center gap-2 font-bold text-[11px] tracking-widest uppercase px-5 py-2.5 rounded-xl border border-outline-variant/10 text-on-surface-variant bg-surface-container-lowest shadow-sm hover:text-primary transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to Matrix
        </button>

        {/* Module Header */}
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-3xl">
              <span className="text-xs font-bold uppercase tracking-[0.15em] mb-2 block text-primary">Mission Briefing // {selectedModule.code}</span>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface font-headline">{selectedModule.title}</h2>
              <p className="mt-4 text-lg text-on-surface-variant leading-relaxed">{selectedModule.description}</p>
            </div>
            <div className="flex gap-3">
              <div className="px-6 py-3 rounded-2xl border border-primary/20 bg-primary/5 flex items-center gap-3 shadow-inner">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Status: Operational</span>
              </div>
            </div>
          </div>
        </section>

        {/* Stepper + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-8">
            {/* Step 1: Learn - Completed */}
            <StepCard step={1} title="Absorb" status="completed" description="Theoretical foundations of the modular domain through curated high-fidelity resources.">
              <div className="mt-6 flex flex-col gap-3">
                <a className="flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/10 bg-surface-container shadow-sm transition-all hover:border-primary/20 hover:bg-white active:scale-[0.99] group/link" href="#">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm text-primary transition-colors group-hover/link:bg-primary group-hover/link:text-white">
                    <span className="material-symbols-outlined fill-1">play_circle</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-on-surface">Distributed Systems Fundamentals</div>
                    <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant mt-1">45 min video lesson</div>
                  </div>
                </a>
              </div>
            </StepCard>

            {/* Step 2: Practice - In Progress */}
            <StepCard step={2} title="Execute" status="in-progress" description="Configure and deploy within the simulated infrastructure sandbox environment to test durability.">
              <div className="mt-6 space-y-4">
                <a className="flex items-center justify-between p-5 rounded-2xl border border-primary/20 bg-primary/5 cursor-pointer shadow-inner transition-all hover:bg-primary/10 group/sandbox" href="#">
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary group-hover/sandbox:scale-110 transition-transform">terminal</span>
                    <span className="font-bold text-primary font-headline">Architecture Sandbox Active</span>
                  </div>
                  <span className="material-symbols-outlined text-primary">open_in_new</span>
                </a>
                <div className="p-8 rounded-[32px] border-2 border-dashed border-outline-variant bg-surface-container-lowest flex flex-col items-center justify-center text-center transition-all hover:border-primary/40 cursor-pointer group/upload">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center mb-4 transition-all group-hover/upload:scale-110 group-hover/upload:bg-primary/5">
                    <span className="material-symbols-outlined text-outline group-hover/upload:text-primary transition-colors">cloud_upload</span>
                  </div>
                  <div className="text-lg font-bold text-on-surface font-headline">Telemetry Sync</div>
                  <div className="text-xs mt-2 max-w-xs text-on-surface-variant leading-relaxed">Drag and drop your practice deployment logs or YAML configurations here.</div>
                  <button className="mt-6 px-8 py-3 rounded-xl text-[11px] font-extrabold uppercase tracking-widest bg-surface-container text-on-surface shadow-sm border border-outline-variant/10 hover:bg-white hover:border-primary/20 transition-all active:scale-95">Browse Files</button>
                </div>
              </div>
            </StepCard>

            {/* Step 3: Apply - Locked */}
            <StepCard step={3} title="Integrate" status="locked" description="Execute the skill on a live project task. Validate against production-grade benchmarks." />
          </div>

          {/* Sidebar Briefing */}
          <div className="lg:col-span-4">
            <div className="mission-gradient text-white rounded-[40px] p-8 shadow-2xl relative overflow-hidden sticky top-24">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent)]" />
              <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/5 rounded-full blur-3xl opacity-50" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                    <span className="material-symbols-outlined text-white">verified</span>
                  </div>
                  <h4 className="font-headline text-xl font-extrabold">Briefing</h4>
                </div>

                <div className="space-y-8">
                  <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-inner">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Potential Award</div>
                    <div className="text-3xl font-headline font-black text-white">+{selectedModule.meritValue.toLocaleString()} <span className="text-sm font-medium opacity-60">Points</span></div>
                  </div>
                  
                  <div className="px-1 space-y-4">
                    <div className="flex items-center justify-between text-sm py-2 border-b border-white/10">
                      <span className="opacity-60">Active Participants</span>
                      <span className="font-bold">{selectedModule.participants}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-2 border-b border-white/10">
                      <span className="opacity-60">Difficulty Index</span>
                      <span className="font-bold flex gap-1">
                        <span className="material-symbols-outlined text-[14px]">star</span>
                        <span className="material-symbols-outlined text-[14px]">star</span>
                        <span className="material-symbols-outlined text-[14px]">star_half</span>
                      </span>
                    </div>
                  </div>
                </div>

                <button className="w-full mt-10 py-4 rounded-2xl bg-white text-primary font-bold uppercase tracking-widest text-[11px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                  Request Mentor Sync
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Module Grid View
  return (
    <main className="pt-28 px-6 max-w-5xl mx-auto pb-32 animate-in fade-in duration-300">
      <div className="mb-10 flex flex-col items-center text-center">
        <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2 text-secondary">Capability Matrix</p>
        <h2 className="text-4xl md:text-5xl font-extrabold font-headline tracking-tight text-on-surface">L&D Hub</h2>
        <p className="text-on-surface-variant mt-2 text-lg mb-6">Hone your skills. Amplify your impact.</p>
        {isManager && (
          <button onClick={() => setAddModuleOpen(true)} className="bg-secondary text-black px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-md hover:scale-105 active:scale-95 transition-all">
             + New Learning Module
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {modules.map(mod => (
          <div 
            key={mod.id} 
            onClick={() => setSelectedModule(mod)} 
            className="group bg-surface-container-lowest p-8 rounded-[40px] shadow-sm border border-outline-variant/10 cursor-pointer overflow-hidden transition-all duration-500 hover:shadow-xl hover:shadow-secondary/10 hover:-translate-y-2 relative"
          >
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-secondary/5 rounded-full blur-3xl group-hover:bg-secondary/10 transition-all duration-500" />
            
            <div className="relative z-10">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-4 block">{mod.code}</span>
              <h3 className="text-2xl font-extrabold text-on-surface mb-3 font-headline group-hover:text-primary transition-colors">{mod.title}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-8 line-clamp-2">{mod.description}</p>
              
              <div className="flex justify-between items-center pt-6 border-t border-outline-variant/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-[18px] fill-1">military_tech</span>
                  </div>
                  <span className="font-extrabold text-on-surface">{mod.meritValue.toLocaleString()} <span className="text-[10px] opacity-60">Points</span></span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 overflow-hidden ring-2 ring-transparent group-hover:ring-secondary/20 transition-all">
                        <img src={`https://i.pravatar.cc/100?u=${mod.id}${i}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <div className="w-7 h-7 rounded-full border-2 border-white bg-secondary text-white text-[8px] font-bold flex items-center justify-center ring-2 ring-transparent group-hover:ring-secondary/20 transition-all">
                      +{mod.participants}
                    </div>
                  </div>
                  {isManager && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRemoveModule(mod.id); }} 
                      className="p-2 text-on-surface-variant hover:text-error transition-all"
                      title="Remove Module"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Stepper Step Card (Skills Detail)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function StepCard({ step, title, status, description, children }: { step: number, title: string, status: 'completed' | 'in-progress' | 'locked', description: string, children?: React.ReactNode }) {
  const isLocked = status === 'locked';
  const isDone = status === 'completed';
  const isPending = status === 'in-progress';

  return (
    <div className={`p-8 rounded-[40px] border transition-all duration-500 relative ${
      isLocked ? 'bg-slate-50/50 border-outline-variant/10 opacity-60' : 
      isDone ? 'bg-white border-primary/20 shadow-sm' : 
      'bg-white border-primary/30 shadow-xl'
    }`}>
      <div className="flex items-start gap-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shrink-0 ${
          isDone ? 'bg-primary text-white' : 
          isPending ? 'bg-primary/10 text-primary animate-pulse' : 
          'bg-surface-container text-on-surface-variant'
        }`}>
          {isDone ? 'âœ“' : step}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-extrabold text-on-surface font-headline">{title}</h3>
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${
              isDone ? 'bg-primary/10 text-primary' : 
              isPending ? 'bg-secondary-container/50 text-secondary' : 
              'bg-surface-container text-on-surface-variant'
            }`}>
              {status.replace('-', ' ')}
            </span>
          </div>
          <p className="text-on-surface-variant leading-relaxed">{description}</p>
          {!isLocked && children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Manager Views
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function ManagerDashboardView({ team, achievements, activityLog, setAddAchOpen, onDeleteStaff }: { team: TeamMember[], achievements: Achievement[], activityLog: ActivityLog[], setAddAchOpen: (v: boolean) => void, onDeleteStaff: (id: string, name: string) => void }) {
  // â”€â”€ Health Score: 40% active ratio, 40% point velocity, 20% achievement unlocks â”€â”€
  const totalStaff = team.length;
  const activeStaff = team.filter(m => m.monthPoints > 0).length;
  const avgPoints = totalStaff > 0 ? team.reduce((s, m) => s + m.monthPoints, 0) / totalStaff : 0;
  const pointsVelocityScore = Math.min(1, avgPoints / 500);
  const achieveUnlocks = activityLog.filter(a => a.type === 'achievement').length;
  const unlockRate = achievements.length > 0 ? Math.min(1, achieveUnlocks / achievements.length) : 0;
  const activeRatio = totalStaff > 0 ? activeStaff / totalStaff : 0;
  const healthScore = Math.round((activeRatio * 40) + (pointsVelocityScore * 40) + (unlockRate * 20));
  const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Stable' : healthScore >= 40 ? 'At Risk' : 'Critical';
  const healthBarColor = healthScore >= 80 ? 'bg-green-500' : healthScore >= 60 ? 'bg-amber-400' : 'bg-red-400';
  const healthBadgeColor = healthScore >= 80 ? 'text-green-600 bg-green-50' : healthScore >= 60 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';

  // â”€â”€ AI Assistant â”€â”€
  const idleMembers = team.filter(m => m.monthPoints === 0);
  const lowPointMembers = team.filter(m => m.monthPoints > 0 && m.monthPoints < 100);
  const aiIsAlert = idleMembers.length > 0 || lowPointMembers.length > 0;
  let aiSubject = 'Team Performing Optimally';
  let aiInsight = totalStaff === 0
    ? 'No staff members found. Add staff via Organization Settings to begin tracking productivity.'
    : `All ${team.length} staff members are active. Avg productivity: ${Math.round(avgPoints)} pts. Consider adding new achievement milestones to sustain momentum.`;
  if (idleMembers.length > 0) {
    aiSubject = `${idleMembers.length} Staff Member${idleMembers.length > 1 ? 's' : ''} Stalling`;
    aiInsight = `${idleMembers.map(m => m.name).join(', ')} ${idleMembers.length > 1 ? 'have' : 'has'} no recorded activity. Recommend deploying starter tasks to re-engage and considering a direct check-in.`;
  } else if (lowPointMembers.length > 0) {
    aiSubject = 'Low Velocity Detected';
    aiInsight = `${lowPointMembers.map(m => m.name).join(', ')} ${lowPointMembers.length > 1 ? 'are' : 'is'} underperforming. Consider a 1-on-1 review or reassigning high-value tasks to boost engagement.`;
  }

  // â”€â”€ Helpers â”€â”€
  const timeAgo = (ts: string) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };
  const ledgerEntries = activityLog.filter(a => a.type === 'points_earned').slice(0, 8);
  const systemActivity = activityLog.filter(a => a.type === 'achievement').slice(0, 5);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2 text-primary">Operational Overview</p>
          <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">Executive Dashboard</h2>
        </div>
        <div className="flex items-center gap-3 p-1.5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10">
          <button className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary/10 text-primary">Weekly</button>
          <button className="px-4 py-2 text-sm font-semibold rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container">Monthly</button>
          <div className="w-px h-6 bg-outline-variant/30 mx-1" />
          <button className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:scale-[1.02] active:scale-95 transition-all mission-gradient shadow-primary/20">
            <span className="material-symbols-outlined text-[18px]">download</span> Download
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant/5 hover:border-primary/20 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-tertiary-fixed/30 text-tertiary"><span className="material-symbols-outlined fill-1">favorite</span></div>
            <span className={`flex items-center text-xs font-bold px-2 py-1 rounded-lg ${healthBadgeColor}`}>
              <span className="material-symbols-outlined text-[14px] mr-1">{healthScore >= 80 ? 'trending_up' : healthScore >= 60 ? 'remove' : 'trending_down'}</span>
              {healthLabel}
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Org Health Score</p>
          <h2 className="text-3xl font-extrabold font-headline text-on-surface">{healthScore}<span className="text-lg text-on-surface-variant">/100</span></h2>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
            <div className={`h-2 rounded-full transition-all duration-700 ${healthBarColor}`} style={{ width: `${healthScore}%` }} />
          </div>
          <p className="text-[10px] text-on-surface-variant mt-2 opacity-70">Active: {activeStaff}/{totalStaff} Â· Avg Pts: {Math.round(avgPoints)}</p>
        </div>
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant/5 hover:border-primary/20 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary"><span className="material-symbols-outlined fill-1">groups</span></div>
            <span className="flex items-center text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">{team.length} Total</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Staff Roster</p>
          <h2 className="text-3xl font-extrabold font-headline text-on-surface">{activeStaff} <span className="text-lg text-on-surface-variant">Active</span></h2>
          <p className="text-[10px] text-on-surface-variant mt-4 opacity-70">{team.length - activeStaff} member(s) yet to log activity.</p>
        </div>
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant/5 hover:border-primary/20 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-secondary/10 text-secondary"><span className="material-symbols-outlined fill-1">military_tech</span></div>
            <span className="flex items-center text-xs font-bold text-secondary bg-secondary/10 px-2 py-1 rounded-lg">{ledgerEntries.length} Txns</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Points Disbursed</p>
          <h2 className="text-3xl font-extrabold font-headline text-on-surface">{team.reduce((s, m) => s + m.monthPoints, 0).toLocaleString()}<span className="text-lg text-on-surface-variant"> pts</span></h2>
          <p className="text-[10px] text-on-surface-variant mt-4 opacity-70">Via {ledgerEntries.length} task completions recorded.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-10">
        <div className="space-y-10">
          {/* Live Team Productivity */}
          <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant/10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold font-headline text-on-surface">Live Team Productivity</h3>
                <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant mt-1">Monitor & Intervene</p>
              </div>
            </div>
            {/* AI Assistant */}
            <div className={`mb-6 p-5 rounded-2xl border relative overflow-hidden ${aiIsAlert ? 'border-error/20 bg-error/5' : 'border-primary/20 bg-primary/5'}`}>
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 ${aiIsAlert ? 'bg-error/10' : 'bg-primary/10'}`} />
              <div className="flex items-start gap-4 relative z-10">
                <div className={`w-10 h-10 shrink-0 rounded-full text-white flex items-center justify-center shadow-md ${aiIsAlert ? 'bg-error' : 'bg-primary'}`}>
                  <span className="material-symbols-outlined fill-1 text-[20px]">smart_toy</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${aiIsAlert ? 'text-error' : 'text-primary'}`}>System AI Assistant</span>
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full animate-pulse ${aiIsAlert ? 'bg-error/20 text-error' : 'bg-primary/20 text-primary'}`}>Live Analysis</span>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{aiSubject}</p>
                  <p className="text-sm text-on-surface font-medium leading-relaxed">{aiInsight}</p>
                  {aiIsAlert && (
                    <div className="mt-4 flex gap-2">
                      <button className="text-[10px] font-bold uppercase tracking-widest bg-error text-white px-4 py-2 rounded-lg shadow-sm hover:scale-[1.02] active:scale-95 transition-all">Review Actions</button>
                      <button className="text-[10px] font-bold uppercase tracking-widest bg-transparent border border-outline-variant/20 text-on-surface-variant px-4 py-2 rounded-lg hover:bg-surface-container-high transition-all">Dismiss</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Staff List */}
            <div className="space-y-3">
              {team.length === 0 && (
                <div className="text-center py-10 rounded-2xl border-2 border-dashed border-outline-variant text-on-surface-variant">
                  <span className="material-symbols-outlined text-[40px] mb-2 block opacity-20">group_off</span>
                  <p className="font-bold text-sm">No staff members yet</p>
                  <p className="text-xs mt-1 opacity-60">Add staff in Organization Settings to begin monitoring.</p>
                </div>
              )}
              {team.map(member => (
                <div key={member.id} className={`flex items-center justify-between p-4 rounded-2xl transition-all shadow-sm border ${
                  member.monthPoints > 0 ? 'bg-primary/5 border-primary/20' : 'bg-surface-container-lowest border-outline-variant/10'
                }`}>
                  <div className="flex items-center gap-4">
                    <img className={`w-12 h-12 rounded-full object-cover ${member.monthPoints > 0 ? 'shadow-sm ring-2 ring-primary/30 ring-offset-2' : 'grayscale opacity-80'}`} src={member.imgUrl} alt={member.name} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg text-on-surface">{member.name}</p>
                        {member.monthPoints > 0 && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-primary" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                          </span>
                        )}
                        {member.monthPoints === 0 && (
                          <span className="bg-error/10 px-1.5 py-0.5 rounded text-[8px] uppercase font-black tracking-widest text-error">Idle</span>
                        )}
                      </div>
                      <p className={`text-[10px] uppercase font-bold tracking-widest mt-0.5 ${member.monthPoints > 0 ? 'text-primary' : 'text-slate-400'}`}>
                        {member.currentTask && member.currentTask !== 'Awaiting Task' ? `Active: ${member.currentTask}` : `Dept: ${member.department || 'General'}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right pl-4 border-l border-outline-variant/20">
                      <p className="font-extrabold font-headline text-xl text-on-surface">{member.monthPoints.toLocaleString()}</p>
                      <p className={`text-[8px] font-bold uppercase tracking-widest ${member.monthPoints > 0 ? 'text-primary' : 'text-slate-400'}`}>PTS</p>
                    </div>
                    <button onClick={() => onDeleteStaff(member.id, member.name)} className="p-2 text-on-surface-variant hover:text-error transition-colors" title="Remove Staff">
                      <span className="material-symbols-outlined text-[18px]">person_remove</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Points Ledger */}
          <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant/10">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-primary">history</span>
              <h3 className="text-xl font-bold font-headline text-on-surface">Recent Point Ledger Transactions</h3>
            </div>
            {ledgerEntries.length === 0 ? (
              <div className="text-center py-10 rounded-2xl border-2 border-dashed border-outline-variant text-on-surface-variant">
                <span className="material-symbols-outlined text-[40px] mb-2 block opacity-20">payments</span>
                <p className="font-bold text-sm">No transactions recorded</p>
                <p className="text-xs mt-1 opacity-60">Points appear here when staff complete tasks.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ledgerEntries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-4 rounded-2xl border border-outline-variant/5 bg-surface-container-low shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">add_circle</span>
                      </div>
                      <div>
                        <p className="font-bold text-on-surface text-sm">{entry.staffName}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mt-0.5">{entry.desc}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-primary font-headline">+{entry.points} <span className="text-[9px] text-on-surface-variant font-bold uppercase">PTS</span></p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">{timeAgo(entry.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System Activity */}
        <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant/10 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 transform rotate-12 scale-150 opacity-10">
            <span className="material-symbols-outlined text-[200px] fill-1">military_tech</span>
          </div>
          <div className="flex items-center justify-between mb-10 relative z-10">
            <h3 className="text-xl font-bold font-headline text-on-surface">System Activity</h3>
            <span className="material-symbols-outlined text-slate-400 cursor-pointer hover:animate-spin">sync</span>
          </div>
          <div className="relative z-10">
            {systemActivity.length === 0 ? (
              <div className="text-center py-10 rounded-2xl border-2 border-dashed border-outline-variant text-on-surface-variant">
                <span className="material-symbols-outlined text-[40px] mb-2 block opacity-20">emoji_events</span>
                <p className="font-bold text-sm">No achievements unlocked</p>
                <p className="text-xs mt-1 opacity-60">Achievement unlocks will appear here in real time.</p>
              </div>
            ) : (
              <div className="relative space-y-8">
                <div className="absolute left-5 top-2 bottom-2 w-px bg-slate-200" />
                {systemActivity.map(entry => (
                  <div key={entry.id} className="relative flex gap-6 group">
                    <div className="w-10 h-10 rounded-full shadow-sm bg-surface-container-lowest flex items-center justify-center z-10 text-primary ring-8 ring-surface-container-lowest shrink-0">
                      <span className="material-symbols-outlined fill-1">verified</span>
                    </div>
                    <div className="group-hover:translate-x-1 transition-transform">
                      <p className="text-base font-bold text-on-surface">{entry.desc}</p>
                      <p className="text-sm mt-1 text-on-surface-variant">{entry.staffName} unlocked a <span className="font-extrabold text-primary">milestone achievement</span></p>
                      <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">{timeAgo(entry.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}



function ManagerAchieveView({ achievements, setAddAchOpen, onRemoveAchievement }: { achievements: Achievement[], setAddAchOpen: (v: boolean) => void, onRemoveAchievement: (id: string) => void }) {
  return (
    <>
      <div className="flex justify-between items-end mb-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2 text-primary">Gamification Strategy</p>
          <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">Achieve Setting</h2>
          <p className="text-on-surface-variant mt-2 text-lg">Define milestones and rewards for the talent pool.</p>
        </div>
        <button onClick={() => setAddAchOpen(true)} className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-md hover:scale-[1.05] active:scale-95 transition-all mission-gradient">
          <span className="material-symbols-outlined">add</span> Create New Achievement
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {achievements.map(ach => (
          <div key={ach.id} className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm hover:shadow-lg transition-all flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">{ach.icon}</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest bg-surface-container px-2 py-1 rounded">
                Active
              </span>
            </div>
            <h4 className="text-lg font-bold text-on-surface mb-2">{ach.title}</h4>
            <p className="text-sm text-on-surface-variant mb-6 flex-1">{ach.desc}</p>
            
            <div className="pt-4 border-t border-outline-variant/10">
              <div className="flex items-center justify-between text-xs font-bold mb-3">
                <span className="text-on-surface-variant uppercase tracking-widest">Trigger Logic</span>
                <span className="text-primary">{ach.trigger || 'Manual'}</span>
              </div>
              {ach.taskRequired && (
                <div className="flex items-center justify-between text-xs font-bold mb-3">
                   <span className="text-on-surface-variant uppercase tracking-widest">Target Task</span>
                   <span className="text-on-surface">{ach.taskRequired}</span>
                </div>
              )}
               {ach.triggerValue && (
                <div className="flex items-center justify-between text-xs font-bold mb-3">
                   <span className="text-on-surface-variant uppercase tracking-widest">Req. Count</span>
                   <span className="text-on-surface">{ach.triggerValue}x</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button className="flex-1 bg-surface-container text-on-surface text-[10px] font-bold uppercase tracking-widest py-2 rounded-xl border border-outline-variant/10 hover:bg-white transition-all">Edit</button>
              <button 
                onClick={() => onRemoveAchievement(ach.id)}
                className="flex-1 bg-surface-container text-error text-[10px] font-bold uppercase tracking-widest py-2 rounded-xl border border-error/10 hover:bg-error/5 transition-all"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ManagerLedgerView({ config, setConfig }: { config: MeritConfig, setConfig: (c: MeritConfig) => void }) {
  return (
    <>
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2 text-primary">Financial Logic</p>
        <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">Points Ledger</h2>
        <p className="text-on-surface-variant mt-2 text-lg">Configure how points are calculated and awarded across the organization.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/10 shadow-sm">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">psychology</span>
            AI Point Calculation Logic
          </h3>
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/10">
              <div className="flex justify-between items-center mb-4">
                <p className="font-bold text-sm">Tier 1: Routine</p>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">Multiplier {config.multiplierRoutine}x</span>
              </div>
              <p className="text-xs text-on-surface-variant mb-4">Standard repetitive tasks with low cognitive load.</p>
              <div className="flex items-center gap-4">
                <input 
                  type="number" 
                  value={config.multiplierRoutine} 
                  onChange={e => setConfig({...config, multiplierRoutine: parseFloat(e.target.value) || 1})}
                  step={0.1} 
                  className="w-20 bg-white border border-outline-variant/20 rounded-lg p-2 text-sm font-bold text-center" 
                />
                <span className="text-xs font-bold text-on-surface-variant">Update Multiplier</span>
              </div>
            </div>

             <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10">
              <div className="flex justify-between items-center mb-4">
                <p className="font-bold text-sm">Tier 2: Standard</p>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">Multiplier {config.multiplierStandard}x</span>
              </div>
              <p className="text-xs text-on-surface-variant mb-4">Tasks requiring technical focus and manual effort.</p>
              <div className="flex items-center gap-4">
                <input 
                  type="number" 
                  value={config.multiplierStandard} 
                  onChange={e => setConfig({...config, multiplierStandard: parseFloat(e.target.value) || 1})}
                  step={0.1} 
                  className="w-20 bg-white border border-outline-variant/20 rounded-lg p-2 text-sm font-bold text-center" 
                />
                 <span className="text-xs font-bold text-on-surface-variant">Update Multiplier</span>
              </div>
            </div>
            
            <button className="w-full bg-primary text-white py-4 rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/20 mission-gradient hover:scale-[1.02] active:scale-95 transition-all">
              Save Global Ledger Logic
            </button>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/10 shadow-sm">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">history</span>
            Recent Point Ledger Transactions
          </h3>
          <div className="space-y-3">
             {[1,2,3,4,5].map(i => (
               <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-surface-container transition-colors border border-outline-variant/5">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                     <span className="material-symbols-outlined text-[20px]">add_circle</span>
                   </div>
                   <div>
                     <p className="text-sm font-bold">Staff Member #{i}</p>
                     <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest underline underline-offset-4 decoration-primary/30">Auto Point Disbursement</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <p className="font-extrabold text-primary font-headline">+{(120 * config.multiplierStandard).toFixed(0)} <span className="text-[8px]">PTS</span></p>
                   <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">10m ago</p>
                 </div>
               </div>
             ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ManagerOrgView({ config, setConfig, onDeleteStaff, team, setTeam, onSaveRoleSync }: { config: OrganizationConfig, setConfig: (c: OrganizationConfig) => void, onDeleteStaff: (id: string, name: string) => void, team: any[], setTeam: React.Dispatch<React.SetStateAction<any[]>>, onSaveRoleSync: (config: OrganizationConfig) => Promise<void> }) {
  const allRoles = Object.keys(config.autoAssignments);

  // â”€â”€ Create Staff â”€â”€
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRoles, setNewStaffRoles] = useState<string[]>([]); // multi-role
  const [newAccessCode, setNewAccessCode] = useState('');
  const [creating, setCreating] = useState(false);

  const toggleNewRole = (role: string) =>
    setNewStaffRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);

  const handleCreateStaff = async () => {
    if (!newStaffName.trim() || !newAccessCode.trim()) return alert('Name and Access Code required.');
    setCreating(true);
    const roleStr = newStaffRoles.join(', ') || 'Staff';
    const { data: profile, error } = await supabase.from('profiles').insert([{
      full_name: newStaffName.trim(),
      access_id: newStaffName.trim().toLowerCase().replace(/\s+/g, ''),
      passcode: newAccessCode.trim(),
      role: roleStr,
      photo_url: `https://i.pravatar.cc/150?u=${Date.now()}`
    }]).select().single();
    setCreating(false);
    if (error) { alert('Error creating staff: ' + error.message); return; }
    alert(`Staff "${profile.full_name}" created. Access ID: ${profile.access_id}`);
    setTeam(prev => [...prev, {
      id: profile.id, name: profile.full_name, imgUrl: profile.photo_url,
      status: 'online', currentTask: 'Awaiting Task', department: profile.department || 'General',
      monthPoints: 0, rank: prev.length + 1, elapsed: '', role: roleStr
    }]);
    setNewStaffName(''); setNewAccessCode(''); setNewStaffRoles([]);
  };

  // â”€â”€ Edit Staff (inline expand) â”€â”€
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editPasscode, setEditPasscode] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = (staff: any) => {
    setEditingId(staff.id);
    setEditName(staff.name || '');
    setEditRoles(staff.role ? staff.role.split(',').map((r: string) => r.trim()).filter(Boolean) : []);
    setEditPasscode('');
  };

  const toggleEditRole = (role: string) =>
    setEditRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const roleStr = editRoles.join(', ') || 'Staff';
    const updates: any = { full_name: editName.trim(), role: roleStr };
    if (editPasscode.trim()) updates.passcode = editPasscode.trim();
    const { error } = await supabase.from('profiles').update(updates).eq('id', editingId);
    setSaving(false);
    if (error) { alert('Failed to update: ' + error.message); return; }
    setTeam(prev => prev.map(s => s.id === editingId ? { ...s, name: editName.trim(), role: roleStr } : s));
    setEditingId(null);
  };

  // â”€â”€ Role Config â”€â”€
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [newRoleName, setNewRoleName] = useState('');
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});

  const handleAddDefaultTask = (role: string) => {
    const taskName = taskInputs[role]?.trim();
    if (!taskName) return;
    setConfig({ ...config, autoAssignments: { ...config.autoAssignments, [role]: { ...config.autoAssignments[role], tasks: [...config.autoAssignments[role].tasks, taskName] } } });
    setTaskInputs(prev => ({ ...prev, [role]: '' }));
  };

  const handleRemoveTask = (role: string, idx: number) => {
    setConfig({ ...config, autoAssignments: { ...config.autoAssignments, [role]: { ...config.autoAssignments[role], tasks: config.autoAssignments[role].tasks.filter((_, i) => i !== idx) } } });
  };

  const handleDeleteRole = (role: string) => {
    if (!confirm(`Delete the "${role}" role configuration?`)) return;
    const { [role]: _r, ...rest } = config.autoAssignments;
    setConfig({ ...config, autoAssignments: rest });
  };

  const handleCreateRole = () => {
    const roleName = newRoleName.trim();
    if (!roleName) return;
    if (config.autoAssignments[roleName]) { alert('Role already exists.'); return; }
    setConfig({ ...config, autoAssignments: { ...config.autoAssignments, [roleName]: { tasks: [] } } });
    setNewRoleName('');
  };

  return (
    <>
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2 text-primary">Workspace Governance</p>
        <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">Organization Settings</h2>
        <p className="text-on-surface-variant mt-2 text-lg">Manage business roles, auto-assignments, and issue staff access codes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

        {/* â•â• LEFT: Staff Access â•â• */}
        <div className="space-y-6">
          <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/10 shadow-sm">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">badge</span> Issued Access
            </h3>

            {/* Create Staff Form */}
            <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/5 shadow-inner mb-8">
              <p className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">person_add</span>
                Create Staff Gateway
              </p>
              <div className="space-y-3">
                <input
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  placeholder="Full Name (e.g. John Doe)"
                  className="w-full bg-white rounded-xl py-3 px-4 outline-none border border-outline-variant/10 text-sm font-medium focus:border-primary/30 focus:ring-2 focus:ring-primary/5 transition-all"
                />

                {/* Multi-role checkboxes */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Assign Roles (select one or more)</p>
                  {allRoles.length === 0 ? (
                    <p className="text-xs text-on-surface-variant italic">No roles configured yet. Add roles on the right first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allRoles.map(role => {
                        const checked = newStaffRoles.includes(role);
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => toggleNewRole(role)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                              checked
                                ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                                : 'bg-white text-on-surface-variant border-outline-variant/20 hover:border-primary/40 hover:text-primary'
                            }`}
                          >
                            {checked && <span className="mr-1">âœ“</span>}{role}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {newStaffRoles.length > 0 && (
                    <p className="text-[10px] text-primary font-bold mt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span>
                      Assigned: {newStaffRoles.join(' Â· ')}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    value={newAccessCode}
                    onChange={e => setNewAccessCode(e.target.value)}
                    placeholder="Set Passcode..."
                    className="flex-1 bg-white rounded-xl py-3 px-4 outline-none border border-outline-variant/10 text-sm font-medium focus:border-primary/30 focus:ring-2 focus:ring-primary/5 transition-all"
                  />
                  <button
                    onClick={() => setNewAccessCode(Math.floor(100000 + Math.random() * 900000).toString())}
                    className="px-4 py-3 bg-surface-container rounded-xl text-primary hover:bg-primary/10 transition-colors"
                    title="Generate random code"
                  >
                    <span className="material-symbols-outlined text-[20px]">casino</span>
                  </button>
                </div>

                <button
                  onClick={handleCreateStaff}
                  disabled={creating || !newStaffName.trim() || !newAccessCode.trim()}
                  className="w-full py-3 mt-1 rounded-xl bg-primary text-white text-xs font-bold uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating
                    ? <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Creatingâ€¦</>
                    : <><span className="material-symbols-outlined text-[16px]">person_add</span> Generate Staff Profile</>
                  }
                </button>
              </div>
            </div>

            {/* Staff Roster */}
            <h3 className="text-xl font-bold mb-4 flex items-center justify-between">
              Staff Roster
              <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-1 rounded-lg">{team.length} members</span>
            </h3>
            <div className="space-y-3 pr-1">
              {team.length === 0 && <p className="text-sm text-on-surface-variant italic text-center py-4">No staff found.</p>}
              {team.map(staff => {
                const isEditing = editingId === staff.id;
                return (
                  <div
                    key={staff.id}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isEditing ? 'border-primary/30 bg-primary/5 shadow-md shadow-primary/10' : 'border-outline-variant/5 bg-surface-container-low'
                    }`}
                  >
                    {/* Collapsed view */}
                    <div className="flex justify-between items-center p-4">
                      <div className="flex items-center gap-3">
                        <img src={staff.imgUrl || `https://i.pravatar.cc/40?u=${staff.id}`} className="w-9 h-9 rounded-xl object-cover" alt={staff.name} />
                        <div>
                          <p className="text-sm font-bold text-on-surface">{staff.name || 'Staff Member'}</p>
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-0.5">
                            ID: {staff.access_id || staff.id?.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Role badges â€” supports multi-role (comma-separated) */}
                        <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
                          {(staff.role || 'Staff').split(',').map((r: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                              {r.trim()}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => isEditing ? setEditingId(null) : openEdit(staff)}
                          className={`p-1.5 rounded-lg transition-all flex items-center ${isEditing ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-primary'}`}
                          title="Edit staff"
                        >
                          <span className="material-symbols-outlined text-[16px]">{isEditing ? 'expand_less' : 'edit'}</span>
                        </button>
                        <button
                          onClick={() => onDeleteStaff(staff.id, staff.name || 'Staff Member')}
                          className="text-error hover:bg-error/10 p-1.5 rounded-lg transition-all flex items-center"
                          title="Delete staff"
                        >
                          <span className="material-symbols-outlined text-[16px]">person_remove</span>
                        </button>
                      </div>
                    </div>

                    {/* Expanded edit panel */}
                    {isEditing && (
                      <div className="px-4 pb-5 pt-1 border-t border-primary/10 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">edit</span> Edit Staff Details
                        </p>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Full Name</label>
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="w-full bg-white rounded-xl py-2.5 px-3 outline-none border border-outline-variant/10 text-sm font-medium focus:border-primary/30 focus:ring-2 focus:ring-primary/5 transition-all"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">Assigned Roles</label>
                          {allRoles.length === 0 ? (
                            <p className="text-xs text-on-surface-variant italic">No roles configured yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {allRoles.map(role => {
                                const checked = editRoles.includes(role);
                                return (
                                  <button
                                    key={role}
                                    type="button"
                                    onClick={() => toggleEditRole(role)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                                      checked
                                        ? 'bg-primary text-white border-primary shadow-sm'
                                        : 'bg-white text-on-surface-variant border-outline-variant/20 hover:border-primary/40'
                                    }`}
                                  >
                                    {checked && 'âœ“ '}{role}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">New Passcode <span className="normal-case font-normal">(leave blank to keep current)</span></label>
                          <div className="flex gap-2">
                            <input
                              value={editPasscode}
                              onChange={e => setEditPasscode(e.target.value)}
                              placeholder="Enter new passcode..."
                              className="flex-1 bg-white rounded-xl py-2.5 px-3 outline-none border border-outline-variant/10 text-sm font-medium focus:border-primary/30 focus:ring-2 focus:ring-primary/5 transition-all"
                            />
                            <button
                              onClick={() => setEditPasscode(Math.floor(100000 + Math.random() * 900000).toString())}
                              className="px-3 py-2 bg-surface-container rounded-xl text-primary hover:bg-primary/10 transition-colors"
                              title="Generate random code"
                            >
                              <span className="material-symbols-outlined text-[18px]">casino</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving || !editName.trim()}
                            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-md shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {saving
                              ? <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> Savingâ€¦</>
                              : <><span className="material-symbols-outlined text-[14px]">save</span> Save Changes</>
                            }
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:bg-surface-container transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* â•â• RIGHT: Role Configuration â•â• */}
        <div className="space-y-6">
          <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/10 shadow-sm">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">work</span> Role Configuration
            </h3>
            <p className="text-sm text-on-surface-variant mb-6">
              Define roles and their objective goals. Staff see these as a <strong>Mission Brief</strong> on their dashboard to guide task creation.
            </p>

            <div className="space-y-4">
              {Object.entries(config.autoAssignments).map(([role, data]) => (
                <div key={role} className="border border-outline-variant/10 rounded-2xl p-5 bg-surface-container-low">
                  <div className="flex justify-between items-center mb-3 pb-3 border-b border-outline-variant/10">
                    <span className="font-extrabold text-on-surface flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>{role}
                    </span>
                    <button onClick={() => handleDeleteRole(role)} className="text-[10px] text-error font-bold uppercase tracking-widest hover:bg-error/10 px-2 py-1 rounded transition-colors">
                      Delete
                    </button>
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {data.tasks.length === 0 && <p className="text-xs text-on-surface-variant italic py-1 px-1">No objectives yet.</p>}
                    {data.tasks.map((task, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-outline-variant/5 group/task">
                        <span className="material-symbols-outlined text-[14px] text-primary">flag</span>
                        <span className="text-xs font-semibold flex-1">{task}</span>
                        <button onClick={() => handleRemoveTask(role, idx)} className="opacity-0 group-hover/task:opacity-100 text-error hover:bg-error/10 p-0.5 rounded transition-all">
                          <span className="material-symbols-outlined text-[13px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={taskInputs[role] || ''}
                      onChange={e => setTaskInputs(prev => ({ ...prev, [role]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddDefaultTask(role); }}
                      placeholder="Type objective + Enter"
                      className="flex-1 bg-white rounded-xl py-2 px-3 outline-none border border-outline-variant/10 text-xs font-medium focus:border-primary/30 focus:ring-2 focus:ring-primary/5 transition-all"
                    />
                    <button onClick={() => handleAddDefaultTask(role)} disabled={!taskInputs[role]?.trim()} className="px-3 py-2 bg-primary text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center">
                      <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* New role input */}
              <div className="border-2 border-dashed border-primary/20 rounded-2xl p-4 bg-primary/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">add_circle</span> New Business Role
                </p>
                <div className="flex gap-2">
                  <input
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateRole(); }}
                    placeholder="Role name (e.g. Senior Developer)"
                    className="flex-1 bg-white rounded-xl py-3 px-4 outline-none border border-primary/20 text-sm font-medium focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                  <button onClick={handleCreateRole} disabled={!newRoleName.trim()} className="px-4 py-3 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">add</span> Add
                  </button>
                </div>
              </div>

              {/* Save */}
              <div className="pt-2">
                <button
                  onClick={async () => {
                    setSaveStatus('saving');
                    await onSaveRoleSync(config);
                    setSaveStatus('saved');
                    setTimeout(() => setSaveStatus('idle'), 3000);
                  }}
                  disabled={saveStatus === 'saving'}
                  className={`w-full py-4 rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 ${
                    saveStatus === 'saved' ? 'bg-green-600 text-white' :
                    saveStatus === 'saving' ? 'bg-primary/60 text-white cursor-not-allowed' :
                    'bg-primary text-white mission-gradient'
                  }`}
                >
                  {saveStatus === 'saving' && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
                  {saveStatus === 'saved' && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                  {saveStatus === 'idle' && <span className="material-symbols-outlined text-[18px]">cloud_upload</span>}
                  {saveStatus === 'saving' ? 'Savingâ€¦' : saveStatus === 'saved' ? 'Saved to Cloud âœ“' : 'Save Role Synchronization'}
                </button>
                {saveStatus === 'saved' && (
                  <p className="text-center text-[10px] font-bold text-green-600 uppercase tracking-widest mt-2 flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">database</span>
                    Configuration persisted to database
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


