"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AppHeader from '@/components/AppHeader';
import ProfileModal from '@/components/ProfileModal';
import AddTaskModal from '@/components/AddTaskModal';
import AddModuleModal from '@/components/AddModuleModal';
import EconomyManagerPage from '@/components/EconomyManagerPage';
import StaffEconomyPage from '@/components/StaffEconomyPage';
import StaffExecutionReport from '@/components/StaffExecutionReport';
import type { Task, TaskFrequency, StaffProfile, TeamMember, AppealItem, SkillModule, MeritConfig, OrganizationConfig, ActivityLog, TaskDefinition, AiPointConfig, ModuleEnrollment, ModuleStep, KeywordRule, UserAuthProfile } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { SEED_PROFILE, SEED_MODULES, SEED_MERIT_CONFIG, SEED_ORG_CONFIG } from '@/lib/mockDb';
import EfficiencyBadge from '@/components/EfficiencyBadge';
import ManagerLedgerView from '@/components/ManagerLedgerView';
import ManagerDashboardView from '@/components/ManagerDashboardView';
import ManagerOrgView from '@/components/ManagerOrgView';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar, Tooltip, ReferenceLine, LineChart, Line } from 'recharts';
import { getKLTime, fmt, getActivePointConfig } from '@/lib/utils';
import { useTaskLifecycle } from '@/hooks/useTaskLifecycle';


// â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 
// MAIN APP â€” Single-Page with Tab-Based View Switching
// â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 

