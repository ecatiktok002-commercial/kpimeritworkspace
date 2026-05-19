"use client";

import React from 'react';

interface AISystemInsightProps {
  isAlert: boolean;
  subject: string;
  insight: string;
}

export default function AISystemInsight({ isAlert, subject, insight }: AISystemInsightProps) {
  return (
    <div className={`mb-6 p-5 rounded-2xl border relative overflow-hidden ${isAlert ? 'border-error/20 bg-error/5' : 'border-primary/20 bg-primary/5'}`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 ${isAlert ? 'bg-error/10' : 'bg-primary/10'}`} />
      <div className="flex flex-col sm:flex-row items-start gap-4 relative z-10">
        <div className={`w-10 h-10 shrink-0 rounded-full text-white flex items-center justify-center shadow-md ${isAlert ? 'bg-error' : 'bg-primary'}`}>
          <span className="material-symbols-outlined fill-1 text-[20px]">smart_toy</span>
        </div>
        <div className="flex-1 w-full">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isAlert ? 'text-error' : 'text-primary'}`}>System AI Assistant</span>
            <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full animate-pulse ${isAlert ? 'bg-error/20 text-error' : 'bg-primary/20 text-primary'}`}>Live Analysis</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{subject}</p>
          <p className="text-sm text-on-surface font-medium leading-relaxed">{insight}</p>
          {isAlert && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-widest bg-error text-white px-4 py-2.5 rounded-lg shadow-sm hover:scale-[1.02] active:scale-95 transition-all">Review Actions</button>
              <button className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-widest bg-transparent border border-outline-variant/20 text-on-surface-variant px-4 py-2.5 rounded-lg hover:bg-surface-container-high transition-all">Dismiss</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
