"use client";

import React, { useState, useEffect } from 'react';
import type { TaskFrequency } from '@/lib/types';

interface StaffOption {
  id: string;
  name: string;
}

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** List of other org staff the current user can invite as collaborators */
  staffList?: StaffOption[];
  onSubmit: (
    title: string,
    note: string,
    mins: number,
    status: 'queued' | 'running',
    commencementDate: string,
    collaborators: string[],
    workflow: { id: string; name: string; isCompleted: boolean }[],
    collaboratorIds: string[],
    frequency: TaskFrequency,
    isContinuous: boolean
  ) => void;
}

const WEEK_DAYS = [
  { label: 'S', full: 'Sun', value: 0 },
  { label: 'M', full: 'Mon', value: 1 },
  { label: 'T', full: 'Tue', value: 2 },
  { label: 'W', full: 'Wed', value: 3 },
  { label: 'T', full: 'Thu', value: 4 },
  { label: 'F', full: 'Fri', value: 5 },
  { label: 'S', full: 'Sat', value: 6 },
];

export default function AddTaskModal({ isOpen, onClose, onSubmit, staffList = [] }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [mins, setMins] = useState(120);
  const [status, setStatus] = useState<'queued' | 'running'>('queued');
  const [selectedCollaborators, setSelectedCollaborators] = useState<StaffOption[]>([]);
  const [workflow, setWorkflow] = useState<{id: string; name: string; isCompleted: boolean}[]>([]);
  const [newWorkflowStep, setNewWorkflowStep] = useState('');

  // Frequency state
  const [freqType, setFreqType] = useState<'once' | 'daily' | 'weekly'>('once');
  const [freqDays, setFreqDays] = useState<number[]>([]);
  const [isContinuous, setIsContinuous] = useState(false);

  // Timezone Helper (GMT+8 Kuala Lumpur)
  const getKLTime = () => {
    const now = new Date();
    const klString = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);
    const [date, time] = klString.split(', ');
    return `${date}T${time}`;
  };

  const [commencementDate, setCommencementDate] = useState(getKLTime());

  // Auto-sync time if "Start Now" is selected
  useEffect(() => {
    if (status === 'running') {
      setCommencementDate(getKLTime());
    }
  }, [status, isOpen]);

  if (!isOpen) return null;

  const handleAddStep = () => {
    if (!newWorkflowStep.trim()) return;
    setWorkflow(prev => [...prev, { id: 'wf-' + Date.now(), name: newWorkflowStep.trim(), isCompleted: false }]);
    setNewWorkflowStep('');
  };

  const handleRemoveStep = (id: string) => {
    setWorkflow(prev => prev.filter(w => w.id !== id));
  };

  const toggleDay = (day: number) => {
    setFreqDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = () => {
    if (!title || mins <= 0) {
      alert('Valid Mission Title and Time required.');
      return;
    }
    if (freqType === 'weekly' && freqDays.length === 0) {
      alert('Please select at least one day for weekly recurrence.');
      return;
    }
    const collabNames = selectedCollaborators.map(c => c.name);
    const collabIds = selectedCollaborators.map(c => c.id);
    const frequency: TaskFrequency = {
      type: freqType,
      days: freqType === 'weekly' ? [...freqDays].sort() : undefined,
    };
    onSubmit(title, '', isContinuous ? 0 : mins, status, status === 'running' ? getKLTime() : commencementDate, collabNames, workflow, collabIds, frequency, isContinuous);
    // Reset
    setTitle('');
    setMins(120);
    setStatus('queued');
    setCommencementDate(getKLTime());
    setSelectedCollaborators([]);
    setWorkflow([]);
    setNewWorkflowStep('');
    setFreqType('once');
    setFreqDays([]);
    setIsContinuous(false);
  };

  const toggleCollaborator = (staff: StaffOption) => {
    setSelectedCollaborators(prev =>
      prev.find(c => c.id === staff.id)
        ? prev.filter(c => c.id !== staff.id)
        : [...prev, staff]
    );
  };

  const freqLabel = freqType === 'once'
    ? 'One-Time'
    : freqType === 'daily'
    ? 'Every Day'
    : freqDays.length === 0
    ? 'Weekly — pick days'
    : `Weekly · ${freqDays.sort().map(d => WEEK_DAYS[d].full).join(', ')}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-surface-container-lowest rounded-[32px] shadow-2xl w-full max-w-md border border-outline-variant/10 relative animate-in zoom-in-95 duration-300 flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 48px)' }}
      >
        {/* Fixed Header */}
        <div className="flex justify-between items-start px-8 pt-8 pb-4 shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Task Orchestration</p>
            <h3 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">Queue New Task</h3>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-error/10 hover:text-error transition-all active:scale-90 text-on-surface-variant shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-8 pb-2 space-y-5 custom-scrollbar">

          {/* Mission Title */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">
              Mission Title <span className="text-error">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
              placeholder="E.g., Production Environment Audit"
            />
          </div>

          {/* Duration + Execution Pipeline — 2 cols */}
          <div className="grid grid-cols-2 gap-4">
            <div className={isContinuous ? 'opacity-50 pointer-events-none' : ''}>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">
                Duration (Mins) <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={isContinuous ? 0 : mins}
                  onChange={e => setMins(parseInt(e.target.value) || 0)}
                  disabled={isContinuous}
                  className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner pl-10"
                />
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary opacity-50 text-[18px]">schedule</span>
              </div>
              {isContinuous && <p className="text-[9px] text-secondary font-bold mt-1.5 uppercase tracking-widest px-1">Continuous Mode Enabled</p>}
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Execution Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsContinuous(false)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-all ${
                    !isContinuous
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-surface-container text-on-surface-variant border-outline-variant/10 hover:border-primary/20'
                  }`}
                >
                  Timed
                </button>
                <button
                  type="button"
                  onClick={() => setIsContinuous(true)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-all ${
                    isContinuous
                      ? 'bg-secondary text-white border-secondary shadow-sm'
                      : 'bg-surface-container text-on-surface-variant border-outline-variant/10 hover:border-secondary/20'
                  }`}
                >
                  Cont.
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Pipeline State</label>
              <div className="relative">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as 'queued' | 'running')}
                  className="w-full bg-surface-container rounded-2xl py-4 px-4 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all cursor-pointer shadow-inner appearance-none pr-8 text-sm"
                >
                  <option value="queued">Queue</option>
                  <option value="running">Start Now</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[16px]">unfold_more</span>
              </div>
            </div>
            <div className={status === 'running' ? 'opacity-50 pointer-events-none' : ''}>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">
                Commencement Time
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={commencementDate}
                  onChange={e => setCommencementDate(e.target.value)}
                  className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner pl-12 text-xs"
                />
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary opacity-50">calendar_month</span>
              </div>
            </div>
          </div>

          {/* ── Frequency ── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">
              Task Frequency
            </label>
            {/* Toggle pills */}
            <div className="flex gap-2 mb-3">
              {(['once', 'daily', 'weekly'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setFreqType(type); if (type !== 'weekly') setFreqDays([]); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-all ${
                    freqType === type
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                      : 'bg-surface-container text-on-surface-variant border-outline-variant/10 hover:border-primary/20 hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {type === 'once' ? 'looks_one' : type === 'daily' ? 'autorenew' : 'calendar_view_week'}
                  </span>
                  {type === 'once' ? 'One-Time' : type === 'daily' ? 'Daily' : 'Weekly'}
                </button>
              ))}
            </div>

            {/* Weekly day picker */}
            {freqType === 'weekly' && (
              <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant/5 shadow-inner">
                <p className="text-[9px] uppercase font-black tracking-widest text-on-surface-variant/60 mb-3">Select recurrence days</p>
                <div className="flex gap-1.5 justify-between">
                  {WEEK_DAYS.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`w-9 h-9 rounded-full text-[12px] font-black transition-all border ${
                        freqDays.includes(day.value)
                          ? 'bg-primary text-white border-primary shadow-sm shadow-primary/30 scale-110'
                          : 'bg-surface-container-high text-on-surface-variant border-outline-variant/20 hover:border-primary/30'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                {freqDays.length > 0 && (
                  <p className="text-[10px] font-bold text-primary mt-2.5">
                    Repeats: {freqDays.sort().map(d => WEEK_DAYS[d].full).join(' · ')}
                  </p>
                )}
              </div>
            )}

            {/* Daily confirmation pill */}
            {freqType === 'daily' && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary/5 border border-primary/10">
                <span className="material-symbols-outlined text-[16px] text-primary">autorenew</span>
                <p className="text-[11px] font-bold text-primary">Resets every day after completion</p>
              </div>
            )}

            {/* One-time pill */}
            {freqType === 'once' && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-surface-container border border-outline-variant/10">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant/60">looks_one</span>
                <p className="text-[11px] font-bold text-on-surface-variant/60">Completes permanently — no recurrence</p>
              </div>
            )}
          </div>

          {/* Collaborators — Dropdown multi-select synced to org staff */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">
              Collaborators <span className="text-on-surface-variant/40 font-normal">(Optional)</span>
            </label>
            {staffList.length === 0 ? (
              <div className="w-full bg-surface-container rounded-2xl py-4 px-5 text-on-surface-variant/50 text-sm font-medium border border-outline-variant/5 shadow-inner">
                No other staff in the organization yet.
              </div>
            ) : (
              <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant/5 shadow-inner">
                <p className="text-[9px] uppercase font-black tracking-widest text-on-surface-variant/60 mb-3">
                  Select staff — task will be visible on their dashboard
                </p>
                <div className="flex flex-wrap gap-2">
                  {staffList.map(staff => {
                    const isSelected = !!selectedCollaborators.find(c => c.id === staff.id);
                    return (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => toggleCollaborator(staff)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105'
                            : 'bg-surface-container-high text-on-surface-variant border-outline-variant/20 hover:border-primary/30 hover:text-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {isSelected ? 'check_circle' : 'person'}
                        </span>
                        {staff.name}
                      </button>
                    );
                  })}
                </div>
                {selectedCollaborators.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-outline-variant/10 flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] uppercase font-black tracking-widest text-primary">Invited:</span>
                    {selectedCollaborators.map(c => (
                      <span key={c.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Workflow Breakdown */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">Workflow Breakdown (Optional)</label>
            <div className="flex gap-2 mb-3">
              <input
                value={newWorkflowStep}
                onChange={e => setNewWorkflowStep(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStep()}
                className="flex-1 bg-surface-container rounded-xl py-3 px-4 outline-none border border-outline-variant/5 text-on-surface text-sm focus:border-primary/30 focus:ring-2 focus:ring-primary/5 transition-all shadow-inner"
                placeholder="E.g., Collect Data"
              />
              <button
                onClick={handleAddStep}
                className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
              </button>
            </div>
            <div className="space-y-2 max-h-28 overflow-y-auto custom-scrollbar">
              {workflow.map((step, idx) => (
                <div key={step.id} className="flex items-center justify-between bg-surface-container-low px-4 py-2 rounded-xl border border-outline-variant/5">
                  <span className="text-sm font-medium"><span className="opacity-40 mr-2">{idx + 1}.</span>{step.name}</span>
                  <button onClick={() => handleRemoveStep(step.id)} className="text-on-surface-variant hover:text-error transition-colors p-1">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="px-8 pt-4 pb-8 shrink-0 border-t border-outline-variant/5 bg-surface-container-lowest rounded-b-[32px]">
          <button
            onClick={handleSubmit}
            className="mission-gradient w-full text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all border border-white/10"
          >
            Authorize Mission
          </button>
          <div className="mt-4 p-3 rounded-2xl bg-secondary/5 border border-secondary/10 flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-secondary mt-0.5">info</span>
            <p className="text-[10px] text-on-surface-variant leading-relaxed">
              AI Advisor will assess complexity and assign MP valuation. {freqType !== 'once' && <span className="text-primary font-bold">Recurring task — resets on schedule.</span>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
