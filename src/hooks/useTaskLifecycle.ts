import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { calculateTaskPoints } from '@/lib/taskEngine';
import type { Task, ActivityLog, MeritConfig, StaffProfile, TaskFrequency, TaskDefinition, UserAuthProfile } from '@/lib/types';
import { getKLTime, getActivePointConfig } from '@/lib/utils';

export function useTaskLifecycle(
  authProfile: UserAuthProfile | null,
  meritConfig: MeritConfig,
  taskDefinitions: TaskDefinition[],
  team: any[],
  setTeam: React.Dispatch<React.SetStateAction<any[]>>,
  profile: StaffProfile
) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingWorkflowTaskId, setEditingWorkflowTaskId] = useState<string | null>(null);
  const [newWorkflowStepName, setNewWorkflowStepName] = useState('');
  const [showDutyReminder, setShowDutyReminder] = useState(false);

  // Duty Reminder Logic (Check every minute)
  useEffect(() => {
    const checkDuty = () => {
      const now = new Date();
      const klTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kuala_Lumpur"}));
      const hours = klTime.getHours();
      const mins = klTime.getMinutes();
      
      // If after 5:30 PM (17:30)
      if ((hours === 17 && mins >= 30) || hours >= 18) {
        const activeTasks = tasks.filter(t => t.status === 'running');
        setShowDutyReminder(activeTasks.length > 0);
      } else {
        setShowDutyReminder(false);
      }
    };
    
    checkDuty();
    const timer = setInterval(checkDuty, 60000);
    return () => clearInterval(timer);
  }, [tasks]);

  // Helper for DB mapping
  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  
  const mapTaskToDB = useCallback((task: Task) => {
    let staffId = authProfile?.id;
    if (task.ownerId && isUUID(task.ownerId)) {
      staffId = task.ownerId;
    }
    if (!staffId || !isUUID(staffId)) {
      staffId = '00000000-0000-0000-0000-000000000000';
    }

    return {
      id: task.id,
      title: task.title,
      note: task.note,
      total_sec: task.totalSec,
      elapsed_sec: task.elapsedSec,
      status: task.status,
      tier_name: task.tierName,
      tier_val: task.tierVal,
      points: task.points,
      commencement_date: task.commencementDate,
      manager_viewed: task.managerViewed ?? true,
      staff_id: staffId,
      actual_duration_minutes: task.actualDurationMinutes,
      efficiency_score: task.efficiencyScore,
      is_flagged: task.isFlagged,
      workflow: task.workflow,
      frequency: task.frequency,
      is_continuous: task.isContinuous,
      collaborator_ids: task.collaboratorIds,
      collaborators: task.collaborators,
      completed_at: task.completedAt
    };
  }, [authProfile]);

  const startTask = useCallback(async (id: string) => {
    registerActivity();
    const startTime = getKLTime();
    const task = tasks.find(t => t.id === id);
    
    if (task) {
      const startLog: ActivityLog = {
        id: crypto.randomUUID(),
        type: 'task_started',
        desc: `Staff started task: ${task.title}`,
        timestamp: startTime,
        staffName: authProfile?.full_name || profile.name || 'Staff',
        staffId: authProfile?.id || 'local',
        managerViewed: false
      };
      setActivityLog(prev => [startLog, ...prev]);
      supabase.from('activity_log').insert([{
        id: startLog.id,
        type: startLog.type,
        desc: startLog.desc,
        timestamp: startLog.timestamp,
        staff_name: startLog.staffName,
        staff_id: startLog.staffId,
        manager_viewed: false
      }]).then();
    }

    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'running' as const, commencementDate: startTime, managerViewed: false } : t));
    // Live-sync the team state so the Live Process Monitor updates in real-time
    if (task) {
      setTeam(prev => prev.map(m => m.id === (authProfile?.id || '') ? {
        ...m, currentTask: task.title, status: 'active' as const
      } : m));
    }
    await supabase.from('tasks').update({ status: 'running', commencement_date: startTime, manager_viewed: false }).eq('id', id);
  }, [tasks, authProfile, profile.name, setTeam]);

  const pauseTask = useCallback(async (id: string) => {
    registerActivity();
    const taskToPause = tasksRef.current.find(t => t.id === id);
    if (!taskToPause) return;
    const currentElapsed = taskToPause.elapsedSec;
    
    const isManagerAction = authProfile?.is_manager && authProfile?.id !== taskToPause.ownerId;
    
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        return { 
          ...t, 
          status: 'paused' as const, 
          managerViewed: false,
          isFlagged: isManagerAction ? true : t.isFlagged
        };
      }
      return t;
    }));
    
    // Live-sync the team state so the manager's command center shows the staff as no longer active
    setTeam(prev => prev.map(m => m.id === taskToPause.ownerId ? {
      ...m, currentTask: 'Awaiting Task', status: 'online' as const
    } : m));

    const payload: any = { 
      status: 'paused', 
      elapsed_sec: currentElapsed, 
      manager_viewed: false 
    };
    if (isManagerAction) payload.is_flagged = true;

    await supabase.from('tasks').update(payload).eq('id', id);
  }, [setTeam, authProfile]);

  const tasksRef = useRef(tasks);
  const lastActivityAt = useRef<number>(Date.now());
  
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Helper to register system activity
  const registerActivity = useCallback(() => {
    lastActivityAt.current = Date.now();
  }, []);

  // Removed Auto-Pause on Tab Close, but implementing the new System-Level Safeguards
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const klTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kuala_Lumpur"}));
      const hours = klTime.getHours();
      
      const currentDayStr = `${klTime.getFullYear()}-${klTime.getMonth()}-${klTime.getDate()}`;
      let didEndOfDayWipe = false;
      
      // End-of-Day Wipe: Trigger exactly once per day after 6:00 PM
      if (hours >= 18) {
        if (typeof window !== 'undefined' && localStorage.getItem('kpi_last_wipe_day') !== currentDayStr) {
          didEndOfDayWipe = true;
          localStorage.setItem('kpi_last_wipe_day', currentDayStr);
        }
      }

      const idleMinutes = (Date.now() - lastActivityAt.current) / 60000;

      tasksRef.current.forEach(t => {
        if (t.status === 'running') {
          let shouldPause = false;

          // 1. End-of-Day Wipe
          if (didEndOfDayWipe) {
            shouldPause = true;
          }
          
          // 2. Idle Detection: 30 minutes of no system activity
          if (idleMinutes >= 30) {
            shouldPause = true;
          }

          // 3. The Auto-Pause: Elapsed Time exceeds Est. Time by 20%
          // We trigger only exactly when it crosses the threshold so it doesn't spam pause if they resume.
          if (!t.isContinuous && t.totalSec > 0) {
            const threshold = Math.floor(t.totalSec * 1.2);
            if (t.elapsedSec === threshold) {
              shouldPause = true;
            }
          }

          if (shouldPause) {
            pauseTask(t.id);
          }
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pauseTask]);

  const getNextRecurrenceDate = (task: Task): string => {
    const now = new Date();
    const klNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    if (task.frequency?.type === 'daily') {
      const next = new Date(klNow);
      next.setDate(next.getDate() + 1);
      next.setHours(8, 0, 0, 0);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${next.getFullYear()}-${pad(next.getMonth()+1)}-${pad(next.getDate())}T08:00`;
    }
    if (task.frequency?.type === 'weekly' && task.frequency.days && task.frequency.days.length > 0) {
      const today = klNow.getDay();
      const sortedDays = [...task.frequency.days].sort((a, b) => a - b);
      let daysAhead = sortedDays.find(d => d > today);
      if (daysAhead === undefined) daysAhead = sortedDays[0];
      const diff = daysAhead > today ? daysAhead - today : 7 - today + daysAhead;
      const next = new Date(klNow);
      next.setDate(next.getDate() + diff);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${next.getFullYear()}-${pad(next.getMonth()+1)}-${pad(next.getDate())}T08:00`;
    }
    if (task.frequency?.type === 'monthly' && task.frequency.triggerDate) {
      const next = new Date(klNow);
      let targetMonth = next.getMonth();
      let targetYear = next.getFullYear();
      const targetDate = task.frequency.triggerDate;
      
      if (next.getDate() >= targetDate) {
        targetMonth++;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear++;
        }
      }

      // Handle months with fewer days than targetDate (e.g., Feb 30 -> Feb 28)
      const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const actualTargetDate = Math.min(targetDate, daysInTargetMonth);

      next.setFullYear(targetYear, targetMonth, actualTargetDate);
      next.setHours(8, 0, 0, 0);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${next.getFullYear()}-${pad(next.getMonth()+1)}-${pad(next.getDate())}T08:00`;
    }
    return getKLTime();
  };

  const completeTask = useCallback(async (id: string) => {
    registerActivity();
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    let pointsEarned = task.points;
    let isFlagged = false;
    let efficiencyScore = 1.0;
    const actualMins = Math.max(1, Math.round(task.elapsedSec / 60));

    const estimatedMins = Math.round(task.totalSec / 60);

    const calc = calculateTaskPoints(
      task.title,
      task.note,
      actualMins,
      getActivePointConfig(meritConfig),
      {
        goldenRule: task.goldenRuleMinutes,
        estimatedMins: estimatedMins,
        tierMultiplier: task.tierVal,
        isCalibrated: !!task.isCalibrated
      }
    );

    pointsEarned = calc.points;
    isFlagged = calc.isFlagged;
    efficiencyScore = calc.efficiencyScore;

    const staffId = task.ownerId || authProfile?.id;
    const staffMember = team.find(m => m.id === staffId);
    const staffName = staffMember ? staffMember.name : (authProfile?.full_name || profile.name || 'Staff Member');

    const newActivity: ActivityLog = {
      id: crypto.randomUUID(),
      type: 'points_earned',
      desc: isFlagged ? `Completed Task (Overdue - Points Reduced): ${task.title}` : `Completed Task: ${task.title}`,
      timestamp: getKLTime(),
      points: pointsEarned,
      tier_val: task.tierVal,
      staffName: staffName,
      staffId: staffId,
      isFlagged: isFlagged,
      efficiencyScore: efficiencyScore,
      managerViewed: false
    };

    if (task.isCalibrated && task.goldenRuleMinutes && actualMins > task.goldenRuleMinutes * 4) {
      newActivity.desc = `INVALID DATA: Task exceeded 4x Golden Rule duration (${task.title})`;
      newActivity.points = 0;
      pointsEarned = 0;
      isFlagged = true;
    }

    setActivityLog(acts => [newActivity, ...acts]);
    await supabase.from('activity_log').insert([{
      id: newActivity.id,
      type: newActivity.type,
      desc: newActivity.desc,
      timestamp: newActivity.timestamp,
      points: newActivity.points,
      tier_val: newActivity.tier_val,
      staff_name: newActivity.staffName,
      staff_id: staffId,
      is_flagged: newActivity.isFlagged,
      efficiency_score: newActivity.efficiencyScore,
      manager_viewed: false
    }]);

    // Achievement check removed

    if (staffId) {
      setTeam(prev => prev.map(m => m.id === staffId ? { ...m, monthPoints: m.monthPoints + pointsEarned } : m));
      const { data: profileData } = await supabase.from('profiles').select('total_points').eq('id', staffId).single();
      const currentPts = profileData?.total_points || 0;
      await supabase.from('profiles').update({ total_points: currentPts + pointsEarned }).eq('id', staffId);
    }

    const isRecurring = task.frequency && task.frequency.type !== 'once';
    let updatedTask: Task;

    if (isRecurring) {
      updatedTask = {
        ...task,
        status: 'queued' as const,
        elapsedSec: 0,
        lastCompletedDate: getKLTime(),
        commencementDate: getNextRecurrenceDate(task),
        workflow: task.workflow ? task.workflow.map(w => ({ ...w, isCompleted: false })) : task.workflow,
      };
    } else {
      updatedTask = { 
        ...task, 
        status: 'completed' as const, 
        elapsedSec: task.totalSec, 
        lastCompletedDate: getKLTime(),
        completedAt: getKLTime(),
        actualDurationMinutes: actualMins,
        efficiencyScore: efficiencyScore,
        isFlagged: isFlagged,
        points: pointsEarned
      };
    }

    setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));
    // Live-sync team state: staff goes back to Awaiting Task
    if (staffId) {
      setTeam(prev => prev.map(m => m.id === staffId ? { ...m, currentTask: 'Awaiting Task', status: 'online' as const } : m));
    }

    const member = team.find(m => m.id === staffId);
    supabase.from('task_calibration').insert([{
      task_title: task.title,
      task_note: task.note,
      actual_duration_minutes: actualMins,
      staff_id: staffId,
      staff_role: member?.role || 'Staff',
      department: member?.department || 'General',
      points_awarded: pointsEarned,
      tier_val: updatedTask.tierVal
    }]).then(async ({ error }) => {
      if (error) console.error('[task_calibration] log error:', error);
      const { count } = await supabase.from('task_calibration').select('*', { count: 'exact', head: true }).eq('task_title', task.title);
      if (count && count >= 15 && !task.isCalibrated) {
        const triggerLog: ActivityLog = {
          id: crypto.randomUUID(),
          type: 'system',
          desc: `AUTO-CALIBRATION: Task "${task.title}" has 15 entries. Time to "Lock the Golden Rule".`,
          timestamp: getKLTime(),
          managerViewed: false
        };
        setActivityLog(prev => [triggerLog, ...prev]);
        supabase.from('activity_log').insert([{
          id: triggerLog.id,
          type: triggerLog.type,
          desc: triggerLog.desc,
          timestamp: triggerLog.timestamp,
          manager_viewed: false
        }]).then();
      }
    });

    supabase.from('tasks').upsert([mapTaskToDB(updatedTask)]).then();
  }, [tasks, authProfile, profile.name, meritConfig, mapTaskToDB]);

  const handleAddTask = useCallback((title: string, note: string, mins: number, status: 'queued' | 'running' | 'paused', commencementDate: string, collaborators: string[] = [], workflow: { id: string; name: string; isCompleted: boolean }[] = [], collaboratorIds: string[] = [], frequency: TaskFrequency = { type: 'once' }, isContinuous: boolean = false) => {
    registerActivity();
    const definition = taskDefinitions.find(d => d.title.toLowerCase() === title.toLowerCase());
    const activePointConfig = getActivePointConfig(meritConfig);
    const calc = calculateTaskPoints(
      title, 
      note, 
      mins, 
      activePointConfig, 
      {
        ...definition,
        estimatedMins: mins,
        isCalibrated: !!definition?.isCalibrated
      }
    );
    const currentUserId = authProfile?.id;
    
    const task: Task = {
      id: editingTask ? editingTask.id : crypto.randomUUID(),
      title, note,
      totalSec: mins * 60,
      elapsedSec: editingTask ? editingTask.elapsedSec : 0,
      status: editingTask ? editingTask.status : status,
      tierName: calc.tierName,
      tierVal: calc.tierVal,
      points: calc.points,
      commencementDate: commencementDate || new Date().toISOString(),
      ownerId: editingTask ? editingTask.ownerId : (isUUID(currentUserId || '') ? currentUserId! : (authProfile?.access_id || 'local')),
      collaborators,
      collaboratorIds: collaboratorIds.filter(id => isUUID(id)),
      frequency,
      isContinuous,
      workflow: workflow,
      goldenRuleMinutes: definition?.goldenRuleMinutes,
      isCalibrated: definition?.isCalibrated,
      managerViewed: editingTask ? editingTask.managerViewed : false
    };

    if (editingTask) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? task : t));
      setEditingTask(null);
    } else {
      setTasks(prev => [...prev, task]);
    }

    supabase.from('tasks').upsert([mapTaskToDB(task)]).then();
  }, [authProfile, profile.name, editingTask, taskDefinitions, meritConfig, mapTaskToDB]);

  const toggleWorkflowStep = (taskId: string, stepId: string) => {
    registerActivity();
    setTasks(prev => prev.map(t => {
      if (t.id === taskId && t.workflow) {
        const updatedTask = {
          ...t,
          workflow: t.workflow.map(w => w.id === stepId ? { ...w, isCompleted: !w.isCompleted } : w),
          managerViewed: false
        };
        supabase.from('tasks').upsert([mapTaskToDB(updatedTask)]).then();
        return updatedTask;
      }
      return t;
    }));
  };

  const updateWorkflowStepName = (taskId: string, stepId: string, newName: string) => {
    registerActivity();
    setTasks(prev => prev.map(t => {
      if (t.id === taskId && t.workflow) {
        const updatedTask = {
          ...t,
          workflow: t.workflow.map(w => w.id === stepId ? { ...w, name: newName } : w),
          managerViewed: false
        };
        supabase.from('tasks').upsert([mapTaskToDB(updatedTask)]).then();
        return updatedTask;
      }
      return t;
    }));
  };

  const addWorkflowStep = (taskId: string) => {
    registerActivity();
    if (!newWorkflowStepName.trim()) return;
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newStep = { id: 'wf-' + Date.now(), name: newWorkflowStepName.trim(), isCompleted: false };
        const updatedTask = { ...t, workflow: [...(t.workflow || []), newStep], managerViewed: false };
        supabase.from('tasks').upsert([mapTaskToDB(updatedTask)]).then();
        return updatedTask;
      }
      return t;
    }));
    setNewWorkflowStepName('');
  };

  const handleDeleteTask = useCallback((id: string, title: string) => {
    registerActivity();
    if (!window.confirm(`Are you sure you want to delete the task "${title}"?`)) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    supabase.from('tasks').delete().eq('id', id).then();
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    registerActivity();
    setEditingTask(task);
  }, []);

  // Sentinel & Safety Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(prev => prev.map(t => {
        if (t.status !== 'running') return t;
        const newElapsed = (t.elapsedSec || 0) + 1;
        const goldenLimit = (t.goldenRuleMinutes || 0) * 60;
        let sentinelReminder = t.sentinelReminder;
        if (goldenLimit > 0 && newElapsed >= goldenLimit && !sentinelReminder) {
          sentinelReminder = true;
        }
        if (!t.isContinuous && t.totalSec > 0 && newElapsed >= t.totalSec) {
          return { ...t, sentinelReminder };
        }
        return { ...t, elapsedSec: newElapsed, sentinelReminder };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Absolute Safety Cap Loop
  useEffect(() => {
    const expiredTasks = tasks.filter(t => 
      t.status === 'running' && 
      !t.isAutoCompleted &&
      (
        (t.goldenRuleMinutes && t.goldenRuleMinutes > 0 && (t.elapsedSec || 0) >= t.goldenRuleMinutes * 60 * 4) ||
        ((t.elapsedSec || 0) >= 36000) // 10 hour absolute safety cap
      )
    );
    expiredTasks.forEach(t => {
      setTasks(prev => prev.map(pt => pt.id === t.id ? { ...pt, isAutoCompleted: true } : pt));
      completeTask(t.id);
    });
  }, [tasks, completeTask]);

  return {
    tasks, setTasks,
    activityLog, setActivityLog,
    editingTask, setEditingTask,
    editingWorkflowTaskId, setEditingWorkflowTaskId,
    newWorkflowStepName, setNewWorkflowStepName,
    startTask, pauseTask, completeTask, handleAddTask,
    toggleWorkflowStep, updateWorkflowStepName, addWorkflowStep,
    handleDeleteTask, handleEditTask,
    showDutyReminder, setShowDutyReminder
  };
}
