"use client";

import React from 'react';
import type { Task } from '@/lib/types';

interface SkillGapVisualizerProps {
  tasks: Task[];
}

export default function SkillGapVisualizer({ tasks }: SkillGapVisualizerProps) {
  const totalTasks = tasks.length;
  
  return (
    <div className="mb-6 p-6 rounded-[2rem] bg-surface-container-lowest border border-outline-variant/10 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-bold font-headline text-on-surface">Task Complexity Distribution</h3>
        <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant mt-1">VOLUME DISTRIBUTION ACROSS TIERS (COMPLETED TASKS)</p>
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(tier => {
          const tierTasks = tasks.filter(t => {
            const match = t.tierName?.match(/Tier\s*(\d)/i);
            const tierNum = match ? parseInt(match[1]) : (t.tierVal || 1);
            return tierNum === tier;
          });
          const volumePercent = totalTasks > 0 ? Math.round((tierTasks.length / totalTasks) * 100) : 0;
          
          const completedTierTasks = tierTasks.filter(t => t.status === 'completed');
          const avgEfficiency = completedTierTasks.length > 0
            ? completedTierTasks.reduce((s, t) => s + (t.efficiencyScore || 0), 0) / completedTierTasks.length
            : 0;
          const effPercent = Math.round(avgEfficiency * 100);
          
          const tierLabel = tier === 1 ? 'Routine' : tier === 2 ? 'Standard' : tier === 3 ? 'Complex' : tier === 4 ? 'Critical' : 'Extraordinary';
          
          const barColorClass = effPercent >= 85 ? 'bg-emerald-500' : effPercent >= 60 ? 'bg-amber-400' : (completedTierTasks.length > 0 ? 'bg-red-400' : 'bg-primary/40');

          return (
            <div key={tier} className="flex items-center gap-4">
              <div className="w-24 shrink-0">
                <p className="text-[10px] font-black uppercase text-on-surface-variant">{tierLabel}</p>
                <p className="text-[9px] font-bold text-on-surface-variant/40">Tier {tier}</p>
              </div>
              <div className="flex-1 h-3 bg-outline-variant/10 rounded-full overflow-hidden flex">
                <div 
                  className={`h-full transition-all duration-1000 ${tierTasks.length > 0 ? barColorClass : 'bg-outline-variant/20'}`} 
                  style={{ width: `${volumePercent}%` }} 
                />
              </div>
              <div className="w-12 text-right">
                <p className="text-sm font-black text-on-surface">{volumePercent}%</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/5">
        <p className="text-[10px] text-on-surface-variant italic opacity-80 leading-relaxed">
          <strong className="text-on-surface not-italic">Manager Insight:</strong> The heatmap above visualizes current operational complexity. 
          {totalTasks > 0 && tasks.filter(t => t.tierVal >= 3).length === 0 ? " Your team is currently focused exclusively on Routine/Standard operations." : " Higher Tier volume indicates complex mission-critical execution."}
        </p>
      </div>
    </div>
  );
}
