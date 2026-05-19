"use client";

import React from 'react';

interface OrgHealthCardProps {
  score: number;
  label: string;
  barColor: string;
  badgeColor: string;
  avgEfficiency: number;
  volumeComponent: number;
}

export default function OrgHealthCard({
  score,
  label,
  barColor,
  badgeColor,
  avgEfficiency,
  volumeComponent
}: OrgHealthCardProps) {
  return (
    <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant/5 hover:border-primary/20 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 rounded-xl bg-tertiary-fixed/30 text-tertiary">
          <span className="material-symbols-outlined fill-1">favorite</span>
        </div>
        <span className={`flex items-center text-xs font-bold px-2 py-1 rounded-lg ${badgeColor}`}>
          <span className="material-symbols-outlined text-[14px] mr-1">
            {score >= 85 ? 'verified' : score >= 70 ? 'warning' : 'dangerous'}
          </span>
          {label}
        </span>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">ORG Health Score</p>
      <h2 className="text-3xl font-extrabold font-headline text-on-surface">
        {score}<span className="text-lg text-on-surface-variant">/100</span>
      </h2>
      <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
        <div className={`h-2 rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-[10px] text-on-surface-variant mt-2 opacity-70">
        Efficiency: {Math.round(avgEfficiency * 100)}% · Volume: {Math.round(volumeComponent * 100)}%
      </p>
    </div>
  );
}
