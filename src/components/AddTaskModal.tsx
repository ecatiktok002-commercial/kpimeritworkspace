"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { TaskFrequency, MeritConfig, TaskDefinition, ImpactLevel, ComplexityLevel } from '@/lib/types';
import { calculateTaskPoints } from '@/lib/taskEngine';
import { getActivePointConfig } from '@/lib/utils';
import { assessTaskViaEdge, type EdgeAssessmentResult } from '@/lib/assessTask';

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
    status: 'queued' | 'running' | 'paused',
    commencementDate: string,
    collaborators: string[],
    workflow: { id: string; name: string; isCompleted: boolean }[],
    collaboratorIds: string[],
    frequency: TaskFrequency,
    isContinuous: boolean,
    assessedImpact?: ImpactLevel,
    assessedComplexity?: ComplexityLevel
  ) => void;
  initialTask?: {
    id: string;
    title: string;
    note: string;
    totalSec: number;
    status: 'queued' | 'running' | 'paused' | 'completed';
    commencementDate?: string;
    collaboratorIds?: string[];
    workflow?: { id: string; name: string; isCompleted: boolean }[];
    frequency?: TaskFrequency;
    isContinuous?: boolean;
  } | null;
  meritConfig: MeritConfig;
  taskDefinitions: TaskDefinition[];
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