export default function MeritKPIApp() {
  // â”€â”€ Auth & Global State â”€â”€
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authProfile, setAuthProfile] = useState<UserAuthProfile | null>(null); // Real profile from Supabase
  const [activeView, setActiveView] = useState('staff');
  const [managerSubView, setManagerSubView] = useState('dashboard');
  const [trainingSubView, setTrainingSubView] = useState<'matrix' | 'detail'>('matrix'); // Added for skills navigation
  const [minPointThreshold, setMinPointThreshold] = useState(975);

  // â”€â”€ Session Persistence â”€â”€
  useEffect(() => {
    const savedLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const savedProfile = localStorage.getItem('authProfile');
    const savedView = localStorage.getItem('activeView');
    
    if (savedLoggedIn && savedProfile) {
      setIsLoggedIn(true);
      const parsedProfile = JSON.parse(savedProfile);
      setAuthProfile(parsedProfile);
      setProfile({
        name: parsedProfile.full_name || parsedProfile.name || '',
        department: parsedProfile.department || 'General',
        employmentType: parsedProfile.employmentType || parsedProfile.employment_type || 'Staff',
        designation: parsedProfile.designation || 'Staff',
        photoUrl: parsedProfile.photo_url || parsedProfile.photoUrl || "https://i.pravatar.cc/150"
      });
      if (savedView) setActiveView(savedView);
      else setActiveView(parsedProfile.is_manager ? 'manager' : 'staff');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn.toString());
    if (authProfile) {
      localStorage.setItem('authProfile', JSON.stringify(authProfile));
    } else {
      localStorage.removeItem('authProfile');
    }
    localStorage.setItem('activeView', activeView);
  }, [isLoggedIn, authProfile, activeView]);
  
  // Real DB state (No more mock seeds except config fallback)
  const [team, setTeam] = useState<TeamMember[]>([]); 
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [modules, setModules] = useState<SkillModule[]>(SEED_MODULES); 
  const [meritConfig, setMeritConfig] = useState<MeritConfig>(SEED_MERIT_CONFIG);
  const [orgConfig, setOrgConfig] = useState<OrganizationConfig>(SEED_ORG_CONFIG);
  const [pendingRedemptionsCount, setPendingRedemptionsCount] = useState(0);
  const [enrollments, setEnrollments] = useState<ModuleEnrollment[]>([]);
  const [moduleSteps, setModuleSteps] = useState<ModuleStep[]>([]);
  const [taskDefinitions, setTaskDefinitions] = useState<TaskDefinition[]>([]);
  const [flaggedTasks, setFlaggedTasks] = useState<any[]>([]);

  const [profile, setProfile] = useState<StaffProfile>(SEED_PROFILE); 
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [ackRedemptions, setAckRedemptions] = useState(0);
  const [ackAppeals, setAckAppeals] = useState(0);
  const [currentMonth, setCurrentMonth] = useState('');
  const [klTodayStr, setKlTodayStr] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);

  // Initialize Task Lifecycle Hook
  const {
    tasks, setTasks,
    activityLog, setActivityLog,
    editingTask, setEditingTask,
    editingWorkflowTaskId, setEditingWorkflowTaskId,
    newWorkflowStepName, setNewWorkflowStepName,
    startTask, pauseTask, completeTask, handleAddTask,
    toggleWorkflowStep, updateWorkflowStepName, addWorkflowStep,
    handleDeleteTask, handleEditTask,
    showDutyReminder, setShowDutyReminder
  } = useTaskLifecycle(
    authProfile,
    meritConfig,
    taskDefinitions,
    team,
    setTeam,
    profile
  );

  const [archiveDisplayLimit, setArchiveDisplayLimit] = useState(10);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [archiveFilter, setArchiveFilter] = useState('All');

  useEffect(() => {
    setViewedIds(JSON.parse(localStorage.getItem('viewedIds') || '[]'));
    setAckRedemptions(parseInt(localStorage.getItem('ackRedemptions') || '0', 10));
    setAckAppeals(parseInt(localStorage.getItem('ackAppeals') || '0', 10));
    // Set client-only date values to avoid hydration mismatch
    setCurrentMonth(new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date()));
    setKlTodayStr(getKLTime().split('T')[0]);
  }, []);

  // Auto-clear badges when entering the respective views
  useEffect(() => {
    if (managerSubView === 'economy') {
      if (pendingRedemptionsCount > ackRedemptions) {
        setAckRedemptions(pendingRedemptionsCount);
        localStorage.setItem('ackRedemptions', pendingRedemptionsCount.toString());
      }
    }
    if (managerSubView === 'resolutions') {
      const pending = appeals.filter(a => !a.resolved).length;
      if (pending > ackAppeals) {
        setAckAppeals(pending);
        localStorage.setItem('ackAppeals', pending.toString());
      }
    }
  }, [managerSubView, pendingRedemptionsCount, appeals, ackRedemptions, ackAppeals]);

  // Keep acks in sync if pending count drops (e.g., item resolved)
  useEffect(() => {
    if (!dataLoaded) return;
    if (pendingRedemptionsCount < ackRedemptions) {
      setAckRedemptions(pendingRedemptionsCount);
      localStorage.setItem('ackRedemptions', pendingRedemptionsCount.toString());
    }
    const pendingAppeals = appeals.filter(a => !a.resolved).length;
    if (pendingAppeals < ackAppeals) {
      setAckAppeals(pendingAppeals);
      localStorage.setItem('ackAppeals', pendingAppeals.toString());
    }
  }, [pendingRedemptionsCount, appeals, ackRedemptions, ackAppeals, dataLoaded]);

  const markViewed = (staffMemberId: string) => {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffMemberId);
    if (!isUUID) return;

    // 1. Immediately update local task state — clears the red dot counter
    setTasks(prev => prev.map(t =>
      t.ownerId === staffMemberId ? { ...t, managerViewed: true } : t
    ));
    // 2. Update local activity log state
    setActivityLog(prev => prev.map(a =>
      a.staffId === staffMemberId ? { ...a, managerViewed: true } : a
    ));
    // 3. Track in viewedIds (for UI card highlight clearing)
    if (!viewedIds.includes(staffMemberId)) {
      const nextIds = [...viewedIds, staffMemberId];
      setViewedIds(nextIds);
      localStorage.setItem('viewedIds', JSON.stringify(nextIds));
    }
    // 4. Async DB sync — fire and forget
    supabase.from('tasks').update({ manager_viewed: true }).eq('staff_id', staffMemberId).eq('manager_viewed', false).then();
    supabase.from('activity_log').update({ manager_viewed: true }).eq('staff_id', staffMemberId).eq('manager_viewed', false).then();
  };

  // —— Database Fetching ——
  useEffect(() => {
    if (isLoggedIn && authProfile) {
      const fetchData = async () => {
        try {
          // 1. Fetch TEAM for managers
          const { data: profilesData } = await supabase.from('profiles').select('*');
          if (profilesData) setTeam(profilesData.map(t => ({
            id: t.id,
            name: t.full_name || 'Staff Member',
            imgUrl: t.photo_url || "https://i.pravatar.cc/150?u="+t.id,
            status: 'online',
            currentTask: 'Awaiting Task',
            department: t.department || 'General',
            monthPoints: t.total_points || 0,
            rank: 1,
            elapsed: '',
            role: t.role
          })));

          // Fetch org config for ALL users so staff can see their roles and missions
          const { data: configData } = await supabase
            .from('org_config')
            .select('config')
            .eq('workspace_id', 'default')
            .maybeSingle();
          if (configData?.config) {
            setOrgConfig(configData.config);
          } else {
            // Fallback to old system_configs seeded value
            const { data: sysData } = await supabase
              .from('system_configs')
              .select('value')
              .eq('key', 'org_config')
              .maybeSingle();
            if (sysData?.value) setOrgConfig(sysData.value as OrganizationConfig);
          }

          // Load merit_config (Global economy rules) - Needed by both staff and managers
          const { data: meritData } = await supabase
            .from('system_configs')
            .select('value')
            .eq('key', 'merit_config')
            .maybeSingle();
          if (meritData?.value) {
            const dbConfig = meritData.value as MeritConfig;
            // If DB has no keywords, populate with our industry presets from mockDb
            if (!dbConfig.keywordRules || dbConfig.keywordRules.length === 0) {
              dbConfig.keywordRules = SEED_MERIT_CONFIG.keywordRules;
            }
            setMeritConfig(dbConfig);
          } else {
            setMeritConfig(SEED_MERIT_CONFIG);
          }

          if (authProfile.is_manager) {
            // Fetch pending redemptions count for the admin red dot badge
            const { count } = await supabase
              .from('reward_redemptions')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'pending');
            setPendingRedemptionsCount(count || 0);
          }

          // 2. Fetch TASKS
          const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');
          
          let query = supabase.from('tasks').select('*');
          if (!authProfile.is_manager) {
            const currentId = authProfile.id;
            if (isValidUUID(currentId)) {
              query = query.or(`staff_id.eq.${currentId},collaborator_ids.cs.{${currentId}}`);
            }
          }
          
          const { data: taskData, error: taskError } = await query.order('created_at', { ascending: true });
          if (taskData) {
            setTasks(taskData.map(t => {
              let currentElapsed = t.elapsed_sec || 0;
              if (t.status === 'running' && t.commencement_date) {
                const now = new Date();
                const klNowFormatter = new Intl.DateTimeFormat('en-US', {
                  timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                });
                const parts = klNowFormatter.formatToParts(now);
                const getP = (t: string) => parts.find(p => p.type === t)?.value || '';
                const klNowStr = `${getP('year')}-${getP('month')}-${getP('day')}T${getP('hour')}:${getP('minute')}:${getP('second')}`;

                const klNow = new Date(klNowStr);
                const startStr = t.commencement_date.substring(0, 19); // Strip Supabase UTC offset
                const start = new Date(startStr);
                
                if (!isNaN(start.getTime())) {
                  const diffSecs = Math.max(0, Math.floor((klNow.getTime() - start.getTime()) / 1000));
                  currentElapsed += diffSecs;
                }
              }

              return {
                id: t.id,
                title: t.title,
                note: t.note,
                totalSec: t.total_sec,
                elapsedSec: currentElapsed,
                status: t.status,
                tierName: t.tier_name,
                tierVal: t.tier_val,
                points: t.points,
                commencementDate: t.commencement_date || t.created_at,
                lastCompletedDate: t.status === 'completed' ? (t.completed_at || t.commencement_date || t.created_at) : undefined,
                completedAt: t.completed_at,
                managerViewed: t.manager_viewed,
                ownerId: t.staff_id,
                collaboratorIds: t.collaborator_ids || [],
                collaborators: t.collaborators || [],
                frequency: t.frequency || { type: 'once' },
                isContinuous: t.is_continuous || false,
                workflow: t.workflow || [],
                goldenRuleMinutes: t.golden_rule_minutes,
                isCalibrated: t.is_calibrated,
                actualDurationMinutes: t.actual_duration_minutes,
                efficiencyScore: Number(t.efficiency_score || 1),
                isFlagged: t.is_flagged,
                impact: t.impact,
                complexity: t.complexity
              };
            }));
            
            if (authProfile.is_manager && profilesData) {
              setTeam(profilesData.map(t => {
                const memberTasks = taskData.filter(task => task.staff_id === t.id && task.status === 'running');
                const activeTask = memberTasks.length > 0 ? memberTasks[memberTasks.length - 1] : null;
                const completedTasks = taskData.filter(task => task.staff_id === t.id && task.status === 'completed' && task.efficiency_score !== undefined && task.efficiency_score !== null);
                const avgEfficiency = completedTasks.length > 0 ? completedTasks.reduce((acc, curr) => acc + (curr.efficiency_score || 0), 0) / completedTasks.length : 1;
                const isFlagged = activeTask ? (activeTask.elapsed_sec > activeTask.total_sec && activeTask.total_sec > 0) : false;
                return {
                  id: t.id,
                  name: t.full_name || 'Staff Member',
                  imgUrl: t.photo_url || "https://i.pravatar.cc/150?u="+t.id,
                  status: 'online',
                  currentTask: activeTask ? activeTask.title : 'Awaiting Task',
                  isFlagged: isFlagged,
                  department: t.department || 'General',
                  monthPoints: t.total_points || 0,
                  rank: 1,
                  elapsed: '',
                  role: t.role,
                  efficiencyScore: avgEfficiency
                };
              }));
            }
          }

          // 3. Activity Log
          const { data: actData } = await supabase
            .from('activity_log')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);
          if (actData) {
            setActivityLog(actData.map(a => ({
              id: a.id,
              type: a.type as any,
              desc: a.desc,
              points: a.points,
              timestamp: a.timestamp,
              staffName: a.staff_name || a.staffName,
              staffId: a.staff_id,
              isFlagged: a.is_flagged,
              efficiencyScore: a.efficiency_score,
              managerViewed: a.manager_viewed
            })));
          }

          // 4.5 Modules
          const { data: modData } = await supabase.from('skill_modules').select('*');
          const { data: enrollData } = await supabase.from('module_enrollments').select('*');
          const { data: stepData } = await supabase.from('module_steps').select('*').order('step_order', { ascending: true });

          if (modData) {
            setModules(modData.map(m => ({
              id: m.id,
              code: m.code,
              title: m.title,
              description: m.description,
              meritValue: m.merit_value,
              participants: enrollData ? enrollData.filter(e => e.module_id === m.id).length : 0
            })));
          }

          if (enrollData) {
            setEnrollments(enrollData.map(e => {
              const profile = profilesData?.find(p => p.id === e.staff_id);
              return {
                id: e.id,
                module_id: e.module_id,
                staff_id: e.staff_id,
                staffName: profile?.full_name || 'Staff Member',
                status: e.status,
                current_step_order: e.current_step_order,
                completed_at: e.completed_at
              };
            }));
          }

          if (stepData) {
            setModuleSteps(stepData.map(s => ({
              id: s.id,
              module_id: s.module_id,
              step_order: s.step_order,
              title: s.title,
              description: s.description,
              content_url: s.content_url
            })));
          }

          // 4.6 Appeals
          const { data: appData } = await supabase.from('appeals').select('*');
          if (appData) {
            setAppeals(appData.map(a => ({
              id: a.id,
              staffId: a.staff_id,
              staffName: a.staff_name,
              department: a.department,
              taskTitle: a.task_title,
              originalPoints: a.original_points,
              appealComment: a.appeal_comment,
              imgUrl: a.img_url,
              resolved: a.resolved,
              resolutionMessage: a.resolution_note,
              finalPoints: a.final_points
            })));
          }

          // 5. Staff Profile (Sync fresh details for both manager and staff)
          const { data: pData } = await supabase.from('profiles').select('*').eq('id', authProfile.id).single();
          if (pData) {
            setProfile({
              name: pData.full_name || '',
              department: pData.department || 'General',
              employmentType: pData.employment_type || 'Full-Time',
              designation: pData.designation || 'Staff',
              photoUrl: pData.photo_url || "https://i.pravatar.cc/150"
            });
          }

          // 6. Task Definitions (Antigravity Standards)
          const { data: defData } = await supabase.from('task_definitions').select('*');
          if (defData) {
            setTaskDefinitions(defData.map(d => ({
              id: d.id,
              title: d.title,
              goldenRuleMinutes: d.golden_rule_minutes,
              tierMultiplier: Number(d.tier_multiplier),
              isCalibrated: d.is_calibrated,
              impact: d.impact,
              complexity: d.complexity
            })));
          }

          // 7. Flagged Tasks (Anomalies)
          const { data: flagData } = await supabase
            .from('tasks')
            .select('*')
            .eq('is_flagged', true)
            .order('efficiency_score', { ascending: true });
          if (flagData) setFlaggedTasks(flagData);
          
          setDataLoaded(true);
        } catch (err) {
          console.error('fetchData failed:', err);
        }
      };
      fetchData();

      // Real-time synchronization for Admin Dashboard Red Dots and Staff Remote Control
      let channel: any;
      if (authProfile.is_manager) {
        channel = supabase.channel('admin-dashboard-sync');
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => { fetchData(); });
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => { fetchData(); });
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'appeals' }, () => { fetchData(); });
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'reward_redemptions' }, () => { fetchData(); });
        channel.subscribe();
      } else {
        channel = supabase.channel('staff-sync');
        // Listen to updates on the staff's own tasks (e.g. Force Pause by Manager)
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => { fetchData(); });
        channel.subscribe();
      }

      return () => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      };
    }
  }, [isLoggedIn, authProfile]);

  // —— Modal State ——
  const [profileOpen, setProfileOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [completedTasksOpen, setCompletedTasksOpen] = useState(false);

  const handleEditTaskUI = useCallback((task: Task) => {
    handleEditTask(task);
    setAddTaskOpen(true);
  }, [handleEditTask]);

  // ——— Module Handlers ———
  const handleDeleteModule = async (id: string) => {
    if (!confirm('Are you sure you want to remove this learning module?')) return;
    const { error } = await supabase.from('skill_modules').delete().eq('id', id);
    if (error) {
      alert('Error deleting module: ' + error.message);
      return;
    }
    setModules(prev => prev.filter(m => m.id !== id));
  };

  const handleAddModule = useCallback(async (code: string, title: string, desc: string, points: number, steps: { title: string, description: string, contentUrl?: string }[]) => {
    const moduleId = crypto.randomUUID();
    const newMod: SkillModule = { id: moduleId, code, title, description: desc, meritValue: points, participants: 0 };
    
    const { error: modError } = await supabase.from('skill_modules').insert([{
      id: moduleId,
      code: newMod.code,
      title: newMod.title,
      description: newMod.description,
      merit_value: newMod.meritValue
    }]);

    if (modError) {
      alert('Error saving module: ' + modError.message);
      return;
    }

    if (steps.length > 0) {
      const dbSteps = steps.map((s, idx) => ({
        id: crypto.randomUUID(),
        module_id: moduleId,
        step_order: idx + 1,
        title: s.title,
        description: s.description,
        content_url: s.contentUrl
      }));

      const { error: stepsError } = await supabase.from('module_steps').insert(dbSteps);
      if (stepsError) {
        console.error('Error saving steps:', stepsError);
        alert('Module created, but steps failed to save. Please try editing later.');
      } else {
        setModuleSteps(prev => [...prev, ...dbSteps]);
      }
    }

    setModules(prev => [...prev, newMod]);
    setAddModuleOpen(false);
  }, []);

  const handleJoinModule = useCallback(async (moduleId: string) => {
    if (!authProfile?.id) return;
    
    const newEnrollment: ModuleEnrollment = {
      id: crypto.randomUUID(),
      module_id: moduleId,
      staff_id: authProfile.id,
      status: 'joined',
      current_step_order: 1
    };

    const { error } = await supabase.from('module_enrollments').insert([{
      id: newEnrollment.id,
      module_id: newEnrollment.module_id,
      staff_id: newEnrollment.staff_id,
      status: newEnrollment.status,
      current_step_order: newEnrollment.current_step_order
    }]);

    if (error) {
      alert('Failed to join module: ' + error.message);
      return;
    }

    setEnrollments(prev => [...prev, newEnrollment]);
  }, [authProfile]);

  const handleCompleteStep = useCallback(async (moduleId: string, stepOrder: number) => {
    if (!authProfile?.id) return;
    
    const enrollment = enrollments.find(e => e.module_id === moduleId && e.staff_id === authProfile.id);
    if (!enrollment) return;

    const moduleStepsForThis = moduleSteps.filter(s => s.module_id === moduleId);
    const isLastStep = stepOrder === Math.max(...moduleStepsForThis.map(s => s.step_order));
    
    const nextStepOrder = stepOrder + 1;
    const newStatus = isLastStep ? 'completed' : 'in-progress';
    const completedAt = isLastStep ? getKLTime() : undefined;

    const { error } = await supabase.from('module_enrollments')
      .update({ 
        current_step_order: nextStepOrder,
        status: newStatus,
        completed_at: completedAt
      })
      .eq('id', enrollment.id);

    if (error) {
      alert('Failed to update progress: ' + error.message);
      return;
    }

    if (isLastStep) {
      const mod = modules.find(m => m.id === moduleId);
      if (mod) {
        const points = mod.meritValue;
        const staffName = authProfile.full_name || 'Staff Member';
        
        const logEntry: ActivityLog = {
          id: crypto.randomUUID(),
          type: 'points_earned',
          desc: `Coursework Accomplished: ${mod.title}`,
          points: points,
          timestamp: getKLTime(),
          staffName: staffName,
          staffId: authProfile.id,
          managerViewed: false
        };

        setActivityLog(prev => [logEntry, ...prev]);
        await supabase.from('activity_log').insert([{
          id: logEntry.id,
          type: logEntry.type,
          desc: logEntry.desc,
          points: logEntry.points,
          timestamp: logEntry.timestamp,
          staff_name: logEntry.staffName,
          staff_id: logEntry.staffId,
          manager_viewed: false
        }]);

        const { data: pData } = await supabase.from('profiles').select('total_points').eq('id', authProfile.id).single();
        const currentPts = pData?.total_points || 0;
        await supabase.from('profiles').update({ total_points: currentPts + points }).eq('id', authProfile.id);
        
        setTeam(prev => prev.map(m => m.id === authProfile.id ? { ...m, monthPoints: m.monthPoints + points } : m));
        alert(`Congratulations! You've completed ${mod.title} and earned ${points} merit points.`);
      }
    }

    setEnrollments(prev => prev.map(e => e.id === enrollment.id ? { 
      ...e, 
      current_step_order: nextStepOrder, 
      status: newStatus as any,
      completed_at: completedAt
    } : e));
  }, [authProfile, enrollments, moduleSteps, modules]);

  const handleUpdateProfile = async (newProfile: StaffProfile) => {
    setProfile(newProfile);
    if (isLoggedIn && authProfile) {
      setAuthProfile((prev: any) => ({ ...prev, full_name: newProfile.name, photo_url: newProfile.photoUrl }));
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      
      if (!authProfile.id || !isUUID(authProfile.id)) {
        alert('Profile updated locally. (Note: Guest accounts do not sync to database)');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: newProfile.name,
          department: newProfile.department,
          employment_type: newProfile.employmentType,
          designation: newProfile.designation,
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

  const handleDeleteAvatar = async (currentPhotoUrl: string) => {
    if (!currentPhotoUrl) return;
    try {
      const parts = currentPhotoUrl.split('/avatars/');
      if (parts.length > 1) {
        const filePath = parts[1];
        await supabase.storage.from('avatars').remove([filePath]);
      }
      setProfile(prev => ({ ...prev, photoUrl: '' }));
      if (authProfile) {
        setAuthProfile((prev: any) => ({ ...prev, photo_url: null }));
        await supabase.from('profiles').update({ photo_url: null }).eq('id', authProfile.id);
      }
    } catch (e: any) {
      console.error('Delete avatar error', e);
    }
  };

  const resolveAppeal = async (appealId: string, finalPoints: number, message: string) => {
    setAppeals(prev => prev.map(a => a.id === appealId ? { ...a, resolved: true, finalPoints, resolutionMessage: message } : a));
    const { error } = await supabase.from('appeals').update({ resolved: true, final_points: finalPoints, resolution_note: message }).eq('id', appealId);
    if (error) console.error('[appeals] resolve error:', error);
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`SECURITY WARNING: You are about to permanently purge ${name} and all associated metadata (tasks, efficiency logs, points). This cannot be reversed. Proceed?`)) return;
    
    try {
      await supabase.from('tasks').delete().eq('staff_id', id);
      await supabase.from('appeals').delete().eq('staff_id', id);
      await supabase.from('reward_redemptions').delete().eq('user_id', id);
      await supabase.from('activity_log').delete().eq('staff_id', id);
      
      // Delete Profile
      const { error, count } = await supabase.from('profiles').delete({ count: 'exact' }).eq('id', id);
      
      if (error) {
        console.error('Delete error:', error);
        alert('Delete Failure: ' + error.message);
      } else if (count === 0) {
        alert('Delete Failure: Profile not found in database or permission denied.');
      } else {
        alert(`Purge Complete: ${name} removed from registry.`);
        // Local state cleanup
        setTeam(prev => prev.filter(t => t.id !== id));
        setTasks(prev => prev.filter(t => t.ownerId !== id));
        setAppeals(prev => prev.filter(a => a.staffId !== id));
        setActivityLog(prev => prev.filter(a => a.staffId !== id));
        setFlaggedTasks(prev => prev.filter(t => t.staff_id !== id));
      }
    } catch (e: any) {
      alert('Critical Error during deletion: ' + e.message);
    }
  };

  const handleResolveFlag = async (taskId: string) => {
    const { error } = await supabase.from('tasks').update({ is_flagged: false }).eq('id', taskId);
    if (!error) {
      setFlaggedTasks(prev => prev.filter(t => t.id !== taskId));
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isFlagged: false } : t));
    } else {
      alert('Failed to resolve flag: ' + error.message);
    }
  };

  const handleMarkTaskViewed = async (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, managerViewed: true } : t));
    await supabase.from('tasks').update({ manager_viewed: true }).eq('id', taskId);
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

  // ——— Auth Handling ———
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const aid = (form.elements.namedItem('accessId') as HTMLInputElement).value;
    const pass = (form.elements.namedItem('passcode') as HTMLInputElement).value;
    
    if(aid === 'ecaworkspace' && pass === '123456') {
      const { data: mData } = await supabase.from('profiles').select('*').eq('access_id', aid).maybeSingle();
      setIsLoggedIn(true);
      if (mData) {
        setAuthProfile(mData);
        setProfile({
          name: mData.full_name || '',
          department: mData.department || 'Management',
          employmentType: mData.employment_type || 'Staff',
          designation: mData.designation || 'Admin',
          photoUrl: mData.photo_url || "https://i.pravatar.cc/150"
        });
      } else {
        const guestProfile = { 
          id: '00000000-0000-0000-0000-000000000000', 
          is_manager: true, 
          role: 'Manager', 
          full_name: 'ECA Workspace', 
          access_id: aid,
          name: 'ECA Workspace',
          designation: 'Admin',
          department: 'Management',
          employmentType: 'Staff' as const,
          photoUrl: ''
        };
        setAuthProfile(guestProfile);
        setProfile(guestProfile);
      }
      setActiveView('manager');
    } else {
      const { data, error } = await supabase.from('profiles').select('*').eq('access_id', aid).eq('passcode', pass).single();
      if (data) {
        setIsLoggedIn(true);
        setAuthProfile(data);
        setProfile({
          name: data.full_name || '',
          department: data.department || 'General',
          employmentType: data.employment_type || 'Staff',
          designation: data.designation || 'Staff',
          photoUrl: data.photo_url || "https://i.pravatar.cc/150"
        });
        setActiveView(data.is_manager ? 'manager' : 'staff');
      } else {
        alert('Invalid Access ID or Passcode');
      }
    }
  };

  const currentProfile = (authProfile || { ...profile, is_manager: false, id: 'local' }) as UserAuthProfile;
  const currentUserId = authProfile?.id || authProfile?.access_id || 'local';

  // ——— Data Isolation: Only show tasks owned by or shared with current user ———
  const visibleTasks = tasks.filter(task => {
    // No owner stamp = legacy/auto-assigned task, always visible to creator
    if (!task.ownerId) return true;
    // Owner always sees their own tasks
    if (task.ownerId === currentUserId) return true;
    // Collaborators see tasks they've been invited to
    if (task.collaboratorIds && task.collaboratorIds.includes(currentUserId)) return true;
    return false;
  });

  // ——— Staff list for collaborator dropdown (exclude self) ———
  const collaboratorStaffList = useMemo(() => team
    .filter(t => t.id !== currentUserId)
    .map(t => ({ id: t.id, name: t.name })), [team, currentUserId]);

  const todayTasks = useMemo(() => {
    if (!klTodayStr) return visibleTasks; // Before hydration, show all tasks
    return visibleTasks.filter(t => {
      if (!t.commencementDate) return true;
      return t.commencementDate.split('T')[0] <= klTodayStr;
    });
  }, [visibleTasks, klTodayStr]);

  // ——— Derived State (depends on visibleTasks ——— must be after) ———
  const getStartOfWeek = () => {
    const now = new Date();
    const day = now.getDay(); // 0 is Sunday, 1 is Monday...
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const startOfWeek = getStartOfWeek();
  const weeklyPoints = visibleTasks
    .filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt) >= startOfWeek)
    .reduce((s, t) => s + (t.points || 0), 0);

  const completedPoints = visibleTasks.filter(t => t.status === 'completed').reduce((s, t) => s + t.points, 0);
  const weeklyEfficiency = visibleTasks.filter(t => t.status === 'completed' && t.efficiencyScore).length > 0 
    ? visibleTasks.filter(t => t.status === 'completed' && t.efficiencyScore).reduce((acc, t) => acc + Number(t.efficiencyScore), 0) / visibleTasks.filter(t => t.status === 'completed' && t.efficiencyScore).length
    : 1.0;
  const lifetimePoints = completedPoints; // starting at 0 for fresh app
  const pendingAppealsCount = appeals.filter(a => !a.resolved).length;

  const displayRedemptionsBadge = pendingRedemptionsCount > ackRedemptions ? pendingRedemptionsCount - ackRedemptions : 0;
  // Badge shows count of NEW unresolved appeals the manager hasn't viewed yet
  const displayAppealsBadge = Math.max(0, pendingAppealsCount - ackAppeals);

  // ——— Red Dot: Count tasks or activities that the manager hasn't viewed yet ———
  // A staff card click via markViewed() bulk-clears all their tasks → count drops to 0 → dot disappears
  const unviewedActivityCount = activityLog.filter(a => a.managerViewed === false).length;
  const unviewedTaskCount = tasks.filter(t => t.managerViewed === false).length;
  const hasNewActivity = unviewedActivityCount > 0 || unviewedTaskCount > 0;

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
                <input type="password" name="passcode" required className="w-full bg-surface-container rounded-2xl py-4 px-5 outline-none border border-outline-variant/5 text-on-surface font-bold focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all" placeholder="••••••" />
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
          localStorage.clear(); // Clear session
        }}
        isManager={currentProfile.is_manager}
        pendingRedemptions={displayRedemptionsBadge}
        pendingAppeals={displayAppealsBadge}
        hasNewActivity={hasNewActivity}
      />

      {/* ——————————————————————————————————————————————————————————————————————————————————————————————————————————
          VIEW: STAFF DASHBOARD
      —————————————————————————————————————————————————————————————————————————————————————————————————————————— */}
      {activeView === 'staff' && (
        <main className="pt-24 sm:pt-28 px-4 sm:px-6 max-w-6xl mx-auto pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Duty Reminder Notification */}
          {showDutyReminder && (
            <div className="mb-8 bg-amber-500/10 border border-amber-500/20 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 animate-in slide-in-from-top-4 duration-500 shadow-lg shadow-amber-500/5">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-500 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                <span className="material-symbols-outlined text-white text-2xl sm:text-3xl animate-bounce">notifications_active</span>
              </div>
              <div className="flex-1">
                <h4 className="text-amber-600 text-[10px] sm:text-sm font-black uppercase tracking-widest mb-1">Shift Over-Run Detected</h4>
                <p className="text-on-surface-variant text-xs sm:text-sm font-bold leading-relaxed">
                  It's past 17:30. You have active tasks running. Please <span className="text-amber-700 underline">Pause</span> or <span className="text-primary underline">Complete</span> them before heading off-duty.
                </p>
              </div>
              <button 
                onClick={() => setShowDutyReminder(false)}
                className="absolute top-4 right-4 sm:static w-8 h-8 sm:w-10 sm:h-10 rounded-full hover:bg-amber-500/10 flex items-center justify-center text-amber-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">close</span>
              </button>
            </div>
          )}


          {/* Merit Summary Card */}
          <section className="mb-8 sm:mb-12">
            <div className="merit-card-pattern rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
              <div className="relative z-10 w-full">
                <div className="flex justify-center mb-4 sm:mb-6">
                  <div className="bg-white/10 p-2 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/20">
                    <span className="material-symbols-outlined text-white text-2xl sm:text-3xl font-light">analytics</span>
                  </div>
                </div>
                
                <p className="text-[9px] sm:text-[11px] uppercase font-black tracking-[0.3em] opacity-60 mb-2 sm:mb-3">Weekly Performance Hub</p>
                <h2 className="text-4xl sm:text-6xl font-black font-headline tracking-tight mb-2">
                  {weeklyPoints.toLocaleString()} <span className="text-lg sm:text-xl font-medium opacity-40 -ml-2">/ {meritConfig.weeklyThreshold || 975} Points</span>
                </h2>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mt-4 sm:mt-6">
                  <div className="flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
                    <span className="material-symbols-outlined text-[12px] sm:text-[14px] text-emerald-400">bolt</span>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Efficiency: {Math.round(weeklyEfficiency * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
                    <span className="material-symbols-outlined text-[12px] sm:text-[14px] text-amber-400">schedule</span>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Resets Every Monday</span>
                  </div>
                </div>
                <div className="w-full max-w-xs sm:max-w-md mx-auto bg-black/20 rounded-full h-1.5 sm:h-2 mt-4 sm:mt-6 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${weeklyPoints >= (meritConfig.weeklyThreshold || 975) ? 'bg-emerald-400' : 'bg-white'}`} style={{ width: `${Math.min(100, (weeklyPoints / (meritConfig.weeklyThreshold || 975)) * 100)}%` }} />
                </div>
                <p className="text-[8px] sm:text-[10px] font-bold mt-2 opacity-70 uppercase tracking-wider">Goal: {meritConfig.weeklyThreshold || 975} pts (0.5 pts/min base)</p>
                <div className="inline-flex items-center gap-2 bg-black/10 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/5 mt-4">
                  <p className="text-[10px] sm:text-xs font-bold opacity-70">Lifetime:</p>
                  <p className="text-[10px] sm:text-xs font-black text-white">{lifetimePoints.toLocaleString()} Points</p>
                </div>

                <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-8 sm:mt-12 max-w-lg mx-auto">
                  <div 
                    onClick={() => document.getElementById('today-itinerary-heading')?.scrollIntoView({ behavior: 'smooth' })}
                    className="bg-white/5 rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <p className="text-[7px] sm:text-[9px] uppercase font-black tracking-widest opacity-60 mb-1 sm:mb-2 group-hover:text-white transition-colors">Active</p>
                    <p className="text-xl sm:text-2xl font-black font-headline">{todayTasks.filter(t => t.status === 'running').length.toString().padStart(2, '0')}</p>
                  </div>
                  <div 
                    onClick={() => document.getElementById('today-itinerary-heading')?.scrollIntoView({ behavior: 'smooth' })}
                    className="bg-white/5 rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <p className="text-[7px] sm:text-[9px] uppercase font-black tracking-widest opacity-60 mb-1 sm:mb-2 group-hover:text-white transition-colors">Queue</p>
                    <p className="text-xl sm:text-2xl font-black font-headline">{todayTasks.filter(t => t.status === 'queued').length.toString().padStart(2, '0')}</p>
                  </div>
                  <div 
                    onClick={() => setCompletedTasksOpen(true)}
                    className="bg-white/5 rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <p className="text-[7px] sm:text-[9px] uppercase font-black tracking-widest opacity-60 mb-1 sm:mb-2 group-hover:text-white transition-colors">Done</p>
                    <p className="text-xl sm:text-2xl font-black font-headline">{todayTasks.filter(t => t.status === 'completed').length.toString().padStart(2, '0')}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          

          {/* —————————————————————————————————————————— 2-Column Layout: Task Timeline + Mission Brief Sidebar —————————————————————————————————————————— */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 sm:gap-10 items-start">


            {/* LEFT: Task Timeline */}
            <div>
              {/* Planner Header */}
              <div className="flex justify-between items-end mb-8 px-2 mt-6">
                <div>
                  <h3 id="today-itinerary-heading" className="text-2xl font-black text-on-surface font-headline tracking-tight">Today's Itinerary</h3>
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
                  Tasks visible only to you · Add collaborators to share
                </div>
              </div>

              {/* Calendar Timeline Layout */}
              <div className="relative pl-8 pb-10">
                {/* Vertical timeline spine */}
                <div className="absolute left-3 top-4 bottom-0 w-[2px] bg-gradient-to-b from-primary/30 via-tertiary/20 to-transparent rounded-full" />
                
                {todayTasks.filter(t => t.status !== 'completed').length === 0 && (
                  <div className="text-center py-12 rounded-3xl border-2 border-dashed border-outline-variant text-on-surface-variant relative z-10 bg-surface-container-lowest">
                    <span className="material-symbols-outlined text-[48px] mb-3 block opacity-30 text-primary">event_available</span>
                    <p className="font-bold text-lg">Schedule Cleared</p>
                    <p className="text-sm mt-1 opacity-70">Use your Role Mission Brief →  to plan today's tasks.</p>
                  </div>
                )}
                
                {(() => {
                  const activeTodayTasks = todayTasks.filter(t => t.status !== 'completed');
                  
                  const sortTasks = (tasks: Task[]) => [...tasks].sort((a, b) => {
                    const priority: Record<string, number> = { 'running': 1, 'paused': 2, 'queued': 3 };
                    if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
                    const dateA = a.commencementDate ? new Date(a.commencementDate).getTime() : 0;
                    const dateB = b.commencementDate ? new Date(b.commencementDate).getTime() : 0;
                    if (dateA !== dateB) return dateA - dateB;
                    return 0;
                  });

                  const ongoingTasks = sortTasks(activeTodayTasks.filter(t => t.status === 'running' || t.status === 'paused'));
                  const queuedTasks = sortTasks(activeTodayTasks.filter(t => t.status === 'queued'));

                  const groups = [
                    { title: 'On-Going Tasks', subtitle: 'Currently Active & Paused', icon: 'play_circle', tasks: ongoingTasks },
                    { title: 'Queue Tasks', subtitle: 'Scheduled & Pending', icon: 'list_alt', tasks: queuedTasks }
                  ];

                  return groups.map((group) => {
                    if (group.tasks.length === 0) return null;
                    return (
                      <div key={group.title} className="mb-12 relative">
                        {/* Group Header */}
                        <div className="flex items-center gap-3 mb-6 relative z-10 -ml-5 bg-surface-container-lowest/90 backdrop-blur-sm p-3 rounded-2xl border border-outline-variant/10 shadow-sm w-fit">
                          <div className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-inner">
                            <span className="material-symbols-outlined text-[20px]">{group.icon}</span>
                          </div>
                          <div className="pr-3">
                            <h4 className="text-lg font-black text-on-surface font-headline leading-tight tracking-tight">{group.title}</h4>
                            <p className="text-[9px] uppercase font-bold tracking-widest text-on-surface-variant opacity-70">{group.subtitle}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-6">
                        {group.tasks.map((task, idx) => {
                  const pct = task.totalSec > 0 ? Math.min(100, Math.round((task.elapsedSec / task.totalSec) * 100)) : 0;
                  const pctLeft = 100 - pct;
                  const remaining = Math.max(0, task.totalSec - task.elapsedSec);
                  const isActive = task.status === 'running';
                  const isPaused = task.status === 'paused';
                  const isDone = task.status === 'completed';
                  const showTimer = isActive || isPaused;

                  let timerTextColor = 'text-primary';
                  let timerBarColor = 'bg-primary';
                  if (!task.isContinuous) {
                    if (pctLeft <= 10) {
                      timerTextColor = 'text-error animate-pulse';
                      timerBarColor = 'bg-error shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse';
                    } else if (pctLeft <= 30) {
                      timerTextColor = 'text-amber-500';
                      timerBarColor = 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
                    }
                  }

                  return (
                    <div key={task.id} className="relative mb-6 group">
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[27px] top-6 w-[18px] h-[18px] rounded-full border-[3px] border-surface shadow-sm z-10 flex items-center justify-center transition-all ${
                        isActive ? 'bg-primary ring-4 ring-primary/20 scale-125' : 
                        isPaused ? 'bg-amber-500 ring-4 ring-amber-500/20 scale-125' :
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
                        {isPaused && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />}

                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-2 flex-wrap">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                              isActive ? 'bg-primary text-white shadow-sm' : 
                              isPaused ? 'bg-amber-500 text-white shadow-sm' :
                              isDone ? 'bg-surface-container text-on-surface-variant' : 
                              'bg-surface-container-high text-on-surface-variant'
                            }`}>
                              {isActive ? '● IN PROGRESS' : isPaused ? 'Ⅱ PAUSED' : isDone ? '✓ COMPLETED' : '○ SCHEDULED'}
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
                                  ? task.frequency.days.sort().map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join('·')
                                  : 'Weekly'}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-primary font-black font-headline text-lg">
                              {task.isContinuous ? (
                                <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[18px]">all_inclusive</span> Cont.</span>
                              ) : (
                                <>+{task.points} <span className="text-[10px] text-on-surface-variant opacity-70">PTS</span></>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className={`flex justify-between items-start gap-4 mb-2 ${editingWorkflowTaskId === task.id ? 'opacity-30 pointer-events-none' : ''}`}>
                          <h4 className={`font-black text-on-surface text-xl tracking-tight ${isDone && 'line-through decoration-on-surface-variant/30'}`}>
                            {task.title}
                          </h4>
                          {isDone && task.efficiencyScore !== undefined && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              <div className={`flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full w-fit`}>
                                <span className="material-symbols-outlined text-[12px] text-emerald-500">bolt</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                                  Efficiency: {Math.round(task.efficiencyScore * 100)}% ({Number(task.efficiencyScore).toFixed(2)}x)
                                </span>
                              </div>
                              {task.isFlagged && (
                                <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1 rounded-full w-fit">
                                  <span className="material-symbols-outlined text-[12px] text-amber-500">warning</span>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                                    Audit Pending
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex gap-1.5 shrink-0">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingWorkflowTaskId(editingWorkflowTaskId === task.id ? null : task.id); }} 
                              className={`transition-all rounded-full w-8 h-8 flex items-center justify-center shrink-0 ${editingWorkflowTaskId === task.id ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:text-primary bg-surface-container-high'}`}
                              title="Add Workflow Steps"
                            >
                              <span className="material-symbols-outlined text-[16px]">{editingWorkflowTaskId === task.id ? 'done' : 'edit_note'}</span>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleEditTaskUI(task); }} 
                              className="text-on-surface-variant hover:text-primary transition-colors bg-surface-container-high rounded-full w-8 h-8 flex items-center justify-center shrink-0"
                              title="Edit Task"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id, task.title); }} className="text-on-surface-variant hover:text-error transition-colors bg-surface-container-high rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>
                        {task.note && <p className={`text-on-surface-variant text-sm mb-5 opacity-80 leading-relaxed font-medium ${editingWorkflowTaskId === task.id ? 'opacity-10 pointer-events-none' : ''}`}>{task.note}</p>}

                        {/* Collaborators */}
                        {task.collaborators && task.collaborators.length > 0 && (
                          <div className={`flex flex-wrap gap-2 mb-4 ${editingWorkflowTaskId === task.id ? 'opacity-10 pointer-events-none' : ''}`}>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center pr-1">Collaborators:</span>
                            {(() => {
                               let displayCollaborators = [...task.collaborators];
                               if (currentProfile && task.ownerId !== currentProfile.id) {
                                   // exclude current user's name
                                   displayCollaborators = displayCollaborators.filter(c => c !== currentProfile.full_name && c !== currentProfile.name);
                                   // add task owner's name
                                   const ownerName = team.find(t => t.id === task.ownerId)?.name || 'Task Owner';
                                   if (!displayCollaborators.includes(ownerName)) {
                                     displayCollaborators.unshift(ownerName);
                                   }
                               }
                               return displayCollaborators.map((c, i) => (
                                 <span key={i} className="text-[10px] font-bold px-2 py-1 rounded bg-secondary/10 text-secondary">{c}</span>
                               ));
                            })()}
                          </div>
                        )}

                        {/* Workflow Visualization */}
                        {task.workflow && task.workflow.length > 0 && (
                          <div className="mb-5 bg-slate-50/50 dark:bg-slate-800/50 p-5 rounded-2xl border border-outline-variant/10 shadow-inner">
                            <p className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant mb-4 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">account_tree</span> Workflow Breakdown
                              {editingWorkflowTaskId === task.id && <span className="ml-auto text-primary animate-pulse">Editing Mode</span>}
                            </p>
                            
                            {/* Inline Step Adder */}
                            {editingWorkflowTaskId === task.id && (
                              <div className="flex gap-2 mb-4 animate-in slide-in-from-top-2 duration-300">
                                <input 
                                  value={newWorkflowStepName}
                                  onChange={e => setNewWorkflowStepName(e.target.value)}
                                  onKeyDown={e => { if(e.key === 'Enter') addWorkflowStep(task.id); }}
                                  placeholder="Define new workflow step..."
                                  className="flex-1 bg-white rounded-xl py-2.5 px-4 outline-none border border-primary/20 text-xs font-bold focus:border-primary transition-all shadow-sm"
                                  autoFocus
                                />
                                <button 
                                  onClick={() => addWorkflowStep(task.id)}
                                  className="bg-primary text-white px-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-primary/10"
                                >
                                  Add
                                </button>
                              </div>
                            )}

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
                                      disabled={isDone}
                                      className={`w-6 h-6 mt-0.5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                                        step.isCompleted ? 'bg-primary border-primary text-white shadow-md shadow-primary/20' : 
                                        !isDone ? 'border-primary bg-white hover:bg-primary/5' : 'border-outline-variant/30 bg-surface-container opacity-50 cursor-not-allowed'
                                      }`}
                                    >
                                      {step.isCompleted && <span className="material-symbols-outlined text-[12px] font-bold">check</span>}
                                    </button>
                                    <span 
                                      className={`text-sm font-bold pt-0.5 outline-none ${step.isCompleted ? 'text-on-surface-variant line-through opacity-70' : 'text-on-surface'}`}
                                      contentEditable={!step.isCompleted}
                                      suppressContentEditableWarning={true}
                                      onBlur={(e) => {
                                        if (e.currentTarget.textContent) {
                                          updateWorkflowStepName(task.id, step.id, e.currentTarget.textContent);
                                        }
                                      }}
                                    >
                                      {step.name}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sentinel Warning */}
                        {task.sentinelReminder && task.status === 'running' && (
                          <div className="bg-error/5 border border-error/10 p-3 rounded-xl mb-4 flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                            <span className="material-symbols-outlined text-error text-[20px] animate-pulse">emergency_home</span>
                            <div className="flex-1">
                              <p className="text-error text-[10px] font-black uppercase tracking-wider">Task Sentinel: Action Required</p>
                              <p className="text-on-surface-variant text-[11px] font-bold leading-tight">This process has exceeded its calibrated "Golden Rule" duration. High efficiency points are no longer available. Please finalize or halt this task immediately.</p>
                            </div>
                          </div>
                        )}

                        {/* Progress / Timer Section */}
                        {showTimer && (
                           <div className={`bg-white rounded-2xl p-4 border mb-4 shadow-sm transition-all ${isPaused ? 'border-amber-500/20 grayscale-[0.5]' : 'border-primary/10'}`}>
                               <div className="flex justify-between text-xs font-bold mb-2">
                                 <span className={`${isPaused ? 'text-amber-600' : 'text-primary'} flex items-center gap-1`}>
                                   <span className="material-symbols-outlined text-[14px]">{isPaused ? 'pause_circle' : 'timer'}</span> 
                                   {isPaused ? 'Paused' : 'Running'}
                                   {task.goldenRuleMinutes && (
                                     <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded ${remaining > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-error/10 text-error animate-pulse'}`}>
                                       Standard: {task.goldenRuleMinutes}m
                                     </span>
                                   )}
                                 </span>
                                 <span className={`font-mono ${timerTextColor}`}>
                                   {task.isContinuous ? (
                                     <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">timer</span> {fmt(task.elapsedSec)} elapsed</span>
                                   ) : (
                                     <>{fmt(remaining)} {remaining > 0 ? 'left' : 'over'}</>
                                   )}
                                 </span>
                               </div>
                               <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                                 <div className={`h-full rounded-full transition-all duration-1000 striped-progress ${timerBarColor}`} style={!task.isContinuous ? { width: `${pct}%` } : undefined} />
                               </div>
                            </div>
                        )}

                        {!showTimer && !isDone && (
                          <div className="flex items-center gap-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">
                             <span className="material-symbols-outlined text-[14px]">schedule</span>
                             {task.isContinuous ? 'Continuous Activity' : `Allocated Time: ${Math.round(task.totalSec / 60)} minutes`}
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
                             <>
                               <button onClick={() => completeTask(task.id)} className="flex-[2] bg-primary text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 mission-gradient active:scale-95 hover:brightness-110">
                                 <span className="material-symbols-outlined text-[16px]">check_circle</span> Mark Done
                               </button>
                               <button onClick={() => pauseTask(task.id)} className="flex-1 bg-surface-container-high text-on-surface py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center gap-2">
                                 <span className="material-symbols-outlined text-[16px]">pause</span> Pause
                               </button>
                             </>
                           )}
                           {task.status === 'paused' && (
                             <>
                               <button onClick={() => startTask(task.id)} className="flex-[2] bg-amber-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 hover:brightness-110">
                                 <span className="material-symbols-outlined text-[16px]">play_arrow</span> Resume
                               </button>
                               <button onClick={() => completeTask(task.id)} className="flex-1 bg-primary/10 text-primary py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2">
                                 <span className="material-symbols-outlined text-[16px]">check_circle</span> End
                               </button>
                             </>
                           )}
                           {task.status !== 'completed' && (
                             <button onClick={async () => {
                               const msg = prompt('Enter your evidence/reasoning for this dispute:');
                               if(msg) {
                                 const newId = crypto.randomUUID();
                                  const newAppeal: AppealItem = { 
                                    id: newId, 
                                     staffId: authProfile?.id,
                                    staffName: currentProfile.name || authProfile?.full_name || 'Staff', 
                                    department: currentProfile.department || 'General', 
                                    taskTitle: task.title, 
                                    originalPoints: task.points, 
                                    appealComment: msg, 
                                    imgUrl: currentProfile.photoUrl || currentProfile.photo_url || "https://i.pravatar.cc/150", 
                                    resolved: false 
                                  };
                                  setAppeals(prev => [...prev, newAppeal]);
                                  
                                  const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');
                                  await supabase.from('appeals').insert([{
                                    id: newId,
                                    staff_id: isValidUUID(authProfile?.id || '') ? authProfile?.id : null,
                                    staff_name: newAppeal.staffName,
                                    department: newAppeal.department,
                                    task_title: newAppeal.taskTitle,
                                    original_points: newAppeal.originalPoints,
                                    appeal_comment: newAppeal.appealComment,
                                    img_url: newAppeal.imgUrl,
                                    resolved: false
                                  }]);
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
                })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Prominent Dedicated Section: Previous Completed Tasks */}
              {(() => {
                const completedList = [...visibleTasks].filter(t => t.status === 'completed').sort((a, b) => {
                  const da = a.lastCompletedDate || a.commencementDate || '';
                  const db = b.lastCompletedDate || b.commencementDate || '';
                  return db.localeCompare(da);
                });

                if (completedList.length === 0) {
                  return (
                    <div className="mt-12 pt-8 border-t border-outline-variant/10">
                      <div className="mb-6">
                        <h3 className="text-2xl font-black text-on-surface font-headline tracking-tight flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[28px]">task_alt</span>
                          Previous Completed Tasks
                        </h3>
                        <p className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant mt-1 opacity-60">Verified Activity Ledger</p>
                      </div>
                      <div className="text-center py-10 rounded-3xl border border-outline-variant/10 bg-surface-container-lowest/40 backdrop-blur-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-[40px] mb-3 block opacity-20">history</span>
                        <p className="font-bold text-sm">No completed tasks recorded yet.</p>
                      </div>
                    </div>
                  );
                }

                // Apply Search & Filter
                let filteredList = completedList;
                if (archiveSearchQuery.trim()) {
                  filteredList = filteredList.filter(t => (t.title || '').toLowerCase().includes(archiveSearchQuery.toLowerCase()) || (t.note && t.note.toLowerCase().includes(archiveSearchQuery.toLowerCase())));
                }
                if (archiveFilter !== 'All') {
                  if (archiveFilter === 'High Tier') {
                    filteredList = filteredList.filter(t => (t.tierName || '').toLowerCase().includes('tier 3') || (t.tierName || '').toLowerCase().includes('tier 4'));
                  } else if (archiveFilter === 'Flagged') {
                    filteredList = filteredList.filter(t => t.isFlagged);
                  }
                }

                // Apply limit
                const displayedList = filteredList.slice(0, archiveDisplayLimit);

                // Group by formatted date string
                const groups: Record<string, Task[]> = {};
                displayedList.forEach(t => {
                  const dStr = t.lastCompletedDate || t.commencementDate || '';
                  let dateLabel = 'Archived Missions';
                  if (dStr) {
                    const d = new Date(dStr);
                    if (!isNaN(d.getTime())) {
                      dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }
                  }
                  if (!groups[dateLabel]) groups[dateLabel] = [];
                  groups[dateLabel].push(t);
                });

                return (
                  <div className="mt-12 pt-8 border-t border-outline-variant/10 animate-in fade-in duration-500">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                      <div>
                        <h3 className="text-2xl font-black text-on-surface font-headline tracking-tight flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-primary text-[28px]">verified</span>
                          Completed Archive
                        </h3>
                        <p className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant mt-1 opacity-60">Verified Activity Ledger ({completedList.length} Total)</p>
                      </div>
                      
                      {/* Filter Bar UI */}
                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/50">search</span>
                          <input 
                            type="text" 
                            placeholder="Search missions..." 
                            value={archiveSearchQuery}
                            onChange={(e) => setArchiveSearchQuery(e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-full py-2 pl-9 pr-4 text-xs font-medium text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all shadow-sm placeholder:text-on-surface-variant/40"
                          />
                        </div>
                        <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-full border border-outline-variant/10 shadow-inner">
                          {['All', 'High Tier', 'Flagged'].map(f => (
                            <button 
                              key={f}
                              onClick={() => setArchiveFilter(f)}
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${archiveFilter === f ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      {Object.entries(groups).map(([dateStr, groupTasks]) => (
                        <div key={dateStr} className="relative pl-4 border-l-2 border-primary/20 space-y-4">
                          {/* Date Header Group Badge */}
                          <div className="sticky top-0 z-10 -ml-8 mb-4 flex items-center gap-3">
                            <div className="bg-primary text-white p-1 rounded-full shadow-md shadow-primary/20">
                              <span className="material-symbols-outlined text-[12px] block">calendar_month</span>
                            </div>
                            <div className="bg-surface-container-low/90 backdrop-blur-md border border-outline-variant/10 shadow-sm px-4 py-1.5 rounded-xl flex items-center gap-2">
                              <span className="text-xs font-black text-on-surface tracking-wide">{dateStr}</span>
                              <span className="text-[9px] font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-md opacity-80">
                                {groupTasks.length} {groupTasks.length === 1 ? 'task' : 'tasks'}
                              </span>
                            </div>
                          </div>

                          {/* Task list for this date */}
                          <div className="grid grid-cols-1 gap-4">
                            {groupTasks.map(task => (
                              <div 
                                key={task.id} 
                                className="group/item bg-surface-container-lowest/80 hover:bg-surface-container-lowest border border-outline-variant/10 hover:border-primary/20 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                              >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/40 to-tertiary/20 group-hover/item:from-primary group-hover/item:to-tertiary transition-all" />
                                
                                <div>
                                  <div className="flex justify-between items-start gap-3 mb-2.5">
                                    <h4 className="font-bold text-on-surface text-base tracking-tight group-hover/item:text-primary transition-colors">
                                      {task.title} <span className="opacity-60 text-sm font-semibold ml-1">{task.actualDurationMinutes !== undefined ? `(${Math.round(task.actualDurationMinutes)}min)` : task.elapsedSec ? `(${Math.round(task.elapsedSec / 60)}min)` : ''}</span>
                                    </h4>
                                    <div className="bg-primary/10 text-primary rounded-xl px-2.5 py-1 text-center shrink-0 font-black text-xs border border-primary/10">
                                      +{task.points} <span className="text-[8px] uppercase tracking-widest font-bold opacity-70">PTS</span>
                                    </div>
                                  </div>

                                  {task.note && (
                                    <p className="text-xs text-on-surface-variant/90 line-clamp-2 mb-4 leading-relaxed font-medium">
                                      {task.note}
                                    </p>
                                  )}
                                </div>

                                {/* Bottom strip: EXPLICIT DATE LABEL */}
                                <div className="pt-3 border-t border-outline-variant/5 flex flex-wrap items-center justify-between gap-2 mt-auto">
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container/60 rounded-lg border border-outline-variant/5">
                                    <span className="material-symbols-outlined text-[13px] text-primary">event_available</span>
                                    <span className="text-[10px] font-black tracking-wider text-on-surface uppercase">
                                      Date: <span className="text-primary">{task.lastCompletedDate ? new Date(task.lastCompletedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : dateStr}</span>
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded">
                                      {task.tierName}
                                    </span>
                                    <EfficiencyBadge score={task.efficiencyScore} isFlagged={task.isFlagged} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {filteredList.length > archiveDisplayLimit && (
                      <div className="mt-10 flex justify-center pb-6">
                        <button 
                          onClick={() => setArchiveDisplayLimit(prev => prev + 10)}
                          className="bg-surface-container-lowest border-2 border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-primary text-[11px] font-black uppercase tracking-[0.15em] px-8 py-3.5 rounded-2xl shadow-sm transition-all duration-300 flex items-center gap-2.5 group"
                        >
                          <span className="material-symbols-outlined text-[18px] group-hover:translate-y-1 transition-transform duration-300">expand_more</span>
                          Load More Archive ({filteredList.length - archiveDisplayLimit} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* RIGHT: Role Mission Brief Sidebar */}
            {(() => {
              const roleKey = currentProfile?.role || `${currentProfile?.employmentType}-${currentProfile?.department}`;
              const roleGoals = orgConfig?.autoAssignments?.[roleKey];
              
              return (
                <aside className="lg:sticky lg:top-28 flex flex-col gap-6">
                  {/* Roadmap Widget */}
                  <RoadmapWidget tasks={visibleTasks} klToday={klTodayStr} onEditTask={handleEditTaskUI} />

                  {/* Glowing ambient decoration */}
                  {roleGoals && roleGoals.tasks.length > 0 && (
                  <>
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
                  </>
                  )}
                </aside>
              );
            })()}

          </div>
        </main>
      )}


      {/* ——————————————————————————————————————————————————————————————————————————————————————————————————————————
          VIEW: EXEC DASHBOARD
      —————————————————————————————————————————————————————————————————————————————————————————————————————————— */}
      {activeView === 'manager' && (
        <div className="h-full">
          {/* Mobile Sub-nav */}
          <div className="lg:hidden fixed top-20 left-0 w-full z-40 bg-surface-container-high border-b border-outline-variant overflow-x-auto no-scrollbar">
            <nav className="flex px-4 h-14 items-center gap-4 min-w-max">
              {[
                { key: 'dashboard', icon: 'dashboard', label: 'Overview' },
                { key: 'economy', icon: 'local_play', label: 'Bounty & Rewards' },
                { key: 'calibration', icon: 'monitoring', label: 'Staff Performance' },
                { key: 'resolutions', icon: 'rule', label: 'Resolution Queue', badge: displayAppealsBadge },
                { key: 'org', icon: 'corporate_fare', label: 'Settings' },
              ].map(sub => (
                <button
                  key={sub.key}
                  onClick={() => setManagerSubView(sub.key)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    managerSubView === sub.key ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{sub.icon}</span>
                  {sub.label}
                  {(sub.badge || 0) > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-surface shadow-sm"></span>}
                </button>
              ))}
            </nav>
          </div>

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
            <nav className="flex-1 space-y-6 px-2">
              {/* SECTION: OPERATIONS */}
              <div>
                <p className="px-4 text-[10px] uppercase font-black tracking-widest text-on-surface-variant opacity-40 mb-2">Operations</p>
                <div className="space-y-1">
                  <button 
                    onClick={() => setManagerSubView('dashboard')}
                    className={`w-full text-left px-4 py-2.5 font-bold flex items-center gap-3 cursor-pointer rounded-xl transition-all relative ${
                      managerSubView === 'dashboard' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">dashboard</span>
                    <span className="font-headline text-sm flex-1">Command Center</span>
                    {hasNewActivity && (
                      <span className="w-2 h-2 bg-error rounded-full animate-pulse shadow-sm shadow-error/50">
                        <span className="sr-only">Unread notifications</span>
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={() => setManagerSubView('resolutions')}
                    className={`w-full text-left px-4 py-2.5 font-bold flex items-center gap-3 cursor-pointer rounded-xl transition-all relative ${
                      managerSubView === 'resolutions' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">task_alt</span>
                    <span className="font-headline text-sm flex-1">Resolution Queue</span>
                    {displayAppealsBadge > 0 && (
                      <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-md shadow-error/30 animate-pulse">
                        {displayAppealsBadge}
                        <span className="sr-only">unread appeals</span>
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* SECTION: COMMONS */}
              <div>
                <p className="px-4 text-[10px] uppercase font-black tracking-widest text-on-surface-variant opacity-40 mb-2">Commons</p>
                <div className="space-y-1">


                  <button 
                    onClick={() => setManagerSubView('training')}
                    className={`w-full text-left px-4 py-2.5 font-bold flex items-center gap-3 cursor-pointer rounded-xl transition-all relative ${
                      managerSubView === 'training' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">psychology</span>
                    <span className="font-headline text-sm flex-1">Skill Modules</span>
                  </button>
                </div>
              </div>

              {/* SECTION: STRATEGY */}
              <div>
                <p className="px-4 text-[10px] uppercase font-black tracking-widest text-on-surface-variant opacity-40 mb-2">Strategy</p>
                <div className="space-y-1">
                  <div 
                    onClick={() => setManagerSubView('calibration')}
                    className={`px-4 py-2.5 font-bold flex items-center gap-3 cursor-pointer rounded-xl transition-all ${
                      managerSubView === 'calibration' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">account_balance</span>
                    <span className="font-headline text-sm">Staff Performance</span>
                  </div>

                  <div 
                    onClick={() => setManagerSubView('economy')}
                    className={`px-4 py-2.5 font-bold flex items-center gap-3 cursor-pointer rounded-xl transition-all ${
                      managerSubView === 'economy' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">local_play</span>
                    <span className="font-headline text-sm">Bounty & Rewards</span>
                  </div>
                </div>
              </div>

              {/* SECTION: ADMINISTRATION */}
              <div>
                <p className="px-4 text-[10px] uppercase font-black tracking-widest text-on-surface-variant opacity-40 mb-2">Administration</p>
                <div className="space-y-1">
                  <div 
                    onClick={() => setManagerSubView('personnel')}
                    className={`px-4 py-2.5 font-bold flex items-center gap-3 cursor-pointer rounded-xl transition-all ${
                      managerSubView === 'personnel' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">groups</span>
                    <span className="font-headline text-sm">Personnel</span>
                  </div>
                </div>
              </div>
            </nav>
          </aside>

          {/* Exec Canvas */}
          <main className="pt-[140px] lg:pt-28 pb-32 lg:ml-64 px-6 animate-in fade-in duration-300">
            <div className="max-w-7xl mx-auto">
              {managerSubView === 'dashboard' && <ManagerDashboardView team={team} tasks={tasks} activityLog={activityLog} onDeleteStaff={handleDeleteStaff} onMarkTaskViewed={handleMarkTaskViewed} viewedIds={viewedIds} markViewed={markViewed} isManager={authProfile?.is_manager} flaggedTasks={flaggedTasks} onResolveFlag={handleResolveFlag} onPauseTask={pauseTask} meritConfig={meritConfig} />}

              {managerSubView === 'calibration' && <StaffExecutionReport team={team} />}
              {managerSubView === 'personnel' && <ManagerOrgView config={orgConfig} setConfig={setOrgConfig} onDeleteStaff={handleDeleteStaff} team={team} setTeam={setTeam} onSaveRoleSync={handleSaveRoleSync} viewedIds={viewedIds} markViewed={markViewed} meritConfig={meritConfig} setMeritConfig={setMeritConfig} />}
              {managerSubView === 'economy' && currentProfile?.is_manager && <EconomyManagerPage onBack={() => setManagerSubView('dashboard')} viewedIds={viewedIds} markViewed={markViewed} tasks={tasks} />}
              {managerSubView === 'training' && (
                <SkillsView 
                  modules={modules} 
                  setAddModuleOpen={setAddModuleOpen} 
                  isManager={true} 
                  onRemoveModule={handleDeleteModule}
                  enrollments={enrollments}
                  moduleSteps={moduleSteps}
                  onJoinModule={handleJoinModule}
                  onCompleteStep={handleCompleteStep}
                  authProfile={authProfile}
                />
              )}
              {managerSubView === 'resolutions' && (
                <div className="pt-10 px-6 max-w-4xl mx-auto pb-32 animate-in fade-in duration-300">
                  <div className="mb-10">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] mb-2 text-primary">Operational Oversight</p>
                    <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">Resolution Queue</h2>
                    <p className="text-on-surface-variant mt-2 text-lg">Manage pending redemptions, efficiency audits, and point disputes.</p>
                  </div>

                  <div className="space-y-12">
                    {/* Disputes Section */}
                    <section>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant mb-6 flex items-center gap-4">
                        <span className="material-symbols-outlined text-sm">rule</span>
                        Point Disputes
                        <div className="h-px flex-1 bg-outline-variant/10"></div>
                      </h3>
                      {appeals.length === 0 ? (
                        <div className="text-center py-12 rounded-3xl border-2 border-dashed border-outline-variant text-on-surface-variant bg-surface-container-low/30">
                          <p className="text-xs font-bold uppercase tracking-widest opacity-40">No pending disputes</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {appeals.map(appeal => (
                            <AppealCard key={appeal.id} appeal={appeal} onResolve={resolveAppeal} viewedIds={viewedIds} markViewed={markViewed} />
                          ))}
                        </div>
                      )}
                    </section>


                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}



      {/* ——————————————————————————————————————————————————————————————————————————————————————————————————————————
          VIEW: SKILLS ACCELERATOR
      —————————————————————————————————————————————————————————————————————————————————————————————————————————— */}
      {activeView === 'skills' && (
        <SkillsView 
          modules={modules} 
          setAddModuleOpen={setAddModuleOpen} 
          isManager={currentProfile.is_manager} 
          onRemoveModule={handleDeleteModule}
          enrollments={enrollments}
          moduleSteps={moduleSteps}
          onJoinModule={handleJoinModule}
          onCompleteStep={handleCompleteStep}
          authProfile={authProfile}
        />
      )}

      {/* ═══════════════════════════════════════════
          VIEW: ECONOMY (BOUNTIES & REWARDS)
      ═══════════════════════════════════════════ */}
      {activeView === 'economy' && (
        <StaffEconomyPage 
          currentUserId={currentUserId} 
          totalPoints={team.find(t => t.id === currentUserId)?.monthPoints || 0}
          weeklyEfficiency={weeklyEfficiency}
          onBountyClaimed={(task) => {
            setTasks(prev => [task, ...prev]);
          }} 
          onPointsDeducted={(deducted) => {
            setTeam(prev => prev.map(m => m.id === currentUserId ? { ...m, monthPoints: m.monthPoints - deducted } : m));
          }}
        />
      )}



      {/* ——— Modals ——— */}
      <ProfileModal 
        isOpen={profileOpen} 
        onClose={() => setProfileOpen(false)} 
        profile={profile} 
        onSave={handleUpdateProfile} 
        onUploadAvatar={handleUploadAvatar}
        onDeleteAvatar={handleDeleteAvatar}
      />
      <AddTaskModal 
        isOpen={addTaskOpen} 
        onClose={() => { setAddTaskOpen(false); setEditingTask(null); }} 
        onSubmit={handleAddTask}
        staffList={collaboratorStaffList}
        initialTask={editingTask}
        meritConfig={meritConfig}
        taskDefinitions={taskDefinitions}
      />

      <AddModuleModal isOpen={addModuleOpen} onClose={() => setAddModuleOpen(false)} onSubmit={handleAddModule} />
      
      {/* Completed Archive Modal */}
      <CompletedTasksModal 
        isOpen={completedTasksOpen} 
        onClose={() => setCompletedTasksOpen(false)} 
        tasks={visibleTasks.filter(t => t.status === 'completed')}
      />
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————
// Appeal Card (Triage)
// ——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————
function AppealCard({ appeal, onResolve, viewedIds, markViewed }: { appeal: AppealItem; onResolve: (id: string, pts: number, msg: string) => void; viewedIds: string[]; markViewed: (id: string) => void }) {
  const [pts, setPts] = useState(appeal.originalPoints);
  const [msg, setMsg] = useState('');

  return (
    <div 
      className={`bg-surface-container-lowest p-6 rounded-3xl border transition-all cursor-pointer relative overflow-hidden group ${
        !viewedIds.includes(appeal.id) ? 'border-error/30 bg-error/5 ring-1 ring-error/10 shadow-lg' : 'border-outline-variant/10 shadow-sm hover:shadow-md'
      }`}
      onClick={() => markViewed(appeal.id)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-200 ring-2 ring-primary/20 ring-offset-2 overflow-hidden shadow-sm relative">
             <img src={appeal.imgUrl} alt={appeal.staffName} className="w-full h-full object-cover" />
             {!viewedIds.includes(appeal.id) && (
               <span className="absolute top-0 right-0 w-3 h-3 bg-error rounded-full border-2 border-white animate-pulse shadow-sm shadow-error/50"></span>
             )}
          </div>
          <div>
            <h4 className="font-bold text-on-surface text-lg flex items-center gap-2">
              {appeal.staffName}
              {!viewedIds.includes(appeal.id) && <span className="text-[8px] bg-error text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">New Update</span>}
            </h4>
            <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">
              {appeal.department} • {appeal.taskTitle}
            </p>
          </div>
        </div>
        {appeal.resolved ? (
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary/10 shadow-sm">
            Resolved
          </div>
        ) : (
          <div className="bg-error/10 text-error px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-error/10 shadow-sm animate-pulse flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-error inline-block"></span>
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

// ——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————
// Skills View
// ——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————
function SkillsView({ 
  modules, 
  setAddModuleOpen, 
  isManager, 
  onRemoveModule, 
  enrollments, 
  moduleSteps, 
  onJoinModule, 
  onCompleteStep, 
  authProfile 
}: { 
  modules: SkillModule[], 
  setAddModuleOpen: (v: boolean) => void, 
  isManager: boolean, 
  onRemoveModule: (id: string) => void,
  enrollments: ModuleEnrollment[],
  moduleSteps: ModuleStep[],
  onJoinModule: (id: string) => void,
  onCompleteStep: (moduleId: string, stepOrder: number) => void,
  authProfile: any
}) {
  const [selectedModule, setSelectedModule] = useState<SkillModule | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);

  const enrollment = selectedModule ? enrollments.find(e => e.module_id === selectedModule.id && e.staff_id === authProfile?.id) : null;
  const currentModuleSteps = selectedModule ? moduleSteps.filter(s => s.module_id === selectedModule.id) : [];
  const moduleParticipants = selectedModule ? enrollments.filter(e => e.module_id === selectedModule.id) : [];

  if (selectedModule) {
    const isEnrolled = !!enrollment;
    const progress = enrollment ? (enrollment.status === 'completed' ? 100 : Math.round(((enrollment.current_step_order - 1) / currentModuleSteps.length) * 100)) : 0;

    return (
      <main className="pt-28 px-6 max-w-5xl mx-auto pb-32 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <button 
            onClick={() => { setSelectedModule(null); setShowParticipants(false); }} 
            className="flex items-center gap-2 font-bold text-[11px] tracking-widest uppercase px-5 py-2.5 rounded-xl border border-outline-variant/10 text-on-surface-variant bg-surface-container-lowest shadow-sm hover:text-primary transition-all active:scale-95 w-fit"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to Matrix
          </button>

          {isManager && (
            <button 
              onClick={() => setShowParticipants(!showParticipants)}
              className={`flex items-center gap-2 font-bold text-[11px] tracking-widest uppercase px-5 py-2.5 rounded-xl border transition-all ${showParticipants ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/10'}`}
            >
              <span className="material-symbols-outlined text-[18px]">{showParticipants ? 'visibility' : 'group'}</span>
              {showParticipants ? 'Hide Progress' : `View ${moduleParticipants.length} Participants`}
            </button>
          )}
        </div>

        {showParticipants && isManager ? (
          <section className="animate-in slide-in-from-bottom duration-500">
            <div className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 p-8 shadow-sm">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-on-surface font-headline mb-2">Participation Tracking</h2>
                <p className="text-sm text-on-surface-variant opacity-60">Real-time progress for &quot;{selectedModule.title}&quot;</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {moduleParticipants.length === 0 ? (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-on-surface-variant opacity-40">
                    <span className="material-symbols-outlined text-6xl mb-4">group_off</span>
                    <p className="font-bold uppercase tracking-widest text-xs">No one has joined yet</p>
                  </div>
                ) : (
                  moduleParticipants.map((p) => {
                    const pProgress = currentModuleSteps.length > 0 ? (p.status === 'completed' ? 100 : Math.round(((p.current_step_order - 1) / currentModuleSteps.length) * 100)) : 0;
                    return (
                      <div key={p.id} className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">
                          {p.staffName?.[0] || 'S'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-on-surface truncate">{p.staffName || 'Staff Member'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pProgress}%` }} />
                            </div>
                            <span className="text-[10px] font-black text-primary w-8 text-right">{pProgress}%</span>
                          </div>
                        </div>
                        {p.status === 'completed' && (
                          <span className="material-symbols-outlined text-emerald-500 font-black">verified</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Module Header */}
            <section className="mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-lg">
                      {selectedModule.code}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-outline-variant" />
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                      {currentModuleSteps.length} Learning Steps
                    </span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black text-on-surface font-headline leading-tight tracking-tight mb-4">
                    {selectedModule.title}
                  </h2>
                  <p className="text-lg text-on-surface-variant leading-relaxed max-w-2xl">
                    {selectedModule.description}
                  </p>
                </div>

                <div className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/10 shadow-xl min-w-[200px] text-center">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant mb-1">Potential Merit</p>
                  <p className="text-4xl font-black text-primary font-headline">+{selectedModule.meritValue}</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-primary opacity-60">Points</p>
                </div>
              </div>

              {isEnrolled && (
                <div className="mt-10 p-6 rounded-[2rem] bg-primary/5 border border-primary/10">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">Your Progress</p>
                    <p className="text-xs font-black text-primary">{progress}% Complete</p>
                  </div>
                  <div className="h-3 bg-primary/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(var(--color-primary),0.5)]" 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Coursework Steps */}
            <section className="space-y-6">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-outline-variant/10" />
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-on-surface-variant opacity-40">The Roadmap</h3>
                <div className="h-px flex-1 bg-outline-variant/10" />
              </div>

              {currentModuleSteps.length === 0 ? (
                <div className="p-12 rounded-[40px] border border-outline-variant/10 bg-surface-container-lowest text-center">
                  <p className="text-on-surface-variant font-bold">Coursework content is being prepared by management.</p>
                </div>
              ) : (
                currentModuleSteps.map((step, idx) => {
                  const isDone = isEnrolled && (enrollment.status === 'completed' || step.step_order < enrollment.current_step_order);
                  const isPending = isEnrolled && enrollment.status !== 'completed' && step.step_order === enrollment.current_step_order;
                  const isLocked = !isDone && !isPending;

                  return (
                    <div 
                      key={step.id}
                      className={`relative p-8 rounded-[2.5rem] border transition-all duration-300 group ${
                        isDone ? 'bg-emerald-50/30 border-emerald-500/20' :
                        isPending ? 'bg-surface-container-highest border-primary shadow-xl shadow-primary/5 scale-[1.02]' :
                        'bg-surface-container-lowest border-outline-variant/10 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 transition-all ${
                          isDone ? 'bg-emerald-500 text-white' :
                          isPending ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' :
                          'bg-surface-container text-on-surface-variant'
                        }`}>
                          {isDone ? <span className="material-symbols-outlined">check</span> : step.step_order}
                        </div>

                        <div className="flex-1">
                          <h4 className={`text-xl font-bold mb-3 ${isLocked ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                            {step.title}
                          </h4>
                          <p className="text-on-surface-variant leading-relaxed text-sm">
                            {step.description}
                          </p>

                          {isPending && (
                            <div className="mt-8 flex flex-col md:flex-row items-center gap-4 animate-in slide-in-from-left duration-500">
                              <button 
                                onClick={() => onCompleteStep(selectedModule.id, step.step_order)}
                                className="w-full md:w-auto bg-primary text-white px-8 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                              >
                                Mark Step as Complete
                              </button>
                              {step.content_url && (
                                <a 
                                  href={step.content_url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="flex items-center gap-2 text-primary font-bold text-xs hover:underline"
                                >
                                  View Materials <span className="material-symbols-outlined text-sm">open_in_new</span>
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        {isLocked && (
                          <div className="absolute top-8 right-8 text-on-surface-variant opacity-20">
                            <span className="material-symbols-outlined text-3xl">lock</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            {!isEnrolled && (
              <div className="mt-16 text-center animate-in slide-in-from-bottom duration-700">
                <button 
                  onClick={() => onJoinModule(selectedModule.id)}
                  className="mission-gradient text-white px-12 py-5 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/40 hover:scale-105 active:scale-95 transition-all"
                >
                  Join Coursework
                </button>
                <p className="mt-4 text-xs font-bold text-on-surface-variant opacity-40">Join now to unlock the roadmap and earn merit points</p>
              </div>
            )}
          </>
        )}
      </main>
    );
  }

  return (
    <main className="pt-28 px-6 max-w-7xl mx-auto pb-32 animate-in fade-in duration-300">
      <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-5xl md:text-7xl font-black text-on-surface font-headline leading-[0.9] tracking-tighter mb-6">
            SKILLS<br/><span className="text-primary">ACCELERATOR</span>
          </h1>
          <p className="text-on-surface-variant font-medium max-w-xl text-lg leading-relaxed opacity-60">
            Elevate your professional trajectory. Master proprietary workflows, gain strategic certifications, and unlock premium merit rewards.
          </p>
        </div>
        
        {isManager && (
          <button 
            onClick={() => setAddModuleOpen(true)}
            className="group flex items-center gap-3 bg-surface-container-lowest px-6 py-4 rounded-[2rem] border border-outline-variant/10 shadow-xl hover:border-primary/30 transition-all active:scale-95 shrink-0"
          >
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
              <span className="material-symbols-outlined">add</span>
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-on-surface">New Module</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {modules.map((m) => {
          const userEnrollment = enrollments.find(e => e.module_id === m.id && e.staff_id === authProfile?.id);
          const isCompleted = userEnrollment?.status === 'completed';
          
          return (
            <div 
              key={m.id} 
              className="group relative bg-surface-container-lowest rounded-[3rem] border border-outline-variant/10 p-8 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-8">
                <div className="flex flex-col gap-2">
                  <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-lg w-fit">
                    {m.code}
                  </span>
                  {isCompleted && (
                    <span className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                      <span className="material-symbols-outlined text-[14px]">verified</span> Completed
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-40">Reward</p>
                  <p className="text-2xl font-black text-primary">+{m.meritValue}</p>
                </div>
              </div>

              <h3 className="text-2xl font-black text-on-surface font-headline leading-tight mb-4 group-hover:text-primary transition-colors">
                {m.title}
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed mb-8 flex-1">
                {m.description}
              </p>

              <div className="pt-8 border-t border-outline-variant/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-surface-container-lowest bg-slate-200" />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-on-surface-variant">
                    {m.participants} Enrolled
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {isManager && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRemoveModule(m.id); }}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-all"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedModule(m)}
                    className="bg-surface-container-high px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-on-surface hover:bg-primary hover:text-white transition-all shadow-sm"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}


// â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 
// Roadmap Components
// â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 
function RoadmapWidget({ tasks, klToday, onEditTask }: { tasks: Task[], klToday: string, onEditTask?: (t: Task) => void }) {
  // Future Items: not completed, commencement > today
  const futureTasks = klToday ? tasks.filter(t => t.status !== 'completed' && t.commencementDate && t.commencementDate.split('T')[0] > klToday)
    .sort((a,b) => a.commencementDate!.localeCompare(b.commencementDate!)) : [];

  // Past Items: status === 'completed', chronologically
  const pastTasks = tasks.filter(t => t.status === 'completed')
    .sort((a,b) => {
       const da = a.lastCompletedDate || '';
       const db = b.lastCompletedDate || '';
       return db.localeCompare(da);
    }).slice(0, 3).reverse();
    
  return (
    <div className="relative bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="relative p-6 border-b border-outline-variant/10 bg-surface-container-low/50 flex items-center gap-3">
         <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[18px]">map</span>
         </div>
         <div>
           <p className="text-[10px] uppercase font-black tracking-widest text-primary">Roadmap</p>
           <h2 className="font-headline text-lg font-black text-on-surface leading-none mt-1">Upcoming Tasks</h2>
         </div>
      </div>

      <div className="relative px-6 py-4">
        {/* Continuous Vertical Line */}
        <div className="absolute left-[34px] xl:left-[34px] top-0 bottom-0 w-[2px] bg-outline-variant/20 z-0"></div>
        
        {/* Past Items */}
        {pastTasks.length > 0 && (
          <div className="space-y-0 relative z-10">
            {pastTasks.map(task => (
              <RoadmapPastItem key={task.id} task={task} onEditTask={onEditTask} />
            ))}
          </div>
        )}

        {/* TODAY Marker */}
        <div className="relative flex items-center w-full my-4 z-10">
          <div className="w-8 flex-shrink-0 flex justify-center">
            <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-white shadow-sm border border-primary/20"></div>
          </div>
          <div className="flex-1 border-t border-primary/20 ml-2 relative">
            <span className="absolute -top-[9px] bg-white px-2 font-black text-[9px] text-primary tracking-[0.15em] uppercase shadow-sm border border-primary/10 rounded-full">Today</span>
          </div>
        </div>

        {/* Future Items */}
        <div className="space-y-0 relative z-10">
          {futureTasks.length === 0 && (
            <div className="text-center py-6 text-on-surface-variant flex flex-col items-center">
               <span className="material-symbols-outlined opacity-30 mb-1 text-[24px]">event_busy</span>
               <p className="text-xs font-bold opacity-70">No upcoming tasks.</p>
            </div>
          )}
          {futureTasks.map(task => (
            <RoadmapFutureItem key={task.id} task={task} klToday={klToday} onEditTask={onEditTask} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoadmapPastItem({ task, onEditTask }: { task: Task, onEditTask?: (t: Task) => void }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className="group relative w-full cursor-pointer py-3" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start w-full opacity-70 hover:opacity-100 transition-opacity">
        <div className="w-8 flex-shrink-0 flex justify-center items-center h-6 mt-0.5">
          <div className="w-2.5 h-2.5 rounded-full bg-outline-variant flex items-center justify-center"></div>
        </div>
        <div className="flex-1 pl-3 flex justify-between items-start">
          <div className="flex flex-col">
            <span className="font-headline font-bold text-sm text-on-surface transition-colors line-clamp-1 group-hover:line-clamp-none">{task.title}</span>
            <span className="text-[9px] text-on-surface-variant mt-0.5 font-black uppercase tracking-wider">Completed</span>
          </div>
          <span className={`material-symbols-outlined text-on-surface-variant mt-1 text-base transition-transform ${expanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </div>
      {expanded && (
        <div className="pl-11 pr-2 pt-2 pb-1 w-full animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-surface-container rounded-xl p-3 border border-outline-variant/10 relative">
            <p className="text-[10px] text-on-surface-variant leading-relaxed">
              {task.lastCompletedDate ? `Done ${new Date(task.lastCompletedDate).toLocaleDateString()}` : 'Recently completed'}
            </p>
            <p className="text-[10px] text-primary mt-1 font-black uppercase tracking-wider">+{task.points} pts earned</p>
            {onEditTask && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                className="absolute right-3 top-3 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RoadmapFutureItem({ task, klToday, onEditTask }: { task: Task, klToday: string, onEditTask?: (t: Task) => void }) {
  const [expanded, setExpanded] = React.useState(false);
  let daysToGo = 0;
  if (task.commencementDate) {
    const todayStr = klToday.split('T')[0];
    const commStr = task.commencementDate.split('T')[0];
    // Date only comparison
    const today = new Date(todayStr);
    const comm = new Date(commStr);
    daysToGo = Math.round((comm.getTime() - today.getTime()) / (1000 * 3600 * 24));
  }
  
  const formattedDate = task.commencementDate ? new Date(task.commencementDate).toLocaleDateString() : 'TBD';
  const freqLabel = task.frequency?.type === 'monthly' ? `Monthly (Day ${task.frequency.triggerDate})` :
                    task.frequency?.type === 'weekly' ? 'Weekly' :
                    task.frequency?.type === 'daily' ? 'Daily' : 'One-Time';
  
  return (
    <div className="group relative w-full cursor-pointer py-3" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start w-full opacity-60 hover:opacity-100 transition-opacity">
        <div className="w-8 flex-shrink-0 flex justify-center items-center h-6 mt-0.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white border-[3px] border-outline-variant ring-2 ring-white"></div>
        </div>
        <div className="flex-1 pl-3 flex justify-between items-start">
          <div className="flex flex-col">
            <span className="font-headline font-bold text-sm text-on-surface-variant group-hover:text-on-surface transition-colors line-clamp-1">{task.title}</span>
             <div className="flex items-center gap-2 mt-1 text-[10px]">
               <span className="font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">Planned</span>
               {daysToGo > 0 && <span className="text-on-surface-variant italic font-medium">{daysToGo} {daysToGo > 1 ? 'days' : 'day'} away</span>}
             </div>
          </div>
          <span className={`material-symbols-outlined text-on-surface-variant mt-1 text-base transition-transform ${expanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </div>
      {expanded && (
        <div className="pl-11 pr-2 pt-2 pb-1 w-full animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-surface-container rounded-xl p-3 border border-outline-variant/10 relative">
            <p className="text-[10px] text-on-surface-variant leading-relaxed">
              <strong>Scheduled For:</strong> {formattedDate}
            </p>
            <p className="text-[10px] text-on-surface-variant leading-relaxed mt-1">
              <strong>Recurrence:</strong> {freqLabel}
            </p>
            <p className="text-[10px] text-primary mt-1 font-black uppercase tracking-wider">Estimated: +{task.points} pts</p>
            {onEditTask && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                className="absolute right-3 top-3 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CompletedTasksModal({ isOpen, onClose, tasks }: { isOpen: boolean, onClose: () => void, tasks: Task[] }) {
  if (!isOpen) return null;
  const sorted = [...tasks].sort((a,b) => {
    const da = a.lastCompletedDate || a.commencementDate || '';
    const db = b.lastCompletedDate || b.commencementDate || '';
    return db.localeCompare(da);
  });

  // Group by formatted date string
  const groups: Record<string, Task[]> = {};
  sorted.forEach(t => {
    const dStr = t.lastCompletedDate || t.commencementDate || '';
    let dateLabel = 'Archived Missions';
    if (dStr) {
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) {
        dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
    if (!groups[dateLabel]) groups[dateLabel] = [];
    groups[dateLabel].push(t);
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-surface w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border border-outline-variant/20 animate-in zoom-in-95 font-sans relative flex flex-col max-h-full">
        <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-lowest shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">archive</span>
            </div>
            <div>
              <h2 className="text-xl font-headline font-black text-on-surface">Completed Archive</h2>
              <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-70">Task History Labeled on Date</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-8">
          {sorted.length === 0 && (
            <div className="text-center py-10 opacity-50">
               <span className="material-symbols-outlined text-[40px] mb-2">inbox</span>
               <p className="text-sm font-bold">No completed tasks yet.</p>
            </div>
          )}
          {Object.entries(groups).map(([dateStr, groupTasks]) => (
            <div key={dateStr} className="relative pl-4 border-l-2 border-primary/20 space-y-4">
              {/* Date Header Group Badge */}
              <div className="sticky top-0 z-10 -ml-8 mb-4 flex items-center gap-3">
                <div className="bg-primary text-white p-1 rounded-full shadow-md shadow-primary/20">
                  <span className="material-symbols-outlined text-[12px] block">calendar_month</span>
                </div>
                <div className="bg-surface-container-low/90 backdrop-blur-md border border-outline-variant/10 shadow-sm px-4 py-1.5 rounded-xl flex items-center gap-2">
                  <span className="text-xs font-black text-on-surface tracking-wide">{dateStr}</span>
                  <span className="text-[9px] font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-md opacity-80">
                    {groupTasks.length} {groupTasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
              </div>

              {/* Task list for this date */}
              <div className="grid grid-cols-1 gap-4">
                {groupTasks.map(task => (
                  <div 
                    key={task.id} 
                    className="group/item bg-surface-container-lowest hover:bg-surface-container-lowest/90 border border-outline-variant/10 hover:border-primary/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/40 to-tertiary/20 group-hover/item:from-primary group-hover/item:to-tertiary transition-all" />
                    
                    <div>
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <p className="font-bold text-on-surface text-base tracking-tight group-hover/item:text-primary transition-colors">
                          {task.title} <span className="opacity-60 text-sm font-semibold ml-1">{task.actualDurationMinutes !== undefined ? `(${Math.round(task.actualDurationMinutes)}min)` : task.elapsedSec ? `(${Math.round(task.elapsedSec / 60)}min)` : ''}</span>
                        </p>
                        <div className="bg-primary hover:bg-primary/90 text-white rounded-xl px-3 py-1 text-center shadow-md shadow-primary/20 transition-all font-black text-sm shrink-0">
                          +{task.points}<br/><span className="text-[8px] uppercase tracking-widest font-bold opacity-80">PTS</span>
                        </div>
                      </div>

                      {task.note && (
                        <p className="text-xs text-on-surface-variant/90 mb-3 leading-relaxed font-medium">
                          {task.note}
                        </p>
                      )}
                    </div>

                    {/* Bottom strip: EXPLICIT DATE LABEL */}
                    <div className="pt-2.5 border-t border-outline-variant/5 flex flex-wrap items-center justify-between gap-2 mt-auto">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container/60 rounded-lg border border-outline-variant/5">
                        <span className="material-symbols-outlined text-[13px] text-primary">event_available</span>
                        <span className="text-[10px] font-black tracking-wider text-on-surface uppercase">
                          Date: <span className="text-primary">{task.lastCompletedDate ? new Date(task.lastCompletedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : dateStr}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded">
                          {task.tierName}
                        </span>
                        <EfficiencyBadge score={task.efficiencyScore} isFlagged={task.isFlagged} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
