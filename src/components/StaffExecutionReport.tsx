"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Task, TeamMember } from '@/lib/types';

interface StaffExecutionReportProps {
  team: TeamMember[];
}

export default function StaffExecutionReport({ team }: StaffExecutionReportProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [timeframeMode, setTimeframeMode] = useState<'weekly' | 'monthly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Initialize current month on mount
  useEffect(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${yyyy}-${mm}`);
  }, []);

  useEffect(() => {
    if (selectedStaffId && selectedMonth) {
      fetchTasks();
    } else {
      setTasks([]);
    }
  }, [selectedStaffId, timeframeMode, selectedMonth]);

  const fetchTasks = async () => {
    setLoading(true);

    let startDate: Date;
    let endDate: Date;
    const now = new Date();

    if (timeframeMode === 'weekly') {
      endDate = now;
      startDate = new Date();
      startDate.setDate(now.getDate() - 7);
    } else {
      // Monthly
      const [year, month] = selectedMonth.split('-');
      startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('staff_id', selectedStaffId)
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString());

    if (!error && data) {
      // Sort from Low to High Impact
      const impactOrder: Record<string, number> = { 'Low': 1, 'Medium': 2, 'High': 3 };
      
      const sortedData = (data as Task[]).sort((a, b) => {
        const orderA = impactOrder[a.impact || ''] || 4;
        const orderB = impactOrder[b.impact || ''] || 4;
        return orderA - orderB;
      });
      setTasks(sortedData);
    } else {
      setTasks([]);
    }

    setLoading(false);
  };

  const getImpactColor = (impact?: string) => {
    if (impact === 'Low') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    if (impact === 'Medium') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    if (impact === 'High') return 'bg-error/10 text-error border-error/20';
    return 'bg-surface-container-high text-on-surface-variant border-outline-variant/20';
  };

  return (
    <div className="pt-10 px-6 max-w-6xl mx-auto pb-32 animate-in fade-in duration-300">
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2 text-primary">Performance Analytics</p>
        <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">Staff Execution Report</h2>
        <p className="text-on-surface-variant mt-2 text-lg">View completed tasks sorted from low to high impact.</p>
      </div>

      <div className="bg-surface-container rounded-3xl p-6 lg:p-8 shadow-lg border border-outline-variant/10 mb-8 flex flex-col md:flex-row gap-6 items-end">
        
        {/* Staff Selector */}
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Select Staff</label>
          <select 
            className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold text-on-surface outline-none focus:border-primary transition-colors appearance-none"
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
          >
            <option value="" disabled>-- Choose a staff member --</option>
            {team.map(staff => (
              <option key={staff.id} value={staff.id}>{staff.name}</option>
            ))}
          </select>
        </div>

        {/* Timeframe Toggle */}
        <div className="w-full md:w-auto">
          <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Timeframe Mode</label>
          <div className="flex bg-surface border border-outline-variant/20 rounded-xl p-1">
            <button 
              onClick={() => setTimeframeMode('monthly')}
              className={`flex-1 px-6 py-2 rounded-lg text-sm font-bold transition-all ${timeframeMode === 'monthly' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setTimeframeMode('weekly')}
              className={`flex-1 px-6 py-2 rounded-lg text-sm font-bold transition-all ${timeframeMode === 'weekly' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              Weekly
            </button>
          </div>
        </div>

        {/* Month Picker (Only show if Monthly) */}
        {timeframeMode === 'monthly' && (
          <div className="w-full md:w-auto animate-in slide-in-from-left-4 fade-in duration-300">
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Select Month</label>
            <input 
              type="month"
              className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-bold text-on-surface outline-none focus:border-primary transition-colors"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-surface-container rounded-3xl overflow-hidden border border-outline-variant/10 shadow-lg">
        {!selectedStaffId ? (
          <div className="p-16 text-center text-on-surface-variant/60 flex flex-col items-center">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-50">person_search</span>
            <p className="font-bold uppercase tracking-widest text-sm">Select a staff member to view their report</p>
          </div>
        ) : loading ? (
          <div className="p-16 text-center text-primary flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl mb-4 animate-spin">sync</span>
            <p className="font-bold uppercase tracking-widest text-sm animate-pulse">Loading execution data...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-16 text-center text-on-surface-variant/60 flex flex-col items-center">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-50">inbox</span>
            <p className="font-bold uppercase tracking-widest text-sm">No tasks completed in this timeframe</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-container-high border-b border-outline-variant/10">
                <tr className="text-xs uppercase tracking-widest text-on-surface-variant">
                  <th className="p-5 font-bold">Task Date</th>
                  <th className="p-5 font-bold">Title</th>
                  <th className="p-5 font-bold text-center">Impact</th>
                  <th className="p-5 font-bold text-center">Complexity</th>
                  <th className="p-5 font-bold text-right">Time Used</th>
                  <th className="p-5 font-bold text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {tasks.map(task => (
                  <tr key={task.id} className="hover:bg-surface/50 transition-colors group">
                    <td className="p-5 text-on-surface-variant">
                      {new Date((task as any).completed_at || task.completedAt || '').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-5 font-bold text-on-surface max-w-xs truncate" title={task.title}>
                      {task.title}
                    </td>
                    <td className="p-5 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getImpactColor(task.impact)}`}>
                        {task.impact || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-5 text-center text-on-surface-variant font-bold text-xs uppercase">
                      {task.complexity || '-'}
                    </td>
                    <td className="p-5 text-right font-mono text-on-surface-variant">
                      {task.actualDurationMinutes} min
                    </td>
                    <td className="p-5 text-right font-bold text-primary">
                      +{task.points} pt
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
