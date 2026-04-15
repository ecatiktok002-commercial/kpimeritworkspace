"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/AppHeader';
import ProfileModal from '@/components/ProfileModal';
import AddTaskModal from '@/components/AddTaskModal';
import AddAchievementModal from '@/components/AddAchievementModal';
import type { Task, Achievement, StaffProfile, TeamMember, AppealItem, SkillModule } from '@/lib/types';
import { AI_POINT_CONFIG, SEED_TASKS, SEED_ACHIEVEMENTS, SEED_UNLOCKED_ACHIEVEMENTS, SEED_PROFILE, SEED_TEAM, SEED_APPEALS, SEED_MODULES } from '@/lib/mockDb';
import { calculateTaskPoints, checkAchievementTriggers, checkRetroactiveUnlock } from '@/lib/taskEngine';

// ═══════════════════════════════════════════════════════════════════
// MAIN APP — Single-Page with Tab-Based View Switching
// ═══════════════════════════════════════════════════════════════════
export default function MeritKPIApp() {
  // ── Global State ──
  const [activeView, setActiveView] = useState('staff');
  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS);
  const [achievements, setAchievements] = useState<Achievement[]>(SEED_ACHIEVEMENTS);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([...SEED_UNLOCKED_ACHIEVEMENTS]);
  const [profile, setProfile] = useState<StaffProfile>(SEED_PROFILE);
  const [team] = useState<TeamMember[]>(SEED_TEAM);
  const [appeals, setAppeals] = useState<AppealItem[]>(SEED_APPEALS);
  const [modules] = useState<SkillModule[]>(SEED_MODULES);

  // ── Modal State ──
  const [profileOpen, setProfileOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addAchOpen, setAddAchOpen] = useState(false);

  // ── Timer for running tasks ──
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

  // ── Task Actions ──
  const handleAddTask = useCallback((title: string, note: string, mins: number, status: 'queued' | 'running') => {
    const calc = calculateTaskPoints(title, note, mins, AI_POINT_CONFIG);
    const task: Task = {
      id: Date.now().toString(),
      title, note,
      totalSec: mins * 60,
      elapsedSec: 0,
      status,
      tierName: calc.tierName,
      tierVal: calc.tierVal,
      points: calc.points,
    };

    // Achievement trigger check
    const newUnlocks = checkAchievementTriggers(task, achievements, unlockedIds);
    if (newUnlocks.length > 0) {
      setUnlockedIds(prev => [...prev, ...newUnlocks]);
      const achTitle = achievements.find(a => a.id === newUnlocks[0])?.title;
      setTimeout(() => alert(`🏆 ACHIEVEMENT UNLOCKED: ${achTitle}`), 300);
    }

    setTasks(prev => [...prev, task]);
    setAddTaskOpen(false);
  }, [achievements, unlockedIds]);

  const startTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'running' as const } : t));
  };

  const completeTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' as const, elapsedSec: t.totalSec } : t));
  };

  // ── Achievement Actions (Exec Dashboard) ──
  const handleAddAchievement = useCallback((icon: string, title: string, desc: string, trigger: string) => {
    const newAch: Achievement = { id: 'ach-' + Date.now(), icon, title, desc, trigger };
    setAchievements(prev => [...prev, newAch]);

    // Retroactive unlock check
    if (checkRetroactiveUnlock(newAch, tasks, unlockedIds)) {
      setUnlockedIds(prev => [...prev, newAch.id]);
      setTimeout(() => alert(`⚡ RETROACTIVE UNLOCK: Staff already qualified → ${title}`), 300);
    }

    setAddAchOpen(false);
  }, [tasks, unlockedIds]);

  // ── Appeal Resolution ──
  const resolveAppeal = (appealId: string, finalPoints: number, message: string) => {
    setAppeals(prev => prev.map(a => a.id === appealId ? { ...a, resolved: true, finalPoints, resolutionMessage: message } : a));
  };

  // ── Derived State ──
  const completedPoints = tasks.filter(t => t.status === 'completed').reduce((s, t) => s + t.points, 0);
  const lifetimePoints = 12450 + completedPoints; // seed + runtime

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface)' }}>
      <AppHeader activeView={activeView} onViewChange={setActiveView} onProfileClick={() => setProfileOpen(true)} avatarUrl={profile.photoUrl} />

      {/* ═══════════════════════════════════════
          VIEW: STAFF DASHBOARD
      ═══════════════════════════════════════ */}
      {activeView === 'staff' && (
        <main className="pt-2 px-6 max-w-md mx-auto pb-32 animate-in fade-in duration-300">
          {/* Merit Summary Card */}
          <section className="mb-8">
            <div className="mission-gradient rounded-3xl p-6 text-white shadow-lg relative overflow-hidden" style={{ boxShadow: '0 10px 15px -3px rgba(0,104,95,0.1)' }}>
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-80 mb-1">Current Month</p>
                  <h2 className="text-3xl font-extrabold font-[Plus_Jakarta_Sans] tracking-tight">{completedPoints.toLocaleString()} <span className="text-sm font-medium opacity-80">MP</span></h2>
                  <p className="text-xs opacity-70 mt-2">Lifetime Merit: <span className="text-white font-bold">{lifetimePoints.toLocaleString()} MP</span></p>
                </div>
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                  <span className="material-symbols-outlined">auto_graph</span>
                </div>
              </div>
              <div className="flex gap-4 relative z-10">
                <div className="bg-white/10 flex-1 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">Active Tasks</p>
                  <p className="text-lg font-bold">{tasks.filter(t => t.status === 'running').length.toString().padStart(2, '0')}</p>
                </div>
                <div className="bg-white/10 flex-1 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">Queue</p>
                  <p className="text-lg font-bold">{tasks.filter(t => t.status === 'queued').length.toString().padStart(2, '0')}</p>
                </div>
              </div>
            </div>
          </section>
          
          {/* Achievement Quick View — Carousel */}
          <section className="mb-8">
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3 px-1" style={{ color: 'var(--on-surface-variant)' }}>My Milestones</h3>
            <div className="flex overflow-x-auto gap-3 pb-4 no-scrollbar -mx-1 px-1 snap-x">
              {achievements.map(ach => {
                const isUnlocked = unlockedIds.includes(ach.id);
                return (
                  <div 
                    key={ach.id} 
                    className="min-w-[120px] max-w-[120px] snap-center p-3 rounded-2xl border flex flex-col items-center text-center transition-all bg-white shadow-sm"
                    style={{ 
                      borderColor: isUnlocked ? 'rgba(0,104,95,0.2)' : 'rgba(188,201,198,0.1)',
                      opacity: isUnlocked ? 1 : 0.4,
                      filter: isUnlocked ? 'none' : 'grayscale(1)'
                    }}
                  >
                    <div className="w-8 h-8 rounded-full mb-2 flex items-center justify-center" style={{ backgroundColor: isUnlocked ? 'rgba(0,104,95,0.1)' : 'var(--surface-container)', color: isUnlocked ? 'var(--primary)' : 'var(--on-surface-variant)' }}>
                      <span className="material-symbols-outlined text-[18px]" style={isUnlocked ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                        {isUnlocked ? ach.icon : 'lock'}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-tight leading-tight line-clamp-1">{ach.title}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Task List Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold font-[Plus_Jakarta_Sans]" style={{ color: 'var(--on-surface)' }}>My Assigned Tasks</h3>
            <button onClick={() => setAddTaskOpen(true)} className="text-[11px] font-bold uppercase tracking-widest text-white px-4 py-2 rounded-full shadow hover:scale-105 active:scale-95 transition-all flex items-center gap-1 mission-gradient">
              <span className="material-symbols-outlined text-[16px]">add</span> Add Task
            </button>
          </div>

          {/* Task Cards */}
          <div className="space-y-4">
            {tasks.length === 0 && (
              <div className="text-center py-12 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined text-[48px] mb-3 block opacity-30">assignment</span>
                <p className="font-bold">No tasks yet</p>
                <p className="text-sm mt-1 opacity-70">Tap &quot;Add Task&quot; to create your first task.</p>
              </div>
            )}
            {tasks.map(task => {
              const pct = task.totalSec > 0 ? Math.min(100, Math.round((task.elapsedSec / task.totalSec) * 100)) : 0;
              const remaining = Math.max(0, task.totalSec - task.elapsedSec);

              return (
                <div key={task.id} className="rounded-2xl p-5 border shadow-sm transition-all duration-300 hover:shadow-md" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.1)' }}>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded" style={{
                      backgroundColor: task.status === 'running' ? 'rgba(0,104,95,0.1)' : task.status === 'completed' ? 'rgba(0,104,95,0.1)' : 'var(--surface-container)',
                      color: task.status === 'running' ? 'var(--primary)' : task.status === 'completed' ? 'var(--secondary)' : 'var(--on-surface-variant)',
                    }}>
                      {task.status === 'running' ? '● Active' : task.status === 'completed' ? '✓ Done' : '◌ Queued'}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded" style={{ backgroundColor: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}>
                      {task.tierName} ({task.tierVal}x)
                    </span>
                  </div>

                  <h4 className="font-bold text-base mb-2" style={{ color: 'var(--on-surface)' }}>{task.title}</h4>
                  {task.note && <p className="text-sm mb-3 opacity-70" style={{ color: 'var(--on-surface-variant)' }}>{task.note}</p>}

                  {/* Points & Timer */}
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="font-extrabold" style={{ color: 'var(--primary)' }}>+{task.points} MP</span>
                    <span className="font-bold text-xs" style={{ color: task.status === 'running' ? 'var(--primary)' : 'var(--on-surface-variant)' }}>
                      {task.status === 'running' ? `⏱ ${fmt(remaining)} left` : task.status === 'completed' ? 'Completed' : `${Math.round(task.totalSec / 60)}m allocated`}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full overflow-hidden mb-4" style={{ backgroundColor: 'var(--surface-container)' }}>
                    <div className={`h-full rounded-full transition-all duration-1000 ${task.status === 'running' ? 'striped-progress' : ''}`} style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? 'var(--error)' : 'var(--primary)' }} />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {task.status === 'queued' && (
                      <button onClick={() => startTask(task.id)} className="flex-1 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all mission-gradient flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">play_arrow</span> Start Activity
                      </button>
                    )}
                    {task.status === 'running' && (
                      <button onClick={() => completeTask(task.id)} className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all border" style={{ backgroundColor: 'var(--surface-container)', color: 'var(--on-surface)', borderColor: 'rgba(188,201,198,0.2)' }}>
                        ✓ Complete Task
                      </button>
                    )}
                    {task.status !== 'completed' && (
                      <button className="py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border" style={{ backgroundColor: 'var(--surface-container-lowest)', color: 'var(--tertiary)', borderColor: 'rgba(188,201,198,0.2)' }}>
                        Debate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* ═══════════════════════════════════════
          VIEW: EXEC DASHBOARD
      ═══════════════════════════════════════ */}
      {activeView === 'manager' && (
        <div className="h-full">
          {/* Sidebar (Desktop) */}
          <aside className="hidden lg:flex flex-col fixed left-0 top-[73px] h-[calc(100vh-73px)] pt-8 w-64 z-40 border-r" style={{ backgroundColor: 'var(--surface-container-low)', borderColor: 'rgba(188,201,198,0.1)' }}>
            <div className="px-6 mb-8 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md" style={{ backgroundColor: 'var(--primary)' }}>
                <span className="material-symbols-outlined">person</span>
              </div>
              <div>
                <p className="text-sm font-bold font-[Plus_Jakarta_Sans]" style={{ color: 'var(--on-surface)' }}>Merit Admin</p>
                <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--primary)' }}>Strategic Oversight</p>
              </div>
            </div>
            <nav className="flex-1 space-y-1">
              <div className="px-4 py-3 font-bold border-r-4 flex items-center gap-3 cursor-pointer" style={{ backgroundColor: 'rgba(0,104,95,0.1)', color: 'var(--primary)', borderRightColor: 'var(--primary)' }}>
                <span className="material-symbols-outlined">dashboard</span>
                <span className="font-[Plus_Jakarta_Sans] text-sm">Executive Dashboard</span>
              </div>
              <div className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:pl-6 transition-all duration-300" style={{ color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined">payments</span>
                <span className="font-[Plus_Jakarta_Sans] text-sm">Merit Ledger</span>
              </div>
              <div className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:pl-6 transition-all duration-300" style={{ color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined">settings</span>
                <span className="font-[Plus_Jakarta_Sans] text-sm">Organization Settings</span>
              </div>
            </nav>
          </aside>

          {/* Exec Canvas */}
          <main className="pt-8 pb-32 lg:ml-64 px-6 animate-in fade-in duration-300">
            <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--primary)' }}>Operational Overview</p>
                <h2 className="text-4xl font-extrabold font-[Plus_Jakarta_Sans] tracking-tight" style={{ color: 'var(--on-surface)' }}>Executive Dashboard</h2>
              </div>
              <div className="flex items-center gap-3 p-1.5 rounded-2xl shadow-sm border" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.1)' }}>
                <button className="px-4 py-2 text-sm font-semibold rounded-xl" style={{ backgroundColor: 'rgba(0,104,95,0.1)', color: 'var(--primary)' }}>Weekly</button>
                <button className="px-4 py-2 text-sm font-semibold rounded-xl transition-colors" style={{ color: 'var(--on-surface-variant)' }}>Monthly</button>
                <div className="w-px h-6 mx-1" style={{ backgroundColor: 'rgba(188,201,198,0.3)' }} />
                <button className="flex items-center gap-2 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:scale-[1.02] active:scale-95 transition-all mission-gradient">
                  <span className="material-symbols-outlined text-[18px]">download</span> Download
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="p-8 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] group hover:-translate-y-1 transition-all duration-300 border" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.05)' }}>
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(0,104,95,0.1)', color: 'var(--primary)' }}><span className="material-symbols-outlined">payments</span></div>
                  <span className="flex items-center text-xs font-bold px-2 py-1 rounded-lg" style={{ color: 'var(--secondary)', backgroundColor: 'rgba(194,235,227,0.5)' }}>
                    <span className="material-symbols-outlined text-[14px] mr-1">trending_up</span> 12.5%
                  </span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--on-surface-variant)' }}>Total Merit Disbursed</p>
                <h2 className="text-3xl font-extrabold font-[Plus_Jakarta_Sans]" style={{ color: 'var(--on-surface)' }}>248,500 pts</h2>
                <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full w-[75%] rounded-full" style={{ backgroundColor: 'var(--primary)' }} /></div>
              </div>
              <div className="p-8 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:-translate-y-1 transition-all duration-300 border" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.05)' }}>
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(194,235,227,0.5)', color: 'var(--secondary)' }}><span className="material-symbols-outlined">bolt</span></div>
                  <span className="flex items-center text-xs font-bold px-2 py-1 rounded-lg" style={{ color: 'var(--secondary)', backgroundColor: 'rgba(194,235,227,0.5)' }}>
                    <span className="material-symbols-outlined text-[14px] mr-1">trending_up</span> 8.2%
                  </span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--on-surface-variant)' }}>Active Team Velocity</p>
                <h2 className="text-3xl font-extrabold font-[Plus_Jakarta_Sans]" style={{ color: 'var(--on-surface)' }}>42.8 pts/hr</h2>
                <p className="text-sm mt-2 font-bold" style={{ color: 'var(--primary)' }}>Top 5% of industry benchmark</p>
              </div>
              <div className="p-8 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:-translate-y-1 transition-all duration-300 border" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.05)' }}>
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,219,206,0.3)', color: 'var(--tertiary)' }}><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span></div>
                  <span className="flex items-center text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg"><span className="material-symbols-outlined text-[14px] mr-1">remove</span> Stable</span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--on-surface-variant)' }}>Org Health Score</p>
                <h2 className="text-3xl font-extrabold font-[Plus_Jakarta_Sans]" style={{ color: 'var(--on-surface)' }}>94<span className="text-lg" style={{ color: 'var(--on-surface-variant)' }}>/100</span></h2>
                <div className="flex gap-1 mt-4">
                  {[1,2,3,4].map(i => <div key={i} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />)}
                  <div className="h-1.5 flex-1 bg-slate-200 rounded-full" />
                </div>
              </div>
            </section>

            {/* Main 2-Column Grid */}
            <section className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-10">
              {/* Left Column */}
              <div className="space-y-10">
                {/* Live Team Productivity */}
                <div className="p-8 rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.04)] border" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.1)' }}>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-bold font-[Plus_Jakarta_Sans]" style={{ color: 'var(--on-surface)' }}>Live Team Productivity</h3>
                      <p className="text-[10px] uppercase font-bold tracking-widest mt-1" style={{ color: 'var(--on-surface-variant)' }}>Monitor & Intervene</p>
                    </div>
                    <button className="text-sm font-bold flex items-center px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'var(--primary)', backgroundColor: 'rgba(0,104,95,0.05)' }}>
                      View All <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {team.map(member => (
                      <div key={member.id} className={`flex items-center justify-between p-4 rounded-2xl transition-all group shadow-sm border ${member.status === 'active' ? '' : ''}`} style={{
                        backgroundColor: member.status === 'active' ? 'rgba(0,104,95,0.05)' : 'var(--surface-container-lowest)',
                        borderColor: member.status === 'active' ? 'rgba(0,104,95,0.2)' : 'rgba(188,201,198,0.1)',
                      }}>
                        <div className="flex items-center gap-4">
                          <img className={`w-12 h-12 rounded-full object-cover ${member.status === 'active' ? 'shadow-sm' : 'grayscale opacity-80'}`} style={member.status === 'active' ? { outline: '2px solid rgba(0,104,95,0.3)', outlineOffset: '2px' } : undefined} src={member.imgUrl} alt={member.name} />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`font-bold text-lg ${member.status !== 'active' ? 'opacity-80' : ''}`} style={{ color: 'var(--on-surface)' }}>{member.name}</p>
                              {member.status === 'active' && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--primary)' }} />
                                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--primary)' }} />
                                </span>
                              )}
                              {member.status === 'idle' && (
                                <div className="px-1.5 py-0.5 rounded flex items-center" style={{ backgroundColor: 'rgba(186,26,26,0.1)' }}>
                                  <span className="text-[8px] uppercase font-black tracking-widest" style={{ color: 'var(--error)' }}>Idle</span>
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] uppercase font-bold tracking-widest mt-0.5" style={{ color: member.status === 'active' ? 'var(--primary)' : '#94a3b8' }}>
                              {member.status === 'active' ? `Working: ${member.currentTask}` : `Queue: 3 Tasks Pending`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {member.status === 'active' && member.elapsed && (
                            <>
                              <div className="text-right hidden sm:block">
                                <p className="font-bold font-[Plus_Jakarta_Sans] text-sm" style={{ color: 'var(--primary)' }}>{member.elapsed}</p>
                                <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'rgba(0,104,95,0.7)' }}>Elapsed</p>
                              </div>
                              <button className="bg-white border p-2 rounded-xl shadow-sm transition-colors active:scale-95 group-hover:opacity-100 sm:opacity-0 focus:opacity-100 flex items-center justify-center hover:bg-red-50" style={{ color: 'var(--primary)', borderColor: 'rgba(0,104,95,0.2)' }} title="Remote Pause">
                                <span className="material-symbols-outlined text-[20px]">pause</span>
                              </button>
                            </>
                          )}
                          <div className="text-right pl-4 min-w-[60px]" style={{ borderLeft: member.status === 'active' ? '1px solid rgba(0,104,95,0.2)' : undefined }}>
                            <p className={`font-extrabold font-[Plus_Jakarta_Sans] text-xl ${member.status !== 'active' ? 'opacity-80' : ''}`} style={{ color: 'var(--on-surface)' }}>{member.monthPoints.toLocaleString()}</p>
                            <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: member.status === 'active' ? 'var(--primary)' : '#94a3b8' }}>Rank #{member.rank}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ═══════════════════════════════════════
                    🏆 ACHIEVEMENT ENGINE
                ═══════════════════════════════════════ */}
                <div className="p-8 rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.04)] border" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.1)' }}>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-bold font-[Plus_Jakarta_Sans]" style={{ color: 'var(--on-surface)' }}>Achievement Engine</h3>
                      <p className="text-[10px] uppercase font-bold tracking-widest mt-1" style={{ color: 'var(--on-surface-variant)' }}>Configure & Automate</p>
                    </div>
                    <button onClick={() => setAddAchOpen(true)} className="text-sm font-bold flex items-center px-3 py-1.5 rounded-lg transition-colors border" style={{ color: 'var(--primary)', borderColor: 'rgba(0,104,95,0.2)' }}>
                      <span className="material-symbols-outlined text-[18px] mr-1">add</span> Create
                    </button>
                  </div>
                  <div className="space-y-3">
                    {achievements.map(ach => (
                      <div key={ach.id} className="bg-white p-4 rounded-2xl border shadow-sm flex items-start gap-4 hover:shadow-md transition-all" style={{ borderColor: 'rgba(188,201,198,0.2)' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>
                          <span className="material-symbols-outlined">{ach.icon}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-bold text-sm" style={{ color: 'var(--on-surface)' }}>{ach.title}</h4>
                            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-amber-600/20 text-amber-600" style={{ backgroundColor: 'var(--surface-container)' }}>{ach.trigger}</span>
                          </div>
                          <p className="text-xs line-clamp-1" style={{ color: 'var(--on-surface-variant)' }}>{ach.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column — Activity Feed */}
              <div className="p-8 rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.04)] border relative overflow-hidden" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.1)' }}>
                <div className="absolute -right-10 -top-10 transform rotate-12 scale-150 opacity-10" style={{ color: 'var(--surface-variant)' }}>
                  <span className="material-symbols-outlined text-[200px]" style={{ fontVariationSettings: "'FILL' 1" }}>scatter_plot</span>
                </div>
                <div className="flex items-center justify-between mb-10 relative z-10">
                  <h3 className="text-xl font-bold font-[Plus_Jakarta_Sans]" style={{ color: 'var(--on-surface)' }}>System Activity</h3>
                  <span className="material-symbols-outlined text-slate-400 cursor-pointer hover:animate-spin">sync</span>
                </div>
                <div className="space-y-8 relative z-10">
                  <div className="absolute left-5 top-2 bottom-2 w-px bg-slate-200" />
                  <div className="relative flex gap-6 group">
                    <div className="w-10 h-10 rounded-full shadow-sm flex items-center justify-center z-10" style={{ backgroundColor: 'var(--surface-container-lowest)', boxShadow: '0 0 0 8px var(--surface-container-lowest)', color: 'var(--primary)' }}>
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    </div>
                    <div className="group-hover:translate-x-1 transition-transform">
                      <p className="text-base font-bold" style={{ color: 'var(--on-surface)' }}>Milestone Verified: API v2 Launch</p>
                      <p className="text-sm mt-1" style={{ color: 'var(--on-surface-variant)' }}>Engineering Team was awarded <span className="font-extrabold" style={{ color: 'var(--primary)' }}>12,000 pts</span></p>
                      <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">2 Hours Ago</p>
                    </div>
                  </div>
                  <div className="relative flex gap-6 group">
                    <div className="w-10 h-10 rounded-full shadow-sm flex items-center justify-center z-10" style={{ backgroundColor: 'var(--surface-container-lowest)', boxShadow: '0 0 0 8px var(--surface-container-lowest)', color: 'var(--tertiary)' }}>
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>forum</span>
                    </div>
                    <div className="group-hover:translate-x-1 transition-transform">
                      <p className="text-base font-bold" style={{ color: 'var(--on-surface)' }}>Performance Review Initiated</p>
                      <p className="text-sm mt-1" style={{ color: 'var(--on-surface-variant)' }}>Strategic audit started for Q3 Budgeting cycle</p>
                      <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">5 Hours Ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            </div>
          </main>
        </div>
      )}

      {/* ═══════════════════════════════════════
          VIEW: TRIAGE (Appeals)
      ═══════════════════════════════════════ */}
      {activeView === 'triage' && (
        <main className="pt-8 px-6 max-w-3xl mx-auto pb-32">
          <div className="mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--primary)' }}>Resolution Queue</p>
            <h2 className="text-4xl font-extrabold font-[Plus_Jakarta_Sans] tracking-tight" style={{ color: 'var(--on-surface)' }}>Triage Center</h2>
            <p className="text-sm mt-2" style={{ color: 'var(--on-surface-variant)' }}>Staff appeals for AI-assigned evaluations are reviewed and resolved here.</p>
          </div>

          {appeals.length === 0 && (
            <div className="text-center py-20 rounded-3xl border-2 border-dashed" style={{ borderColor: 'var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
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

      {/* ═══════════════════════════════════════
          VIEW: SKILLS ACCELERATOR
      ═══════════════════════════════════════ */}
      {activeView === 'skills' && (
        <SkillsView modules={modules} />
      )}

      {/* ── Modals ── */}
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} profile={profile} onSave={setProfile} achievements={achievements} unlockedIds={unlockedIds} />
      <AddTaskModal isOpen={addTaskOpen} onClose={() => setAddTaskOpen(false)} onSubmit={handleAddTask} />
      <AddAchievementModal isOpen={addAchOpen} onClose={() => setAddAchOpen(false)} onSubmit={handleAddAchievement} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Appeal Card (Triage)
// ═══════════════════════════════════════════════════════════════════
function AppealCard({ appeal, onResolve }: { appeal: AppealItem; onResolve: (id: string, pts: number, msg: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [pts, setPts] = useState(appeal.originalPoints);
  const [msg, setMsg] = useState('');

  return (
    <div className="rounded-3xl border shadow-sm overflow-hidden transition-all" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.1)' }}>
      {/* Header */}
      <div className="p-6 cursor-pointer flex items-center justify-between" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-4">
          <img className="w-12 h-12 rounded-full object-cover shadow-sm" src={appeal.imgUrl} alt={appeal.staffName} />
          <div>
            <p className="font-bold" style={{ color: 'var(--on-surface)' }}>{appeal.staffName}</p>
            <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'var(--on-surface-variant)' }}>{appeal.department} • {appeal.taskTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {appeal.resolved ? (
            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,104,95,0.1)', color: 'var(--primary)' }}>Resolved</span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(186,26,26,0.1)', color: 'var(--error)' }}>Pending</span>
          )}
          <span className="material-symbols-outlined transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--on-surface-variant)' }}>expand_more</span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-6 pb-6 space-y-4 border-t" style={{ borderColor: 'rgba(188,201,198,0.1)' }}>
          <div className="pt-4">
            <p className="text-[10px] uppercase font-bold tracking-widest mb-2" style={{ color: 'var(--primary)' }}>Staff Reasoning</p>
            <div className="p-4 rounded-xl italic text-sm border" style={{ backgroundColor: 'var(--surface-container-low)', borderColor: 'rgba(188,201,198,0.2)', color: 'var(--on-surface)' }}>
              &quot;{appeal.appealComment}&quot;
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex-1 text-center p-4 rounded-xl border" style={{ backgroundColor: 'var(--surface-container-low)', borderColor: 'rgba(188,201,198,0.2)' }}>
              <p className="text-[10px] uppercase font-bold tracking-widest mb-1" style={{ color: 'var(--on-surface-variant)' }}>AI Original</p>
              <p className="text-2xl font-extrabold font-[Plus_Jakarta_Sans]" style={{ color: 'var(--on-surface)' }}>{appeal.originalPoints} <span className="text-sm font-medium" style={{ color: 'var(--on-surface-variant)' }}>MP</span></p>
            </div>
            <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)' }}>arrow_forward</span>
            <div className="flex-1">
              <label className="text-[10px] uppercase font-bold tracking-widest block mb-1" style={{ color: 'var(--primary)' }}>Manager Final Decision</label>
              <input type="number" value={pts} onChange={e => setPts(parseInt(e.target.value) || 0)} className="w-full rounded-xl py-3 px-4 outline-none border font-bold text-lg" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)', color: 'var(--on-surface)' }} disabled={appeal.resolved} />
            </div>
          </div>

          {!appeal.resolved && (
            <>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest block mb-1" style={{ color: 'var(--on-surface-variant)' }}>Resolution Message to Staff</label>
                <textarea value={msg} onChange={e => setMsg(e.target.value)} className="w-full rounded-xl py-3 px-4 outline-none resize-none h-16 border text-sm" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'rgba(188,201,198,0.2)' }} placeholder="E.g., Adjusted for manual rollback complexity." />
              </div>
              <button onClick={() => onResolve(appeal.id, pts, msg)} className="w-full text-white py-3.5 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg hover:scale-[1.02] active:scale-95 transition-all mission-gradient">
                Send Resolution
              </button>
            </>
          )}

          {appeal.resolved && appeal.resolutionMessage && (
            <div className="p-4 rounded-xl border" style={{ backgroundColor: 'rgba(0,104,95,0.05)', borderColor: 'rgba(0,104,95,0.2)' }}>
              <p className="text-[10px] uppercase font-bold tracking-widest mb-1" style={{ color: 'var(--primary)' }}>Resolution Sent</p>
              <p className="text-sm font-medium" style={{ color: 'var(--on-surface)' }}>{appeal.resolutionMessage}</p>
              <p className="text-sm font-extrabold mt-2" style={{ color: 'var(--primary)' }}>Final Points: {appeal.finalPoints} MP</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Skills View
// ═══════════════════════════════════════════════════════════════════
function SkillsView({ modules }: { modules: SkillModule[] }) {
  const [selectedModule, setSelectedModule] = useState<SkillModule | null>(null);

  if (selectedModule) {
    return (
      <main className="pt-8 px-6 max-w-5xl mx-auto pb-32">
        <button onClick={() => setSelectedModule(null)} className="mb-8 flex items-center gap-2 font-bold text-sm tracking-widest uppercase px-4 py-2 rounded-xl w-max border transition-colors hover:text-[var(--primary)]" style={{ backgroundColor: 'var(--surface-container-low)', color: 'var(--on-surface-variant)', borderColor: 'rgba(188,201,198,0.1)' }}>
          <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to Modules
        </button>

        {/* Module Header */}
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.15em] mb-2 block" style={{ color: 'var(--primary)' }}>Skill Accelerator // {selectedModule.code}</span>
              <h2 className="font-[Plus_Jakarta_Sans] text-4xl md:text-5xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>{selectedModule.title}</h2>
              <p className="mt-4 max-w-2xl text-lg" style={{ color: 'var(--on-surface-variant)' }}>{selectedModule.description}</p>
            </div>
            <div className="flex gap-3">
              <div className="px-6 py-3 rounded-xl border flex items-center gap-3 shadow-inner" style={{ backgroundColor: 'rgba(0,104,95,0.1)', borderColor: 'rgba(0,104,95,0.2)' }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--primary)' }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Status: Active</span>
              </div>
            </div>
          </div>
        </section>

        {/* Stepper + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-6">
            {/* Step 1: Learn - Completed */}
            <StepCard step={1} title="Learn" status="completed" description="Absorb the theoretical foundations of scalable architecture through curated high-fidelity resources.">
              <a className="flex items-center gap-4 p-4 rounded-xl border shadow-sm transition-colors cursor-pointer" href="#" style={{ backgroundColor: 'var(--surface-container-low)', borderColor: 'rgba(188,201,198,0.1)' }}>
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm" style={{ color: 'var(--primary)' }}><span className="material-symbols-outlined">video_library</span></div>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--on-surface)' }}>Distributed Patterns</div>
                  <div className="text-[10px] uppercase font-bold tracking-widest mt-1" style={{ color: 'var(--on-surface-variant)' }}>45 min video</div>
                </div>
              </a>
            </StepCard>

            {/* Step 2: Practice - In Progress */}
            <StepCard step={2} title="Practice" status="in-progress" description="Configure a multi-region load balancer within the simulated infrastructure sandbox environment to test durability.">
              <div className="space-y-4">
                <a className="flex items-center justify-between p-5 rounded-xl border cursor-pointer shadow-inner transition-all" style={{ backgroundColor: 'rgba(0,104,95,0.05)', borderColor: 'rgba(0,104,95,0.2)' }} href="#">
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>terminal</span>
                    <span className="font-bold" style={{ color: 'var(--primary)' }}>Open Architecture Sandbox</span>
                  </div>
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>open_in_new</span>
                </a>
                <div className="p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center transition-all cursor-pointer" style={{ borderColor: 'var(--outline-variant)', backgroundColor: 'var(--surface-container-lowest)' }}>
                  <span className="material-symbols-outlined text-[40px] mb-3" style={{ color: 'var(--outline)' }}>cloud_upload</span>
                  <div className="text-base font-bold" style={{ color: 'var(--on-surface)' }}>Upload Practice Results</div>
                  <div className="text-xs mt-2 max-w-sm" style={{ color: 'var(--on-surface-variant)' }}>Drag and drop your .yaml configuration files here mapped against the simulator.</div>
                  <button className="mt-6 px-8 py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-sm cursor-pointer transition-colors" style={{ backgroundColor: 'var(--surface-container)', color: 'var(--on-surface)' }}>Browse Files</button>
                </div>
              </div>
            </StepCard>

            {/* Step 3: Apply - Locked */}
            <StepCard step={3} title="Apply" status="locked" description="Execute the skill on a live project task. Complete the 'Global Scalability Refactor' on the primary production repository." />
          </div>

          {/* Sidebar Briefing */}
          <div className="lg:col-span-4 space-y-8">
            <div className="mission-gradient text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
              <h4 className="font-[Plus_Jakarta_Sans] text-xl font-bold mb-6 flex items-center gap-3 relative z-10">
                <span className="material-symbols-outlined" style={{ color: 'var(--primary-fixed)' }}>military_tech</span> Briefing Details
              </h4>
              <div className="space-y-6 relative z-10">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1 border-b border-white/10 pb-1" style={{ color: 'var(--primary-fixed)' }}>Valuation Impact</div>
                  <div className="text-2xl font-[Plus_Jakarta_Sans] font-black text-white mt-2">+{selectedModule.meritValue.toLocaleString()} Merit Points</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2 border-b border-white/10 pb-1" style={{ color: 'var(--primary-fixed)' }}>Participants</div>
                  <p className="text-sm opacity-80">{selectedModule.participants} staff enrolled</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Module Grid View
  return (
    <main className="pt-8 px-6 max-w-5xl mx-auto pb-32">
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--primary)' }}>Learning Modules</p>
        <h2 className="text-4xl font-extrabold font-[Plus_Jakarta_Sans] tracking-tight" style={{ color: 'var(--on-surface)' }}>Skills Accelerator</h2>
        <p className="text-sm mt-2" style={{ color: 'var(--on-surface-variant)' }}>Self-directed learning modules with merit rewards upon completion.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map(mod => (
          <div key={mod.id} onClick={() => setSelectedModule(mod)} className="p-6 rounded-3xl cursor-pointer shadow-sm hover:shadow-[0_10px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 border group" style={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'rgba(188,201,198,0.1)' }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2 block" style={{ color: 'var(--on-surface-variant)' }}>{mod.code}</span>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--on-surface)' }}>{mod.title}</h3>
            <p className="text-sm mb-6 line-clamp-2" style={{ color: 'var(--on-surface-variant)' }}>{mod.description}</p>
            <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: 'rgba(188,201,198,0.1)' }}>
              <span className="font-extrabold flex items-center gap-1" style={{ color: 'var(--tertiary)' }}>
                <span className="material-symbols-outlined text-[16px]">military_tech</span> {mod.meritValue.toLocaleString()} MP
              </span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{mod.participants} Active</span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Stepper Step Card (Skills Detail)
// ═══════════════════════════════════════════════════════════════════
function StepCard({ step, title, status, description, children }: { step: number; title: string; status: 'completed' | 'in-progress' | 'locked'; description: string; children?: React.ReactNode }) {
  return (
    <div className={`relative group ${status === 'locked' ? 'opacity-60' : ''}`}>
      {status !== 'locked' && <div className="absolute left-6 top-16 bottom-0 w-0.5 -mb-6 group-last:hidden" style={{ backgroundColor: 'rgba(0,104,95,0.2)' }} />}
      <div className={`rounded-3xl p-8 relative overflow-hidden border ${status === 'in-progress' ? 'shadow-[0_10px_40px_rgba(0,0,0,0.06)] border-2' : 'shadow-sm'}`} style={{
        backgroundColor: status === 'locked' ? 'var(--surface-container-low)' : 'var(--surface-container-lowest)',
        borderColor: status === 'in-progress' ? 'var(--primary)' : 'rgba(188,201,198,0.1)',
      }}>
        <div className="flex gap-6">
          <div className="flex-shrink-0 z-10">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{
              backgroundColor: status === 'completed' ? undefined : status === 'in-progress' ? 'white' : 'rgba(188,201,198,0.3)',
              background: status === 'completed' ? 'linear-gradient(135deg, #00685f 0%, #008378 100%)' : undefined,
              color: status === 'completed' ? 'white' : status === 'in-progress' ? 'var(--primary)' : 'var(--on-surface-variant)',
              border: status === 'in-progress' ? '3px solid var(--primary)' : undefined,
              boxShadow: `0 0 0 8px ${status === 'locked' ? 'var(--surface-container-low)' : 'var(--surface-container-lowest)'}`,
            }}>
              {status === 'completed' ? <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                : status === 'locked' ? <span className="material-symbols-outlined">lock</span>
                : <span className="font-[Plus_Jakarta_Sans] font-black text-lg">{step.toString().padStart(2, '0')}</span>}
            </div>
          </div>
          <div className="flex-grow pt-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-[Plus_Jakarta_Sans] text-xl font-bold">Step {step}: {title}</h3>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full ${status === 'in-progress' ? 'animate-pulse' : ''}`} style={{
                backgroundColor: status !== 'locked' ? 'rgba(0,104,95,0.1)' : undefined,
                color: status !== 'locked' ? 'var(--primary)' : 'var(--on-surface-variant)',
              }}>
                {status === 'completed' ? 'Completed' : status === 'in-progress' ? 'In Progress' : 'Locked'}
              </span>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--on-surface-variant)' }}>{description}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
