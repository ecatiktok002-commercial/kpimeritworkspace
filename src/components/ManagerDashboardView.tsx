"use client";

import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar, Tooltip, ReferenceLine } from 'recharts';
import type { TeamMember, Task, ActivityLog } from '@/lib/types';
import EfficiencyBadge from './EfficiencyBadge';
import OrgHealthCard from './OrgHealthCard';
import SkillGapVisualizer from './SkillGapVisualizer';
import AISystemInsight from './AISystemInsight';

interface ManagerDashboardViewProps {
  team: TeamMember[];
  tasks: Task[];
  activityLog: ActivityLog[];
  flaggedTasks?: any[]; // New prop
  onResolveFlag?: (id: string) => void; // New prop
  onPauseTask?: (id: string) => void;
  onDeleteStaff: (id: string, name: string) => void;
  onMarkTaskViewed: (id: string) => void;
  viewedIds: string[];
  markViewed: (id: string) => void;
  isManager?: boolean;
  meritConfig?: any;
}

export default function ManagerDashboardView({
  team: baseTeam,
  tasks,
  activityLog,
  flaggedTasks = [],
  onResolveFlag,
  onPauseTask,
  onDeleteStaff,
  onMarkTaskViewed,
  viewedIds,
  markViewed,
  isManager,
  meritConfig
}: ManagerDashboardViewProps) {
  const [minPointThreshold, setMinPointThreshold] = useState<number>(975);
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('weekly');
  const [activeTab, setActiveTab] = useState<'monitor' | 'audits'>('monitor');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [drawerTab, setDrawerTab] = useState<'tasks' | 'evaluation'>('tasks');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [hasEvaluated, setHasEvaluated] = useState(false);

  const getDates = () => {
    const now = new Date();
    const startOfWindow = new Date(now);
    if (timeframe === 'weekly') {
      startOfWindow.setDate(now.getDate() - 7);
    } else {
      startOfWindow.setDate(now.getDate() - 30);
    }
    startOfWindow.setHours(0, 0, 0, 0);

    const format = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
    return { start: startOfWindow, end: now, label: `${format(startOfWindow)} - ${format(now)}` };
  };
  const { start, end, label } = getDates();

  const team = baseTeam.map(m => {
    // 1. Point Sync: Direct aggregation of completed tasks in timeframe
    const pointsInPeriod = tasks
      .filter(t => String(t.ownerId) === String(m.id) && t.status === 'completed')
      .filter(t => {
        const dateToUse = t.completedAt || t.lastCompletedDate;
        if (!dateToUse) return false;
        return new Date(dateToUse).getTime() >= start.getTime();
      })
      .reduce((sum, t) => sum + (t.points || 0), 0);
    
    // 2. Active Sync: Check if currently executing (matching the live feed status)
    const isExecuting = m.currentTask && m.currentTask !== 'Awaiting Task';
    
    return { ...m, monthPoints: pointsInPeriod, isExecuting };
  });

  const totalStaff = team.length;
  // A staff member is Active if they are CURRENTLY working on a task
  const activeStaff = team.filter(m => m.isExecuting).length;
  
  const stallingMembers = team.filter(m => !m.isExecuting);

  // —— ORG HEALTH FRAMEWORK ——
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const avgEfficiency = completedTasks.length > 0
    ? completedTasks.reduce((s, t) => s + (t.efficiencyScore || 0), 0) / completedTasks.length
    : 0;
  const totalPointsEarned = team.reduce((s, m) => s + m.monthPoints, 0);
  const volumeTarget = totalStaff * 500;
  const volumeComponent = volumeTarget > 0 ? Math.min(1.0, totalPointsEarned / volumeTarget) : 0;

  const orgHealthScore = Math.round((avgEfficiency * 100 * 0.6) + (volumeComponent * 100 * 0.4));
  const orgHealthLabel = orgHealthScore >= 85 ? 'Optimal' : orgHealthScore >= 70 ? 'Warning' : 'Crisis';
  const orgHealthBarColor = orgHealthScore >= 85 ? 'bg-emerald-500' : orgHealthScore >= 70 ? 'bg-amber-400' : 'bg-red-500';
  const orgHealthBadgeColor = orgHealthScore >= 85 ? 'text-emerald-600 bg-emerald-50' : orgHealthScore >= 70 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';

  const aiIsAlert = stallingMembers.length > 0 || orgHealthScore < 70 || flaggedTasks.length > 0;
  let aiSubject = 'Team Performing Optimally';
  let aiInsight = totalStaff === 0
    ? 'No staff members found. Add staff via Organization Settings to begin tracking productivity.'
    : `All ${totalStaff} staff members are actively executing tasks. Sustained velocity looks good.`;

  if (orgHealthScore < 70) {
    aiSubject = 'CRITICAL: Productivity Stalled';
    
    const deptPoints = team.reduce((acc, m) => {
      const dept = m.department || 'General';
      acc[dept] = (acc[dept] || 0) + m.monthPoints;
      return acc;
    }, {} as Record<string, number>);
    const lowestDept = Object.keys(deptPoints).length > 0 
      ? Object.entries(deptPoints).sort((a, b) => a[1] - b[1])[0][0] 
      : null;

    const tierEfficiencies = [1, 2, 3, 4, 5].map(tier => {
      const ts = completedTasks.filter(t => t.tierVal === tier);
      const avg = ts.length > 0 ? ts.reduce((s, t) => s + (t.efficiencyScore || 0), 0) / ts.length : null;
      return { tier, avg };
    }).filter(t => t.avg !== null);
    
    const lowestTier = tierEfficiencies.length > 0 
      ? tierEfficiencies.sort((a, b) => a.avg! - b.avg!)[0].tier 
      : null;

    aiInsight = `ORG Health is at ${orgHealthScore}%. `;
    if (lowestDept && lowestTier) {
      aiInsight += `The [${lowestDept}] department is showing low yield, and Tier ${lowestTier} tasks have the lowest average efficiency. Immediate investigation into Tier ${lowestTier} workflows within ${lowestDept} is recommended.`;
    } else {
      aiInsight += `This indicates a broad process bottleneck or logistics delay. Immediate investigation across all departments is recommended.`;
    }
  } else if (flaggedTasks.length > 0) {
    aiSubject = `${flaggedTasks.length} Efficiency Anomalies Detected`;
    const anomalyNames = [...new Set(flaggedTasks.slice(0, 3).map(t => t.staff_name))].join(', ');
    aiInsight = `Extremely low efficiency scores detected recently, notably affecting ${anomalyNames || 'multiple staff'}. Consider process friction or missing resources as the root cause.`;
  } else if (stallingMembers.length > 0) {
    aiSubject = `${stallingMembers.length} Staff Member${stallingMembers.length > 1 ? 's' : ''} Stalling`;
    aiInsight = `${stallingMembers.map(m => m.name).join(', ')} ${stallingMembers.length > 1 ? 'have' : 'has'} no active tasks. Recommend deploying starter tasks to maintain team velocity.`;
  }

  const timeAgo = (ts: string) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Filter data based on timeframe
  const timeframeLimit = timeframe === 'monthly' ? 30 : 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - timeframeLimit);

  const filteredActivityLog = activityLog.filter(a => new Date(a.timestamp) >= cutoff);
  const ledgerEntries = filteredActivityLog.filter(a => a.type === 'points_earned');
  const systemActivity = filteredActivityLog; // Unified feed will use this directly or filteredActivityLog

  return (
    <>
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 sm:mb-10 pt-4">
        <div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mb-2 text-primary opacity-80">Executive Oversight</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-headline tracking-tight text-on-surface">Command Center</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-1.5 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10">
          <button onClick={() => setTimeframe('weekly')} className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${timeframe === 'weekly' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container'}`}>Weekly</button>
          <button onClick={() => setTimeframe('monthly')} className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${timeframe === 'monthly' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container'}`}>Monthly</button>
          <div className="w-px h-6 bg-outline-variant/30 mx-1 hidden sm:block" />
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-2 w-full sm:w-auto text-center sm:text-left order-last sm:order-none mt-2 sm:mt-0">{label}</span>
          <div className="w-px h-6 bg-outline-variant/30 mx-1 hidden sm:block" />
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-white px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md hover:scale-[1.02] active:scale-95 transition-all mission-gradient shadow-primary/20 group">
            <span className="material-symbols-outlined text-[18px] group-hover:translate-y-0.5 transition-transform">download</span> Export
          </button>
        </div>
      </div>


      {/* KPI STRIP */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <OrgHealthCard 
          score={orgHealthScore}
          label={orgHealthLabel}
          barColor={orgHealthBarColor}
          badgeColor={orgHealthBadgeColor}
          avgEfficiency={avgEfficiency}
          volumeComponent={volumeComponent}
        />
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant/5 hover:border-primary/20 transition-all flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform"><span className="material-symbols-outlined fill-1">groups</span></div>
            <span className="flex items-center text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-lg">{team.length} Enrolled</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1 opacity-60">Human Capital</p>
            <h2 className="text-3xl font-extrabold font-headline text-on-surface">{activeStaff} <span className="text-sm font-bold text-on-surface-variant opacity-40 uppercase tracking-tighter ml-1">Active Now</span></h2>
          </div>
          <p className="text-[10px] font-black uppercase text-on-surface-variant mt-4 opacity-40">Utilization: {team.length > 0 ? Math.round((activeStaff/team.length)*100) : 0}%</p>
        </div>
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant/5 hover:border-primary/20 transition-all flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-secondary/10 text-secondary group-hover:scale-110 transition-transform"><span className="material-symbols-outlined fill-1">payments</span></div>
            <span className="flex items-center text-[10px] font-black uppercase tracking-wider text-secondary bg-secondary/10 px-2.5 py-1 rounded-lg">{ledgerEntries.length} Recent</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1 opacity-60">Economy Output</p>
            <h2 className="text-3xl font-extrabold font-headline text-on-surface">{team.reduce((s, m) => s + m.monthPoints, 0).toLocaleString()}<span className="text-sm font-bold text-on-surface-variant opacity-40 uppercase tracking-tighter ml-1"> pts</span></h2>
          </div>
          <p className="text-[10px] font-black uppercase text-on-surface-variant mt-4 opacity-40">Avg Velocity: {activeStaff > 0 ? Math.round(ledgerEntries.reduce((s, m) => s + (m.points || 0), 0)/activeStaff) : 0} pts/staff</p>
        </div>
        
        {/* TASK SENTINEL WIDGET */}
        <div className={`p-8 rounded-2xl shadow-sm border transition-all flex flex-col justify-between group ${tasks.some(t => t.isFlagged && t.status === 'running') ? 'bg-error/5 border-error/20 ring-1 ring-error/10' : 'bg-surface-container-lowest border-outline-variant/5'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${tasks.some(t => t.isFlagged && t.status === 'running') ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
              <span className="material-symbols-outlined fill-1">emergency_home</span>
            </div>
            <span className={`flex items-center text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${tasks.some(t => t.isFlagged && t.status === 'running') ? 'bg-error text-white animate-pulse' : 'bg-primary/10 text-primary'}`}>
              {tasks.filter(t => t.isFlagged && t.status === 'running').length} Violations
            </span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1 opacity-60">Task Sentinel</p>
            <h2 className="text-3xl font-extrabold font-headline text-on-surface">
              {tasks.filter(t => t.isFlagged === true && t.status === 'completed').length} <span className="text-sm font-bold text-on-surface-variant opacity-40 uppercase tracking-tighter ml-1">Managed</span>
            </h2>
          </div>
          <p className="text-[10px] font-black uppercase text-on-surface-variant mt-4 opacity-40">
            Auto-Complete: 4x Golden Rule
          </p>
        </div>
      </section>
      


      {/* MAIN OPERATIONAL GRID */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* LEFT COLUMN: LIVE OPERATIONS (2/3) */}
        <div className="lg:col-span-2 space-y-10">
          <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h3 className="text-xl font-bold font-headline text-on-surface flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Process Monitor
                </h3>
                <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant mt-1">Real-time Task Execution Feed</p>
              </div>

              <div className="flex bg-surface-container-low p-1 rounded-xl">
                <button 
                  onClick={() => setActiveTab('monitor')}
                  className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'monitor' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
                >
                  Activity
                </button>
                <button 
                  onClick={() => setActiveTab('audits')}
                  className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all relative ${activeTab === 'audits' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
                >
                  Audits
                  {flaggedTasks.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-error text-[8px] flex items-center justify-center rounded-full text-white ring-2 ring-white animate-bounce">{flaggedTasks.length}</span>}
                </button>
              </div>
            </div>
            
            <AISystemInsight isAlert={aiIsAlert} subject={aiSubject} insight={aiInsight} />

            <div className="mt-8 space-y-3">
              {activeTab === 'monitor' ? (
                team.length === 0 ? (
                  <div className="text-center py-20 rounded-3xl border-2 border-dashed border-outline-variant/20 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[48px] opacity-10 block mb-2">person_off</span>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-40">No active staff monitored</p>
                  </div>
                ) : (
                  team.map(member => {
                    const isIdle = !member.currentTask || member.currentTask === 'Awaiting Task';
                    const runningTask = tasks.find(t => String(t.ownerId) === String(member.id) && t.status === 'running');
                    const isFlagged = runningTask?.isFlagged;
                    const hasUnviewedTasks = tasks.some(t => String(t.ownerId) === String(member.id) && t.managerViewed === false);
                    const hasUnviewedLogs = activityLog.some(a => String(a.staffId) === String(member.id) && a.managerViewed === false);
                    const isUnread = hasUnviewedTasks || hasUnviewedLogs;

                    const getStartOfWeek = () => {
                      const now = new Date();
                      const day = now.getDay();
                      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                      const monday = new Date(now.setDate(diff));
                      monday.setHours(0, 0, 0, 0);
                      return monday;
                    };
                    const startOfWeek = getStartOfWeek();
                    const memberCompletedTasks = tasks.filter(t => t.ownerId === member.id && t.status === 'completed');
                    const weeklyPoints = memberCompletedTasks
                      .filter(t => t.completedAt && new Date(t.completedAt) >= startOfWeek)
                      .reduce((sum, t) => sum + (t.points || 0), 0);
                    const lifetimePoints = memberCompletedTasks.reduce((sum, t) => sum + (t.points || 0), 0);

                    return (
                      <button
                        type="button"
                        key={'task-' + member.id}
                        onClick={() => {
                          markViewed(member.id);
                          if (runningTask && runningTask.managerViewed === false) onMarkTaskViewed(runningTask.id);
                          setSelectedMember(member);
                        }}
                        className={`w-full text-left p-5 rounded-2xl border shadow-sm flex items-center justify-between transition-all cursor-pointer hover:shadow-lg hover:translate-x-1 ${
                          isFlagged ? 'bg-error/5 border-error/30' : 
                          isIdle ? 'bg-amber-50/30 border-amber-200/50' :
                          'bg-white border-outline-variant/10'
                        }`}
                      >
                        <div className="flex items-center gap-5">
                          <div className="relative">
                            <img className={`w-12 h-12 rounded-2xl object-cover ring-4 ${isFlagged ? 'ring-error/20' : (isIdle ? 'ring-amber-100/50' : 'ring-primary/10')}`} src={member.imgUrl} alt={member.name} />
                            {isUnread && (
                              <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-error border-4 border-white rounded-full">
                                <span className="sr-only">Unread notifications</span>
                              </span>
                            )}
                          </div>
                        <div className="flex-1 px-4">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-base text-on-surface leading-tight">{member.name}</p>
                              {isFlagged && <span className="material-symbols-outlined text-error text-[18px] animate-bounce">warning</span>}
                            </div>
                            <p className="text-sm font-black text-on-surface">{weeklyPoints.toLocaleString()} <span className="text-[10px] opacity-40 uppercase">Pts</span></p>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-outline-variant/10 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-1000 ${
                                  weeklyPoints >= (meritConfig?.weeklyThreshold || 1000) ? 'bg-emerald-500' : 'bg-primary/40'
                                }`} 
                                style={{ width: `${Math.min(100, (weeklyPoints / (meritConfig?.weeklyThreshold || 1000)) * 100)}%` }} 
                              />
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${
                              weeklyPoints >= (meritConfig?.weeklyThreshold || 1000) ? 'text-emerald-600' : 'text-on-surface-variant opacity-40'
                            }`}>
                              {Math.round((weeklyPoints / (meritConfig?.weeklyThreshold || 1000)) * 100)}%
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                             <div className="flex items-center gap-1.5">
                                <span className={`relative flex h-2 w-2`}>
                                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isFlagged ? 'bg-error' : (isIdle ? 'bg-amber-400' : 'bg-emerald-500')}`} />
                                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isFlagged ? 'bg-error' : (isIdle ? 'bg-amber-400' : 'bg-emerald-500')}`} />
                                </span>
                                <p className={`text-[10px] font-black tracking-tight ${isFlagged ? 'text-error' : (isIdle ? 'text-amber-600' : 'text-emerald-600')}`}>
                                  {isIdle ? 'STANDBY' : (member.currentTask?.toUpperCase() || 'IDLE')}
                                </p>
                             </div>
                             <span className="w-1 h-1 rounded-full bg-outline-variant/30" />
                             <span className="text-[9px] bg-primary/5 text-primary/60 px-1.5 py-0.5 rounded-lg uppercase font-black tracking-widest" title="Current Productivity Rate">{Math.round((member.efficiencyScore || 1) * 100)}% Rate</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-[9px] font-black tracking-tighter px-2.5 py-1.5 rounded-xl uppercase ${
                            isFlagged ? 'bg-error text-white' : 
                            isIdle ? 'bg-amber-100 text-amber-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isFlagged ? 'INTERVENTION' : (isIdle ? 'IDLE' : 'ACTIVE')}
                          </span>
                          {runningTask?.elapsedSec && (
                            <p className="text-[10px] font-bold text-on-surface-variant mt-2 opacity-40">
                              T+ {Math.floor(runningTask.elapsedSec / 60)}m {runningTask.elapsedSec % 60}s
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                    );
                  })
                )
              ) : (
                <div className="space-y-4">
                  {flaggedTasks.length === 0 ? (
                    <div className="text-center py-20 rounded-3xl border-2 border-dashed border-outline-variant/20 text-on-surface-variant">
                       <span className="material-symbols-outlined text-[48px] opacity-10 block mb-2">check_circle</span>
                       <p className="text-xs font-bold uppercase tracking-widest opacity-40">Zero Efficiency Anomalies</p>
                    </div>
                  ) : (
                    flaggedTasks.map(task => (
                      <div key={'audit-' + task.id} className="p-5 rounded-2xl bg-error/5 border border-error/20 flex items-center justify-between group hover:bg-error/10 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-error/10 text-error flex items-center justify-center">
                            <span className="material-symbols-outlined">analytics</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-on-surface">{task.title}</h4>
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Staff: {task.staff_name || 'Unassigned'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <EfficiencyBadge score={task.efficiency_score} isFlagged={true} />
                            <p className="text-[9px] font-black text-error uppercase mt-1">Score: {Math.round(task.efficiency_score * 100)}%</p>
                          </div>
                          <button 
                            onClick={() => onResolveFlag?.(task.id)}
                            className="bg-error text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md shadow-error/20"
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* UNIFIED SYSTEM ACTIVITY FEED */}
          <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant/10 group">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary p-2 bg-primary/5 rounded-xl group-hover:rotate-12 transition-transform">analytics</span>
                <h3 className="text-lg font-bold font-headline text-on-surface">System Activity</h3>
              </div>
              <span className="text-[10px] font-black text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-lg uppercase tracking-wider">Live Feed</span>
            </div>
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 thin-scrollbar">
              {filteredActivityLog.slice(0, 15).map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-4 rounded-2xl border border-outline-variant/5 bg-surface-container-low/30 hover:bg-surface-container-low transition-all group/item">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover/item:scale-110 ${
                      entry.type === 'points_earned' ? 'bg-primary/10 text-primary' : 
                      entry.type === 'task_started' ? 'bg-amber-500/10 text-amber-600' :
                      'bg-slate-500/10 text-slate-600'
                    }`}>
                      <span className="material-symbols-outlined text-[20px]">
                        {entry.type === 'points_earned' ? 'add_circle' : 
                         entry.type === 'task_started' ? 'play_circle' :
                         'info'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-on-surface">{entry.staffName || 'System'}</p>
                        <span className="text-[9px] font-black text-on-surface-variant opacity-40 uppercase tracking-widest">{timeAgo(entry.timestamp)}</span>
                      </div>
                      <p className="text-xs font-medium text-on-surface-variant line-clamp-1">{entry.desc}</p>
                    </div>
                  </div>
                  
                  {entry.type === 'points_earned' && (
                    <div className="text-right">
                      <p className="text-sm font-black text-primary">+{entry.points}</p>
                      <p className="text-[8px] font-black uppercase tracking-tighter opacity-40 text-primary">Points</p>
                    </div>
                  )}
                  


                  {entry.type === 'task_started' && (
                    <div className="bg-amber-500/10 text-amber-600 px-3 py-1 rounded-lg">
                      <p className="text-[10px] font-black uppercase tracking-widest">Active</p>
                    </div>
                  )}
                </div>
              ))}
              {activityLog.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                  <span className="material-symbols-outlined text-[48px]">pending_actions</span>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] mt-4">No Recent Activity</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ANALYTICS HUB (1/3) */}
        <div className="space-y-10">
          <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant/10">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-bold font-headline text-on-surface">Yield Distribution</h3>
              <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-lg">
                <span className="text-[9px] font-black uppercase text-on-surface-variant px-2 opacity-60">Limit</span>
                <input 
                  type="number" 
                  className="w-14 border-none rounded p-1 text-[10px] font-black bg-white text-primary text-center focus:ring-0" 
                  value={minPointThreshold} 
                  onChange={(e) => setMinPointThreshold(Number(e.target.value) || 0)} 
                />
              </div>
            </div>
            <div className="h-[200px] w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={team.map(m => ({ name: m.name.split(' ')[0], points: m.monthPoints }))} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 'bold', fill: 'currentColor', opacity: 0.4 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fontWeight: 'bold', fill: 'currentColor', opacity: 0.4 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(var(--primary-rgb), 0.05)' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', fontSize: '10px', fontWeight: 'bold', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <ReferenceLine y={minPointThreshold} stroke="#e11d48" strokeDasharray="3 3" label={{ position: 'right', value: 'Min', fill: '#e11d48', fontSize: 8, fontWeight: 'bold' }} />
                  <Bar dataKey="points" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <SkillGapVisualizer tasks={completedTasks} />

        </div>
      </section>
    </div>

    {/* ── STAFF RUNNING TASK DRAWER ── */}
    {selectedMember && (
      <>
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[110] animate-in fade-in duration-200"
          onClick={() => { setSelectedMember(null); setDrawerTab('tasks'); setHasEvaluated(false); }}
        />
        <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-surface shadow-2xl z-[120] flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-outline-variant/10 bg-surface-container-lowest">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img src={selectedMember.imgUrl} className="w-14 h-14 rounded-2xl object-cover ring-4 ring-primary/10" alt={selectedMember.name} />
                  <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${tasks.some(t => t.ownerId === selectedMember.id && t.status === 'running') ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-on-surface font-headline">{selectedMember.name}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">{selectedMember.role || selectedMember.department || 'Staff'}</p>
                </div>
              </div>
              <button onClick={() => { setSelectedMember(null); setDrawerTab('tasks'); setHasEvaluated(false); }} className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="flex bg-surface-container-low p-1 rounded-xl w-full mb-2">
              <button 
                onClick={() => setDrawerTab('tasks')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${drawerTab === 'tasks' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
              >
                Active Tasks
              </button>
              <button 
                onClick={() => setDrawerTab('evaluation')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${drawerTab === 'evaluation' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
              >
                1-Week Evaluation
              </button>
            </div>

            {drawerTab === 'tasks' && (
              <div className="flex items-center gap-2 px-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  {tasks.filter(t => t.ownerId === selectedMember.id && t.status === 'running').length} Task(s) Currently Running
                </p>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {drawerTab === 'tasks' ? (
              tasks.filter(t => t.ownerId === selectedMember.id && t.status === 'running').length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant opacity-30">
                  <span className="material-symbols-outlined text-[48px] mb-3">hourglass_empty</span>
                  <p className="text-xs font-black uppercase tracking-widest">No Running Tasks</p>
                  <p className="text-[10px] mt-1 font-semibold">This staff member is on standby</p>
                </div>
              ) : (
                tasks
                  .filter(t => t.ownerId === selectedMember.id && t.status === 'running')
                  .map(task => {
                    const workflowTotal     = task.workflow?.length || 0;
                    const workflowCompleted = task.workflow?.filter(s => s.isCompleted).length || 0;
                    const workflowPct       = workflowTotal > 0 ? Math.round((workflowCompleted / workflowTotal) * 100) : 0;
                    const isFlagged         = task.isFlagged || task.sentinelReminder;
                    const elapsedMin        = Math.floor((task.elapsedSec || 0) / 60);
                    const elapsedSec        = (task.elapsedSec || 0) % 60;
                    const estMin            = Math.floor((task.totalSec || 0) / 60);
                    const tierColors: Record<number, string> = { 1: 'bg-slate-100 text-slate-600', 2: 'bg-blue-100 text-blue-700', 3: 'bg-amber-100 text-amber-700', 4: 'bg-orange-100 text-orange-700', 5: 'bg-rose-100 text-rose-700' };

                    return (
                      <div key={task.id} className={`p-5 rounded-2xl border ${isFlagged ? 'bg-error/5 border-error/20 ring-1 ring-error/20' : 'bg-emerald-500/5 border-emerald-200/50'} transition-all`}>
                        {/* Task Title & Tier */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <h4 className="font-black text-sm text-on-surface leading-snug flex-1">{task.title}</h4>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${tierColors[task.tierVal] || 'bg-surface-container text-on-surface-variant'}`}>
                              {task.tierName}
                            </span>
                            {onPauseTask && (
                              <button 
                                onClick={() => onPauseTask(task.id)}
                                className="bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest shadow-sm transition-all"
                                title="Force pause this task"
                              >
                                Force Pause
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Stats: Points / Elapsed / Est. */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="bg-white/70 rounded-xl p-2.5 text-center">
                            <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-0.5">Points</p>
                            <p className="text-base font-black text-primary">{task.points}</p>
                          </div>
                          <div className="bg-white/70 rounded-xl p-2.5 text-center">
                            <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-0.5">Elapsed</p>
                            <p className="text-sm font-black text-on-surface">{elapsedMin}m {elapsedSec}s</p>
                          </div>
                          <div className="bg-white/70 rounded-xl p-2.5 text-center">
                            <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-0.5">Est.</p>
                            <p className="text-sm font-black text-on-surface">{estMin > 0 ? `${estMin}m` : '—'}</p>
                          </div>
                        </div>

                        {/* Workflow progress */}
                        {workflowTotal > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Workflow</p>
                              <span className="text-[9px] font-black text-primary">{workflowCompleted}/{workflowTotal} steps</span>
                            </div>
                            <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-3">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${workflowPct}%` }} />
                            </div>
                            <div className="space-y-1.5">
                              {task.workflow!.map(step => (
                                <div key={step.id} className={`flex items-center gap-2 ${step.isCompleted ? 'opacity-40' : ''}`}>
                                  <span className={`material-symbols-outlined text-[14px] shrink-0 ${step.isCompleted ? 'text-emerald-500' : 'text-outline-variant'}`} style={step.isCompleted ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                                    {step.isCompleted ? 'check_circle' : 'radio_button_unchecked'}
                                  </span>
                                  <p className={`text-[10px] font-semibold ${step.isCompleted ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>{step.name}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {isFlagged && (
                          <div className="mt-3 flex items-center gap-2 text-error">
                            <span className="material-symbols-outlined text-[16px] animate-bounce">warning</span>
                            <p className="text-[10px] font-black uppercase tracking-widest">Efficiency Alert — Intervention Recommended</p>
                          </div>
                        )}
                      </div>
                    );
                  })
              )
            ) : (() => {
              const now = new Date();
              const yesterday = new Date(now);
              yesterday.setDate(yesterday.getDate() - 1);
              yesterday.setHours(23, 59, 59, 999);

              const sevenDaysAgo = new Date(now);
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
              sevenDaysAgo.setHours(0, 0, 0, 0);
              
              const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
              const evalPeriodLabel = `${formatDate(sevenDaysAgo)} - ${formatDate(yesterday)}`;

              const evalTasks = tasks.filter(t => {
                if (t.ownerId !== selectedMember.id) return false;
                const dateToCheck = new Date(t.lastCompletedDate || t.commencementDate || 0).getTime();
                return dateToCheck >= sevenDaysAgo.getTime() && dateToCheck <= yesterday.getTime();
              });
              
              const completedEvalTasks = evalTasks.filter(t => t.status === 'completed');
              const totalPoints = completedEvalTasks.reduce((sum, t) => sum + (t.points || 0), 0);
              
              const targetPoints = 400; // Expected minimum
              const volumeEfficiency = Math.round((totalPoints / targetPoints) * 100);
              
              const avgEfficiencyScore = completedEvalTasks.length > 0 
                ? Math.round((completedEvalTasks.reduce((s, t) => s + (t.efficiencyScore || 0), 0) / completedEvalTasks.length) * 100) 
                : 0;

              return (
              <div className="space-y-6">
                <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20 text-center">
                  <span className="material-symbols-outlined text-[48px] text-primary mb-4 block">query_stats</span>
                  <h4 className="text-lg font-black text-on-surface mb-2 font-headline">1-Week Performance Report</h4>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest bg-white/50 px-3 py-1 rounded-full inline-block mb-4 shadow-sm">
                    {evalPeriodLabel}
                  </p>
                  <p className="text-xs text-on-surface-variant mb-6 font-medium px-4">Execute an AI-driven quantitative evaluation of {selectedMember.name}'s performance over the last 7 days.</p>
                  
                  <button 
                    onClick={() => {
                      setIsEvaluating(true);
                      setTimeout(() => {
                        setIsEvaluating(false);
                        setHasEvaluated(true);
                      }, 2000);
                    }}
                    disabled={isEvaluating}
                    className="bg-primary text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-95 transition-all w-full disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                  >
                    {isEvaluating ? (
                      <><span className="material-symbols-outlined animate-spin text-[18px]">sync</span> Analyzing Data...</>
                    ) : (
                      <><span className="material-symbols-outlined text-[18px]">play_arrow</span> Execute Evaluation</>
                    )}
                  </button>
                </div>
                
                {hasEvaluated && !isEvaluating && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/10">
                       <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4">Summary Findings</p>
                       <div className="space-y-4">
                         <div className="flex justify-between items-end border-b border-outline-variant/10 pb-3">
                           <div>
                             <p className={`text-2xl font-black ${totalPoints >= targetPoints ? 'text-emerald-500' : 'text-error'}`}>{totalPoints}</p>
                             <p className="text-[9px] uppercase font-bold text-on-surface-variant">Points Earned</p>
                             <p className="text-[8px] font-semibold text-on-surface-variant opacity-60 mt-1">Target: {targetPoints}</p>
                           </div>
                           <div className="text-center">
                             <p className="text-2xl font-black text-on-surface">{completedEvalTasks.length}</p>
                             <p className="text-[9px] uppercase font-bold text-on-surface-variant">Tasks Completed</p>
                           </div>
                           <div className="text-right">
                             <p className={`text-2xl font-black ${volumeEfficiency >= 100 ? 'text-emerald-500' : 'text-error'}`}>{volumeEfficiency}%</p>
                             <p className="text-[9px] uppercase font-bold text-on-surface-variant">Efficiency Rate</p>
                           </div>
                         </div>
                         <div className="flex justify-between items-end border-b border-outline-variant/10 pb-3">
                            <p className="text-xs font-black uppercase text-on-surface">Avg Task Efficiency (vs Golden Rule)</p>
                            <p className={`text-sm font-black ${avgEfficiencyScore >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{avgEfficiencyScore}%</p>
                         </div>
                         <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
                           <strong className="text-on-surface">Insight:</strong> {selectedMember.name} 
                           {volumeEfficiency >= 100 
                             ? ' has exceeded the expected minimum yield for the week. '
                             : ` has fallen short of the expected minimum yield (${targetPoints} points). `}
                           {avgEfficiencyScore >= 80 
                             ? 'Task execution efficiency aligns well with established Golden Rules.'
                             : 'However, task execution showed lower efficiency against established Golden Rules, suggesting possible process friction.'}
                           {(() => {
                             const overtimeCount = evalTasks.filter(t => (t.totalSec > 0 && t.elapsedSec > t.totalSec) || t.elapsedSec > 14400).length;
                             if (overtimeCount > 0) {
                               return ` Additionally, ${overtimeCount} task(s) exceeded their estimated timeframe or recorded abnormally high duration. Please review these anomalies with the staff member.`;
                             }
                             return '';
                           })()}
                         </p>
                       </div>
                    </div>

                    <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4">Task Breakdown ({evalPeriodLabel})</p>
                      
                      {evalTasks.length > 0 ? (
                        <div className="space-y-3">
                          {evalTasks.map(t => {
                            const efficiency = Math.round((t.efficiencyScore || 0) * 100);
                            const isDone = t.status === 'completed';
                            const isOvertime = (t.totalSec > 0 && t.elapsedSec > t.totalSec) || t.elapsedSec > 14400;
                            const dateStr = t.lastCompletedDate 
                              ? new Date(t.lastCompletedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                              : t.commencementDate 
                                ? new Date(t.commencementDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                : 'Unknown Date';

                            return (
                              <div key={t.id} className={`flex items-center justify-between p-3 rounded-xl ${isOvertime ? 'bg-error/10 border border-error/20' : 'bg-surface-container-low/50'}`}>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-on-surface">{t.title}</p>
                                    {isOvertime && <span className="text-[8px] bg-error text-white px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Time Overrun</span>}
                                  </div>
                                  <p className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest mt-1 opacity-60">
                                    {dateStr} • {t.tierName} • Est: {Math.floor(t.totalSec / 60)}m / Used: {Math.floor(t.elapsedSec / 60)}m
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  {isDone ? (
                                    <>
                                      <p className="text-sm font-black text-primary">+{t.points}</p>
                                      <p className={`text-[9px] font-black uppercase ${efficiency >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                        {efficiency}% EFF
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-sm font-black text-on-surface-variant opacity-60">{t.status.toUpperCase()}</p>
                                      <p className="text-[9px] font-black uppercase text-on-surface-variant opacity-40">
                                        Pending
                                      </p>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-on-surface-variant opacity-50">
                          <span className="material-symbols-outlined text-[32px] mb-2 block">history</span>
                          <p className="text-[10px] font-black uppercase tracking-widest">No tasks recorded</p>
                          <p className="text-[9px] font-medium mt-1">in this 7-day period</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              );
            })()}
          </div>
        </div>
      </>
    )}
    </>
  );
}