export default function AddTaskModal({ isOpen, onClose, onSubmit, staffList = [], initialTask, meritConfig, taskDefinitions }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [mins, setMins] = useState(120);
  const [status, setStatus] = useState<'queued' | 'running' | 'paused'>('queued');
  const [selectedCollaborators, setSelectedCollaborators] = useState<StaffOption[]>([]);
  const [workflow, setWorkflow] = useState<{id: string; name: string; isCompleted: boolean}[]>([]);
  const [newWorkflowStep, setNewWorkflowStep] = useState('');

  // Frequency state
  const [freqType, setFreqType] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
  const [freqDays, setFreqDays] = useState<number[]>([]);
  const [triggerDate, setTriggerDate] = useState<number>(1);
  const [note, setNote] = useState('');
  const [isContinuous, setIsContinuous] = useState(false);
  const [isBatch, setIsBatch] = useState(false);
  const [batchCount, setBatchCount] = useState(1);

  // Keep a stable ref to staffList so it doesn't trigger form resets
  const staffListRef = React.useRef(staffList);
  staffListRef.current = staffList;

  // Timezone Helper (GMT+8 Kuala Lumpur)
  const getKLTime = () => {
    const d = new Date();
    const options = { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
    const formatter = new Intl.DateTimeFormat('en-US', options as any);
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}`;
  };

  const [commencementDate, setCommencementDate] = useState('');

  // Sync with initialTask when it changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialTask) {
        setTitle(initialTask.title);
        setNote(initialTask.note || '');
        setMins(Math.round(initialTask.totalSec / 60) || 120);
        setStatus(initialTask.status === 'completed' ? 'queued' : initialTask.status as 'queued' | 'running' | 'paused');
        setCommencementDate(initialTask.commencementDate?.includes('T') ? initialTask.commencementDate : getKLTime());
        setWorkflow(initialTask.workflow || []);
        setIsContinuous(initialTask.isContinuous || false);
        setFreqType(initialTask.frequency?.type || 'once');
        setFreqDays(initialTask.frequency?.days || []);
        setTriggerDate(initialTask.frequency?.triggerDate || 1);
        
        const currentStaffList = staffListRef.current;
        if (currentStaffList && initialTask.collaboratorIds) {
          setSelectedCollaborators(currentStaffList.filter(s => initialTask.collaboratorIds?.includes(s.id)));
        } else {
          setSelectedCollaborators([]);
        }
      } else {
        setTitle('');
        setNote('');
        setMins(120);
        setStatus('queued');
        setCommencementDate(getKLTime());
        setWorkflow([]);
        setIsContinuous(false);
        setFreqType('once');
        setFreqDays([]);
        setTriggerDate(1);
        setSelectedCollaborators([]);
      }
    }
  }, [isOpen, initialTask]);

  // Auto-sync time if "Start Now" is selected for NEW tasks
  useEffect(() => {
    if (status === 'running' && !initialTask) {
      setCommencementDate(getKLTime());
    }
  }, [status, isOpen, initialTask]);

  // ─── Edge Function AI Assessment ──────────────────────────────────
  const [edgeAssessment, setEdgeAssessment] = useState<EdgeAssessmentResult | null>(null);
  const [edgeLoading, setEdgeLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen || !title || title.length < 2) {
      setEdgeAssessment(null);
      return;
    }
    setEdgeLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await assessTaskViaEdge(title, note);
        setEdgeAssessment(result);
      } catch {
        // Fallback handled inside assessTaskViaEdge
      } finally {
        setEdgeLoading(false);
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [title, note, isOpen]);

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
    if (freqType === 'monthly' && (triggerDate < 1 || triggerDate > 31)) {
      alert('Please select a valid trigger date (1-31) for monthly recurrence.');
      return;
    }
    const collabNames = selectedCollaborators.map(c => c.name);
    const collabIds = selectedCollaborators.map(c => c.id);
    const frequency: TaskFrequency = {
      type: freqType,
      days: freqType === 'weekly' ? [...freqDays].sort() : undefined,
      triggerDate: freqType === 'monthly' ? triggerDate : undefined,
    };
    
    const finalTitle = isBatch ? `${title} [Batch x${batchCount}]` : title;
    const finalMins = isBatch ? (mins * batchCount) : (isContinuous ? 0 : mins);

    onSubmit(
      finalTitle, 
      note, 
      finalMins, 
      status, 
      status === 'running' ? getKLTime() : commencementDate, 
      collabNames, 
      workflow, 
      collabIds, 
      frequency, 
      isContinuous,
      pointCalc.impact,
      pointCalc.complexity
    );
    // Reset
    setTitle('');
    setMins(120);
    setBatchCount(1);
    setIsBatch(false);
    setStatus('queued');
    setCommencementDate(getKLTime());
    setSelectedCollaborators([]);
    setWorkflow([]);
    setNewWorkflowStep('');
    setFreqType('once');
    setFreqDays([]);
    setTriggerDate(1);
    setIsContinuous(false);
    onClose();
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

  // Point Preview Logic (local calc as instant fallback, edge overrides when ready)
  const activePointConfig = getActivePointConfig(meritConfig);
  const definition = taskDefinitions.find(d => (d.title || '').toLowerCase() === (title || '').toLowerCase());
  const finalMinsForPreview = isBatch ? (mins * batchCount) : mins;
  const localCalc = calculateTaskPoints(title, note, finalMinsForPreview, activePointConfig, definition);

  // Merge: Edge Function result takes priority over local calc
  const pointCalc = edgeAssessment ? {
    ...localCalc,
    impact: edgeAssessment.impact,
    complexity: edgeAssessment.complexity,
    points: edgeAssessment.points,
  } : localCalc;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-2 sm:px-4 py-4 sm:py-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-surface-container-lowest rounded-[24px] sm:rounded-[32px] shadow-2xl w-full max-w-md border border-outline-variant/10 relative animate-in zoom-in-95 duration-300 flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 32px)' }}
      >
        {/* Fixed Header */}
        <div className="flex justify-between items-start px-6 sm:px-8 pt-6 sm:pt-8 pb-4 shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Task Orchestration</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-headline text-on-surface tracking-tight truncate">
              {initialTask ? 'Edit Mission' : 'Queue New Task'}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-2 ml-4">
            <div className="flex gap-2">
              <div className="bg-surface-container px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-outline-variant/10 flex flex-col items-end shadow-sm">
                <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Impact</p>
                <p className="text-sm sm:text-base font-black text-on-surface font-headline">{pointCalc.impact || 'Low'}</p>
              </div>
              <div className="bg-surface-container px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-outline-variant/10 flex flex-col items-end shadow-sm">
                <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Cmplx</p>
                <p className="text-sm sm:text-base font-black text-on-surface font-headline">{pointCalc.complexity || 'Low'}</p>
              </div>
              <div className="bg-primary/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-primary/20 flex flex-col items-end shadow-sm">
                <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-primary opacity-60">Est. Reward</p>
                <p className="text-sm sm:text-lg font-black text-primary font-headline">+{pointCalc.points} <span className="text-[10px]">MP</span></p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-error/10 hover:text-error transition-all active:scale-90 text-on-surface-variant shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">close</span>
            </button>
          </div>
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

          {/* Mission Note */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">
              Instructions / Notes
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-medium focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner h-24 resize-none"
              placeholder="Provide specific details for this mission..."
            />
          </div>

          {/* Batch Processing Mode */}
          <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/10 shadow-inner">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">inventory_2</span>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">Batch Entry Mode</p>
              </div>
              <button 
                type="button"
                onClick={() => setIsBatch(!isBatch)}
                className={`w-12 h-6 rounded-full transition-all relative ${isBatch ? 'bg-primary' : 'bg-outline-variant/30'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isBatch ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            {isBatch ? (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <p className="text-[9px] text-on-surface-variant leading-relaxed mb-3 font-medium">
                  Ideal for repetitive routine work (e.g., printing, filing). Standard time will be multiplied by the count.
                </p>
                <div className="flex items-center gap-4 bg-white/50 p-3 rounded-xl border border-outline-variant/5">
                  <div className="flex-1">
                    <p className="text-[9px] font-bold uppercase text-on-surface-variant mb-1">Batch Count</p>
                    <input 
                      type="number" 
                      min="1"
                      value={batchCount} 
                      onChange={e => setBatchCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-transparent border-none outline-none text-xl font-black text-on-surface p-0"
                    />
                  </div>
                  <div className="h-10 w-px bg-outline-variant/20" />
                  <div className="flex-1 text-right">
                    <p className="text-[9px] font-bold uppercase text-on-surface-variant mb-1">Scaled Std.</p>
                    <p className="text-sm font-black text-primary">{mins * batchCount}m</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[9px] text-on-surface-variant opacity-60 italic">Enable for high-volume routine tasks.</p>
            )}
          </div>

          {/* Duration + Execution Pipeline — 2 cols */}
          <div className="grid grid-cols-2 gap-4">
            <div className={isContinuous ? 'opacity-50 pointer-events-none' : ''}>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-2 text-on-surface-variant ml-1">
                {isBatch ? 'Unit Std. (Mins)' : 'Duration (Mins)'} <span className="text-error">*</span>
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
                  onChange={e => setStatus(e.target.value as 'queued' | 'running' | 'paused')}
                  className="w-full bg-surface-container rounded-2xl py-4 px-4 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all cursor-pointer shadow-inner appearance-none pr-8 text-sm"
                >
                  <option value="queued">Queue</option>
                  <option value="running">Start Now</option>
                  <option value="paused">Pause</option>
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
              {(['once', 'daily', 'weekly', 'monthly'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { 
                    setFreqType(type); 
                    if (type !== 'weekly') setFreqDays([]); 
                    if (type !== 'monthly') setTriggerDate(1);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-all ${
                    freqType === type
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                      : 'bg-surface-container text-on-surface-variant border-outline-variant/10 hover:border-primary/20 hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {type === 'once' ? 'looks_one' : type === 'daily' ? 'autorenew' : type === 'weekly' ? 'calendar_view_week' : 'calendar_month'}
                  </span>
                  {type === 'once' ? 'One-Time' : type === 'daily' ? 'Daily' : type === 'weekly' ? 'Weekly' : 'Monthly'}
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

            {/* Monthly trigger date picker */}
            {freqType === 'monthly' && (
              <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant/5 shadow-inner">
                <p className="text-[9px] uppercase font-black tracking-widest text-on-surface-variant/60 mb-3">Select trigger date</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={triggerDate}
                    onChange={(e) => setTriggerDate(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                    className="w-20 bg-surface-container-high rounded-xl py-2 px-3 outline-none border border-outline-variant/20 text-on-surface font-bold text-center focus:border-primary/30"
                  />
                  <span className="text-[11px] font-bold text-on-surface-variant">of every month</span>
                </div>
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
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
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
            <div className="flex-1">
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                Current Logic: <span className="font-bold text-primary">{pointCalc.tierName}</span>. {freqType !== 'once' && <span className="text-primary font-bold">Recurring task — resets on schedule.</span>}
              </p>
              <p className="text-[9px] text-on-surface-variant opacity-60 mt-1 uppercase tracking-tighter font-bold">Multiplier: {pointCalc.tierVal}x | Min-Points Threshold: {pointCalc.points}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
