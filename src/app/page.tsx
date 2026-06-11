"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { 
  Task, TaskFrequency, StaffProfile, TeamMember, AppealItem, SkillModule, 
  MeritConfig, OrganizationConfig, ActivityLog, TaskDefinition, 
  ModuleEnrollment, ModuleStep, UserAuthProfile, ImpactLevel, ComplexityLevel, Reward, RewardRedemption, Bounty 
} from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { SEED_PROFILE, SEED_MODULES, SEED_MERIT_CONFIG, SEED_ORG_CONFIG } from '@/lib/mockDb';
import { getKLTime, fmt, getActivePointConfig } from '@/lib/utils';
import { calculateTaskPoints, simulateAIAssessment } from '@/lib/taskEngine';
import { assessTaskViaEdge } from '@/lib/assessTask';
import confetti from 'canvas-confetti';
import MacroViewGraph from '@/components/MacroViewGraph';
import ProfileModal from '@/components/ProfileModal';

// Categories supported for visual grouping (Business Entity Folders)
const CATEGORIES = ['ECA Rental - E-hailing', 'ECA Rental - Daily Rental', 'ECA Marketing', 'ECA IT R&D'];
const FUNCTION_TAGS = ['Strategic', 'Operations', 'Marketing', 'Finance'];
const IMPACT_LEVELS: ImpactLevel[] = ['High', 'Medium', 'Low'];
const COMPLEXITY_LEVELS: ComplexityLevel[] = ['Low', 'Medium', 'High'];

// Helper to retrieve color coding, initials monogram logo and tagline per category
const getCategoryTheme = (folder: string) => {
  const name = (folder || '').toLowerCase();
  
  if (name.includes('daily rental') || name.includes('daily')) {
    return {
      border: 'border-l-4 border-l-[#047857] ring-2 ring-[#047857]/10',
      bg: 'bg-[#f0fdf4]',
      text: 'text-[#047857]',
      badgeBg: 'bg-[#dcfce7]',
      label: 'Domestic Car Rental',
      initials: '🚗'
    };
  }
  if (name.includes('e-hailing') || name.includes('hailing') || name.includes('ehailing')) {
    return {
      border: 'border-l-4 border-l-[#0d9488] ring-2 ring-[#0d9488]/10',
      bg: 'bg-[#f0fdfa]',
      text: 'text-[#0d9488]',
      badgeBg: 'bg-[#ccfbf1]',
      label: 'Grab Driver Fleet',
      initials: '🚖'
    };
  }
  if (name.includes('marketing') && !name.includes('rental')) {
    return {
      border: 'border-l-4 border-l-[#b91c1c] ring-2 ring-[#b91c1c]/10',
      bg: 'bg-[#fef2f2]',
      text: 'text-[#b91c1c]',
      badgeBg: 'bg-[#fee2e2]',
      label: 'Marketing Department',
      initials: '📢'
    };
  }
  if (name.includes('it r&d') || name.includes('it r\u0026d') || name.includes('software') || name.includes('r&d')) {
    return {
      border: 'border-l-4 border-l-[#6d28d9] ring-2 ring-[#6d28d9]/10',
      bg: 'bg-[#f5f3ff]',
      text: 'text-[#6d28d9]',
      badgeBg: 'bg-[#ede9fe]',
      label: 'IT & R&D',
      initials: '💻'
    };
  }

  // Default fallback (Forest green)
  const words = (folder || 'ECA').trim().split(/\s+/);
  const initials = words.length >= 2 
    ? (words[0][0] + (words[1][0] || '')).toUpperCase()
    : words[0].substring(0, Math.min(words[0].length, 2)).toUpperCase();
    
  return {
    border: 'border-l-4 border-l-[#406c58]',
    bg: 'bg-[#f4f6f4]',
    text: 'text-[#406c58]',
    badgeBg: 'bg-[#eef2ee]',
    label: 'Business Unit',
    initials: initials || 'BU'
  };
};

// Auto-classification intent classifier for Matrix Architecture
const autoClassifyTask = (title: string): { category: string, initiative: string } => {
  const t = title.toLowerCase();
  
  // 1. Classify Category (Business Entity Folder)
  let category = 'ECA Rental - Daily Rental'; // Default fallback — most tasks are daily rental ops
  
  // E-hailing: Grab drivers, e-hailing specific
  if (t.includes('e-hailing') || t.includes('hailing') || t.includes('grab') || t.includes('driver') || t.includes('ehailing')) {
    category = 'ECA Rental - E-hailing';
  }
  // Marketing: content, ads, social, creative, branding
  else if (t.includes('marketing') || t.includes('ads') || t.includes('tiktok') || t.includes('instagram') || 
           t.includes('social') || t.includes('content') || t.includes('creative') || t.includes('campaign') || 
           t.includes('video') || t.includes('post') || t.includes('viral') || t.includes('ad copy') || 
           t.includes('promo') || t.includes('brand') || t.includes('design') || t.includes('poster') ||
           t.includes('carousel') || t.includes('reel') || t.includes('photo') || t.includes('shoot')) {
    category = 'ECA Marketing';
  }
  // IT R&D: software, dev, tech, tools, system, app
  else if (t.includes('software') || t.includes('r&d') || t.includes('code') || t.includes('app') || 
           t.includes('api') || t.includes('bug') || t.includes('feature') || t.includes('dev') || 
           t.includes('ui') || t.includes('ux') || t.includes('database') || t.includes('tech') || 
           t.includes('saas') || t.includes('system') || t.includes('tool') || t.includes('automat') ||
           t.includes('deploy') || t.includes('server') || t.includes('website') || t.includes('platform') ||
           t.includes('dashboard') || t.includes('kpi') || t.includes('merit') || t.includes('integration')) {
    category = 'ECA IT R&D';
  }
  // Daily rental: car rental, booking, fleet, maintenance, customer, contract
  else if (t.includes('daily') || t.includes('rental') || t.includes('fleet') || t.includes('car') || 
           t.includes('vehicle') || t.includes('maintenance') || t.includes('booking') || t.includes('customer') ||
           t.includes('contract') || t.includes('insurance') || t.includes('return') || t.includes('delivery') ||
           t.includes('pickup') || t.includes('handover') || t.includes('inspection')) {
    category = 'ECA Rental - Daily Rental';
  }

  // 2. Classify Initiative (Function Tag)
  let initiative = 'Operations'; // Default fallback
  if (t.includes('marketing') || t.includes('ads') || t.includes('social') || t.includes('viral') || t.includes('post') || t.includes('video') || t.includes('tiktok') || t.includes('instagram') || t.includes('creative') || t.includes('ad ') || t.includes('content') || t.includes('promo')) {
    initiative = 'Marketing';
  } else if (t.includes('finance') || t.includes('bill') || t.includes('invoice') || t.includes('payroll') || t.includes('budget') || t.includes('tax') || t.includes('cost') || t.includes('revenue') || t.includes('price') || t.includes('profit') || t.includes('payment') || t.includes('account')) {
    initiative = 'Finance';
  } else if (t.includes('strategy') || t.includes('strategic') || t.includes('vision') || t.includes('hire') || t.includes('hiring') || t.includes('growth') || t.includes('plan') || t.includes('roadmap') || t.includes('funding') || t.includes('invest') || t.includes('acquisition') || t.includes('partnership')) {
    initiative = 'Strategic';
  }

  return { category, initiative };
};

const autoCategorizeTask = (title: string): string => {
  return autoClassifyTask(title).category;
};

interface TaskMetadata {
  category: string;
  initiative: string;
}

export default function UnifiedMeritApp() {
  // --- Auth & Navigation ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authProfile, setAuthProfile] = useState<UserAuthProfile | null>(null);
  const [activeView, setActiveView] = useState('missions'); // staff views: missions, training, rewards, leaderboard
  const [managerSubView, setManagerSubView] = useState<'board' | 'disputes' | 'economy' | 'settings'>('board');
  const [activeBoardTab, setActiveBoardTab] = useState<'kanban' | 'matrix'>('kanban');
  const [activeRightTab, setActiveRightTab] = useState<'team' | 'economy' | 'resolutions' | 'settings'>('team');

  // Login inputs
  const [accessId, setAccessId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // --- Core Application Data ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [modules, setModules] = useState<SkillModule[]>(SEED_MODULES);
  const [meritConfig, setMeritConfig] = useState<MeritConfig>(SEED_MERIT_CONFIG);
  const [orgConfig, setOrgConfig] = useState<OrganizationConfig>(SEED_ORG_CONFIG);
  const [taskDefinitions, setTaskDefinitions] = useState<TaskDefinition[]>([]);
  
  // Economy specific states
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);

  // Training / Skills States
  const [enrollments, setEnrollments] = useState<ModuleEnrollment[]>([]);
  const [moduleSteps, setModuleSteps] = useState<ModuleStep[]>([]);
  const [selectedModule, setSelectedModule] = useState<SkillModule | null>(null);

  // Decomposer Local States (Manager)
  const [localInitiatives, setLocalInitiatives] = useState<string[]>(FUNCTION_TAGS);
  const [newInitiativeTitle, setNewInitiativeTitle] = useState('');
  const [activeInitiative, setActiveInitiative] = useState<string>('Operations');

  // Dynamic board categories (folders) and selection states
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [groupingMode, setGroupingMode] = useState<'category' | 'initiative'>('category');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [selectedFunctionTag, setSelectedFunctionTag] = useState<string>('All');
  const [ceoViewActive, setCeoViewActive] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedInits = localStorage.getItem('localInitiatives');
      if (savedInits) {
        const parsed = JSON.parse(savedInits).filter((i: string) => FUNCTION_TAGS.includes(i));
        const finalInits = parsed.length > 0 ? parsed : FUNCTION_TAGS;
        setLocalInitiatives(finalInits);
        setActiveInitiative(finalInits[0]);
      } else {
        setLocalInitiatives(FUNCTION_TAGS);
        localStorage.setItem('localInitiatives', JSON.stringify(FUNCTION_TAGS));
        setActiveInitiative('Operations');
      }

      const savedCats = localStorage.getItem('boardCategories');
      if (savedCats) {
        const parsed = JSON.parse(savedCats).filter((c: string) => c && c.trim());
        // Auto-clean: remove any legacy categories not in the canonical list
        const legacyNames = ['ECA HQ', 'Marketing Consultancy', 'Software / R&D', 'ECA Rental - Daily'];
        const cleaned = parsed.filter((c: string) => !legacyNames.includes(c));
        // Ensure all canonical categories are present
        const merged = Array.from(new Set([...cleaned, ...CATEGORIES]));
        setCategories(merged);
        localStorage.setItem('boardCategories', JSON.stringify(merged));
      } else {
        setCategories(CATEGORIES);
        localStorage.setItem('boardCategories', JSON.stringify(CATEGORIES));
      }
    }
  }, []);

  // Modals & Task Form States
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [macroViewOpen, setMacroViewOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNote, setTaskNote] = useState('');
  const [taskDuration, setTaskDuration] = useState(60);
  const [taskCategory, setTaskCategory] = useState('General');
  const [taskImpact, setTaskImpact] = useState<ImpactLevel>('Medium');
  const [taskComplexity, setTaskComplexity] = useState<ComplexityLevel>('Medium');
  const [taskOwner, setTaskOwner] = useState('');
  const [taskStatus, setTaskStatus] = useState<'queued' | 'running' | 'paused' | 'completed'>('queued');
  const [isContinuous, setIsContinuous] = useState(false);
  const [freqType, setFreqType] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
  const [freqDays, setFreqDays] = useState<number[]>([]);
  const [triggerDate, setTriggerDate] = useState(1);
  const [selectedCollabs, setSelectedCollabs] = useState<string[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<{ id: string; name: string; isCompleted: boolean }[]>([]);
  const [newWorkflowStep, setNewWorkflowStep] = useState('');

  // AI loading preview inside modal
  const [aiLoading, setAiLoading] = useState(false);
  const debounceRef = useRef<any>(null);

  // Settings & Economy inputs
  const [weeklyThresholdInput, setWeeklyThresholdInput] = useState(975);
  const [newBounty, setNewBounty] = useState({ title: '', description: '', points: 100 });
  const [newReward, setNewReward] = useState({ title: '', description: '', points: 500, icon: 'card_giftcard' });

  // Personnel management
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffDept, setNewStaffDept] = useState('');
  const [newStaffPass, setNewStaffPass] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptScope, setNewDeptScope] = useState('');
  
  // Custom alerts
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Completed Archive collapsible
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');

  const showAlert = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  // --- Session persistence ---
  useEffect(() => {
    const savedLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const savedProfile = localStorage.getItem('authProfile');
    const savedView = localStorage.getItem('activeView');
    
    if (savedLoggedIn && savedProfile) {
      const profileData = JSON.parse(savedProfile);
      setIsLoggedIn(true);
      setAuthProfile(profileData);
      if (profileData.is_manager) {
        setActiveView('manager');
      } else {
        setActiveView(savedView || 'missions');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn.toString());
    if (authProfile) {
      localStorage.setItem('authProfile', JSON.stringify(authProfile));
      localStorage.setItem('activeView', activeView);
    } else {
      localStorage.removeItem('authProfile');
      localStorage.removeItem('activeView');
    }
  }, [isLoggedIn, authProfile, activeView]);

  useEffect(() => {
    if (selectedTask) {
      const current = tasks.find(t => t.id === selectedTask.id);
      if (current) {
        setSelectedTask(prev => {
          if (!prev) return null;
          return {
            ...current,
            title: prev.title,
            note: prev.note,
            ownerId: prev.ownerId,
            category: prev.category,
            initiative: prev.initiative,
            impact: prev.impact,
            complexity: prev.complexity,
            totalSec: prev.totalSec,
            workflow: prev.workflow
          };
        });
      } else {
        setSelectedTask(null);
      }
    }
  }, [tasks]);

  // --- Helper: parse category and initiative from task ---
  const parseTaskMetadata = useCallback((task: Task, teamMembers: TeamMember[]): TaskMetadata => {
    let category = 'ECA HQ';
    let initiative = 'Operations';

    if (task.note && task.note.includes('=== METADATA ===')) {
      const parts = task.note.split('=== METADATA ===');
      const meta = parts[parts.length - 1];
      const catMatch = meta.match(/category:\s*(.+)/);
      const initMatch = meta.match(/initiative:\s*(.+)/);
      if (catMatch) category = catMatch[1].trim();
      if (initMatch) initiative = initMatch[1].trim();
    } else {
      const titleMatch = task.title.match(/^\[([^\]]+)\]/);
      if (titleMatch) {
        category = titleMatch[1].trim();
      } else if (task.ownerId) {
        const owner = teamMembers.find(m => m.id === task.ownerId);
        if (owner && owner.department) {
          category = owner.department.trim();
        }
      }
    }

    // Map legacy categories to the new 4 business folders
    const legacyCats: Record<string, string> = {
      'Strategic': 'ECA Rental - Daily Rental',
      'Operations': 'ECA Rental - Daily Rental',
      'Marketing': 'ECA Marketing',
      'Finance': 'ECA Rental - Daily Rental',
      'R&D': 'ECA IT R&D',
      'General': 'ECA Rental - Daily Rental',
      'ECA HQ': 'ECA Rental - Daily Rental',
      'Marketing Consultancy': 'ECA Marketing',
      'Software / R&D': 'ECA IT R&D',
      'ECA Rental - Daily': 'ECA Rental - Daily Rental',
    };
    if (legacyCats[category]) {
      category = legacyCats[category];
    }

    // Map legacy initiative/objective to the 4 function tags
    const validTags = ['Strategic', 'Operations', 'Marketing', 'Finance'];
    if (!validTags.includes(initiative)) {
      const i = initiative.toLowerCase();
      if (i.includes('marketing') || i.includes('viral') || i.includes('campaign') || i.includes('content') || i.includes('promo')) initiative = 'Marketing';
      else if (i.includes('finance') || i.includes('payroll') || i.includes('invoice') || i.includes('bill')) initiative = 'Finance';
      else if (i.includes('strategic') || i.includes('strategy') || i.includes('planning')) initiative = 'Strategic';
      else initiative = 'Operations';
    }

    return { category, initiative };
  }, []);

  // Format note field to hold the custom metadata block
  const formatNoteWithMetadata = (note: string, category: string, initiative: string): string => {
    let cleanNote = note || '';
    if (cleanNote.includes('=== METADATA ===')) {
      cleanNote = cleanNote.split('=== METADATA ===')[0].trim();
    }
    return `${cleanNote}\n\n=== METADATA ===\ncategory: ${category}\ninitiative: ${initiative}`;
  };

  // Get clean note body (without metadata block)
  const getCleanNote = (note?: string): string => {
    if (!note) return '';
    if (note.includes('=== METADATA ===')) {
      return note.split('=== METADATA ===')[0].trim();
    }
    return note;
  };

  // --- Database Fetching ---
  const fetchData = async () => {
    try {
      // 1. Profiles (Team)
      const { data: profilesData } = await supabase.from('profiles').select('*');
      let teamList: TeamMember[] = [];
      if (profilesData) {
        teamList = profilesData.map(t => ({
          id: t.id,
          name: t.full_name || 'Staff Member',
          imgUrl: t.photo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${t.id}`,
          status: 'online',
          currentTask: 'Awaiting Task',
          department: t.department || 'General',
          monthPoints: t.total_points || 0,
          rank: 1,
          elapsed: '',
          role: t.role,
          efficiencyScore: 1.0
        }));
      }

      // 2. Org Config
      const { data: configData } = await supabase
        .from('org_config')
        .select('config')
        .eq('workspace_id', 'default')
        .maybeSingle();
      if (configData?.config) {
        setOrgConfig(configData.config);
      }

      // 3. Merit Config
      const { data: meritData } = await supabase
        .from('system_configs')
        .select('value')
        .eq('key', 'merit_config')
        .maybeSingle();
      if (meritData?.value) {
        setMeritConfig(meritData.value as MeritConfig);
        setWeeklyThresholdInput((meritData.value as MeritConfig).weeklyThreshold || 975);
      }

      // 4. Tasks
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (taskData) {
        const mappedTasks = taskData.map(t => {
          let currentElapsed = t.elapsed_sec || 0;
          
          if (t.status === 'running' && t.commencement_date) {
            const now = new Date();
            const klNowFormatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });
            const parts = klNowFormatter.formatToParts(now);
            const getP = (type: string) => parts.find(p => p.type === type)?.value || '';
            const klNowStr = `${getP('year')}-${getP('month')}-${getP('day')}T${getP('hour')}:${getP('minute')}:${getP('second')}`;
            const klNow = new Date(klNowStr);
            const startStr = t.commencement_date.substring(0, 19);
            const start = new Date(startStr);
            if (!isNaN(start.getTime())) {
              const diffSecs = Math.max(0, Math.floor((klNow.getTime() - start.getTime()) / 1000));
              currentElapsed += diffSecs;
            }
          }

          const taskObj = {
            id: t.id,
            title: t.title,
            note: t.note,
            totalSec: t.total_sec,
            elapsedSec: currentElapsed,
            status: t.status,
            tierName: t.tier_name,
            tierVal: Number(t.tier_val || 1.0),
            points: t.points,
            commencementDate: t.commencement_date || t.created_at,
            lastCompletedDate: t.completed_at,
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
            efficiencyScore: Number(t.efficiency_score || 1.0),
            isFlagged: t.is_flagged,
            impact: t.impact || 'Medium',
            complexity: t.complexity || 'Medium'
          } as Task;

          const meta = parseTaskMetadata(taskObj, teamList);
          taskObj.category = meta.category;
          taskObj.initiative = meta.initiative;
          return taskObj;
        });
        setTasks(mappedTasks);

        const dbInitiatives = mappedTasks.map(t => parseTaskMetadata(t, teamList).initiative);
        const uniqueInits = Array.from(new Set([...dbInitiatives, ...FUNCTION_TAGS])).filter(i => FUNCTION_TAGS.includes(i));
        setLocalInitiatives(uniqueInits);
        if (typeof window !== 'undefined') {
          localStorage.setItem('localInitiatives', JSON.stringify(uniqueInits));
        }

        const dbCategories = mappedTasks.map(t => parseTaskMetadata(t, teamList).category);
        const savedCats = typeof window !== 'undefined' ? localStorage.getItem('boardCategories') : null;
        const currentCats = savedCats ? JSON.parse(savedCats).filter((c: string) => c && c.trim()) : CATEGORIES;
        const uniqueCats = Array.from(new Set([...currentCats, ...dbCategories])).filter(c => c && c.trim());
        setCategories(uniqueCats.length > 0 ? uniqueCats : CATEGORIES);
        if (typeof window !== 'undefined') {
          localStorage.setItem('boardCategories', JSON.stringify(uniqueCats.length > 0 ? uniqueCats : CATEGORIES));
        }

        if (profilesData) {
          const updatedTeam = teamList.map(member => {
            const activeTasks = mappedTasks.filter(t => t.ownerId === member.id && t.status === 'running');
            const finishedTasks = mappedTasks.filter(t => t.ownerId === member.id && t.status === 'completed' && t.efficiencyScore !== undefined);
            const avgEfficiency = finishedTasks.length > 0
              ? finishedTasks.reduce((sum, t) => sum + t.efficiencyScore!, 0) / finishedTasks.length
              : 1.0;

            return {
              ...member,
              currentTask: activeTasks.length > 0 ? activeTasks[activeTasks.length - 1].title : 'Awaiting Task',
              status: activeTasks.length > 0 ? 'active' as const : 'online' as const,
              efficiencyScore: avgEfficiency
            };
          });
          setTeam(updatedTeam);
        }
      }

      // 5. Activity Log
      const { data: actData } = await supabase.from('activity_log').select('*').order('timestamp', { ascending: false }).limit(60);
      if (actData) {
        setActivityLog(actData.map(a => ({
          id: a.id,
          type: a.type as any,
          desc: a.desc,
          points: a.points,
          timestamp: a.timestamp,
          staffName: a.staff_name,
          staffId: a.staff_id,
          isFlagged: a.is_flagged,
          efficiencyScore: a.efficiency_score,
          managerViewed: a.manager_viewed
        })));
      }

      // 6. Appeals
      const { data: appData } = await supabase.from('appeals').select('*').order('created_at', { ascending: false });
      if (appData) {
        setAppeals(appData.map(a => ({
          id: a.id,
          staffId: a.staff_id,
          staffName: a.staff_name,
          department: a.department,
          taskTitle: a.task_title,
          originalPoints: a.original_points,
          appealComment: a.appeal_comment,
          imgUrl: a.img_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=dispute',
          resolved: a.status === 'resolved',
          resolutionMessage: a.resolution_message,
          finalPoints: a.final_points
        })));
      }

      // 7. Bounties, Rewards, Redemptions
      const { data: bData } = await supabase.from('bounties').select('*').order('created_at', { ascending: false });
      if (bData) setBounties(bData);

      const { data: rData } = await supabase.from('rewards').select('*').order('created_at', { ascending: false });
      if (rData) setRewards(rData);

      const { data: redData } = await supabase.from('reward_redemptions').select(`
        *,
        profiles ( full_name ),
        rewards ( title, point_cost, icon_type )
      `).order('created_at', { ascending: false });
      if (redData) setRedemptions(redData as any);

      // 8. Task Definitions
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

      // 9. Training matrix data
      const { data: enrollData } = await supabase.from('module_enrollments').select('*');
      if (enrollData) {
        setEnrollments(enrollData.map(e => ({
          id: e.id,
          module_id: e.module_id,
          staff_id: e.staff_id,
          status: e.status,
          current_step_order: e.current_step_order,
          completed_at: e.completed_at
        })));
      }

      const { data: stepData } = await supabase.from('module_steps').select('*').order('step_order', { ascending: true });
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

      setDataLoaded(true);
    } catch (err) {
      console.error('Fetch data failed:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();

      // Realtime subscription setup
      const channel = supabase.channel('unified-realtime-sync');
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => { fetchData(); });
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { fetchData(); });
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => { fetchData(); });
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'appeals' }, () => { fetchData(); });
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'reward_redemptions' }, () => { fetchData(); });
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'bounties' }, () => { fetchData(); });
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'rewards' }, () => { fetchData(); });
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'module_enrollments' }, () => { fetchData(); });
      channel.subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isLoggedIn]);

  // Tick elapsed time loop for active tasks
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(prev => prev.map(t => {
        if (t.status !== 'running') return t;
        return { ...t, elapsedSec: (t.elapsedSec || 0) + 1 };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Authenticator ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      if (accessId === 'ecaworkspace' && passcode === '123456') {
        const mockOwner: UserAuthProfile = {
          id: '00000000-0000-0000-0000-000000000000',
          access_id: accessId,
          name: 'ECA Workspace Owner',
          full_name: 'ECA Workspace Owner',
          is_manager: true,
          designation: 'Business Owner',
          department: 'Executive',
          employmentType: 'Staff',
          photoUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=owner'
        };
        setIsLoggedIn(true);
        setAuthProfile(mockOwner);
        setActiveView('manager');
        showAlert('Executive workspace unlocked.');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('access_id', accessId)
        .eq('passcode', passcode)
        .single();

      if (error || !data) {
        setAuthError('Invalid credentials.');
        return;
      }

      const userProfile: UserAuthProfile = {
        id: data.id,
        access_id: data.access_id,
        name: data.full_name,
        full_name: data.full_name,
        is_manager: data.is_manager,
        designation: data.designation,
        department: data.department,
        employmentType: data.employment_type || 'Staff',
        photoUrl: data.photo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.id}`
      };

      setIsLoggedIn(true);
      setAuthProfile(userProfile);
      if (data.is_manager) {
        setActiveView('manager');
      } else {
        setActiveView('missions');
      }
      showAlert(`Welcome, ${data.full_name}.`);
    } catch (err) {
      setAuthError('Authentication anomaly.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAuthProfile(null);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('authProfile');
    localStorage.removeItem('activeView');
  };

  // --- Profile Avatar Upload / Delete / Save ---
  const handleUploadAvatar = async (file: File): Promise<string | null> => {
    if (!authProfile) return null;
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${authProfile.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) {
        // Fallback: convert to base64 data URL and store directly in profile
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            await supabase.from('profiles').update({ photo_url: dataUrl }).eq('id', authProfile.id);
            setAuthProfile(prev => prev ? { ...prev, photoUrl: dataUrl } : null);
            resolve(dataUrl);
          };
          reader.readAsDataURL(file);
        });
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;
      if (publicUrl) {
        await supabase.from('profiles').update({ photo_url: publicUrl }).eq('id', authProfile.id);
        setAuthProfile(prev => prev ? { ...prev, photoUrl: publicUrl } : null);
      }
      return publicUrl || null;
    } catch (err) {
      console.error('Avatar upload failed:', err);
      return null;
    }
  };

  const handleDeleteAvatar = async (url: string) => {
    if (!authProfile) return;
    try {
      const fallbackUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${authProfile.id}`;
      await supabase.from('profiles').update({ photo_url: fallbackUrl }).eq('id', authProfile.id);
      setAuthProfile(prev => prev ? { ...prev, photoUrl: fallbackUrl } : null);
    } catch (err) {
      console.error('Avatar delete failed:', err);
    }
  };

  const handleSaveProfile = async (profileData: any) => {
    if (!authProfile) return;
    try {
      const updates: Record<string, string> = {};
      if (profileData.name) updates.full_name = profileData.name;
      if (profileData.department !== undefined) updates.department = profileData.department;
      if (profileData.designation) updates.designation = profileData.designation;
      if (profileData.photoUrl) updates.photo_url = profileData.photoUrl;

      await supabase.from('profiles').update(updates).eq('id', authProfile.id);
      setAuthProfile(prev => prev ? {
        ...prev,
        name: profileData.name || prev.name,
        full_name: profileData.name || prev.full_name,
        department: profileData.department ?? prev.department,
        designation: profileData.designation || prev.designation,
        photoUrl: profileData.photoUrl || prev.photoUrl,
      } : null);
      setProfileModalOpen(false);
      showAlert('Profile updated successfully.');
    } catch (err) {
      console.error('Profile save failed:', err);
    }
  };

  // --- AI Assessment Debounce inside modal ---
  useEffect(() => {
    if (!taskModalOpen || !taskTitle || taskTitle.length < 3) return;
    setAiLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await assessTaskViaEdge(taskTitle, taskNote);
        if (res) {
          setTaskImpact(res.impact);
          setTaskComplexity(res.complexity);
        }
      } catch (err) {
        console.warn('Fallback to local assessment');
      } finally {
        setAiLoading(false);
      }
    }, 800);

    return () => clearTimeout(debounceRef.current);
  }, [taskTitle, taskNote, taskModalOpen]);

  // --- Task lifecycle actions ---
  const handleOpenAddTask = (category: string = 'General', initiative: string = 'General Operations') => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskNote('');
    setTaskDuration(60);
    setTaskCategory(category);
    setTaskImpact('Medium');
    setTaskComplexity('Medium');
    setTaskOwner(authProfile?.is_manager ? '' : authProfile?.id || '');
    setTaskStatus('queued');
    setIsContinuous(false);
    setFreqType('once');
    setFreqDays([]);
    setTriggerDate(1);
    setSelectedCollabs([]);
    setWorkflowSteps([]);
    setActiveInitiative(initiative);
    setTaskModalOpen(true);
  };

  const handleOpenEditTask = (task: Task) => {
    const meta = parseTaskMetadata(task, team);
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskNote(getCleanNote(task.note));
    setTaskDuration(Math.round(task.totalSec / 60) || 60);
    setTaskCategory(meta.category);
    setTaskImpact(task.impact || 'Medium');
    setTaskComplexity(task.complexity || 'Medium');
    setTaskOwner(task.ownerId || '');
    setTaskStatus(task.status);
    setIsContinuous(task.isContinuous || false);
    setFreqType(task.frequency?.type || 'once');
    setFreqDays(task.frequency?.days || []);
    setTriggerDate(task.frequency?.triggerDate || 1);
    setSelectedCollabs(task.collaboratorIds || []);
    setWorkflowSteps(task.workflow || []);
    setActiveInitiative(meta.initiative);
    setTaskModalOpen(true);
  };

  const handleAddWorkflowStep = () => {
    if (!newWorkflowStep.trim()) return;
    const newStep = { id: 'wf-' + Date.now(), name: newWorkflowStep.trim(), isCompleted: false };
    setWorkflowSteps(prev => [...prev, newStep]);
    setNewWorkflowStep('');
  };

  const handleToggleWorkflowStep = async (task: Task, stepId: string) => {
    const updatedWorkflow = task.workflow?.map(w => w.id === stepId ? { ...w, isCompleted: !w.isCompleted } : w) || [];
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, workflow: updatedWorkflow } : t));
    await supabase.from('tasks').update({ workflow: updatedWorkflow }).eq('id', task.id);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle) return;

    const activePointConfig = getActivePointConfig(meritConfig);
    const definition = taskDefinitions.find(d => d.title.toLowerCase() === taskTitle.toLowerCase());
    
    let finalImpact = taskImpact;
    let finalComplexity = taskComplexity;

    if (!editingTask) {
      if (definition?.impact && definition?.complexity) {
        finalImpact = definition.impact;
        finalComplexity = definition.complexity;
      } else {
        const assessment = simulateAIAssessment(taskTitle, taskNote);
        finalImpact = assessment.impact;
        finalComplexity = assessment.complexity;
      }
    }

    const pointCalc = calculateTaskPoints(
      taskTitle,
      taskNote,
      taskDuration,
      activePointConfig,
      definition ? { ...definition, estimatedMins: taskDuration } : undefined,
      finalImpact,
      finalComplexity
    );

    // Auto-classify the function tag from the task title instead of using the manual dropdown
    const autoClassified = autoClassifyTask(taskTitle);
    const formattedNote = formatNoteWithMetadata(taskNote, taskCategory, autoClassified.initiative);
    const taskId = editingTask ? editingTask.id : crypto.randomUUID();
    const finalOwner = taskOwner || authProfile?.id || '00000000-0000-0000-0000-000000000000';

    const taskPayload = {
      id: taskId,
      title: taskTitle,
      note: formattedNote,
      total_sec: taskDuration * 60,
      elapsed_sec: editingTask ? editingTask.elapsedSec : 0,
      status: taskStatus,
      tier_name: pointCalc.tierName,
      tier_val: pointCalc.tierVal,
      points: pointCalc.points,
      staff_id: finalOwner,
      collaborator_ids: selectedCollabs,
      frequency: { type: freqType, days: freqDays, triggerDate },
      is_continuous: isContinuous,
      workflow: workflowSteps,
      impact: finalImpact,
      complexity: finalComplexity,
      commencement_date: editingTask ? editingTask.commencementDate : getKLTime()
    };

    const { error } = await supabase.from('tasks').upsert([taskPayload]);
    if (error) {
      showAlert('Failed to save task: ' + error.message, 'error');
    } else {
      showAlert(editingTask ? 'Task specifications updated.' : 'New task decomposed.');
      setTaskModalOpen(false);
      fetchData();
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) showAlert('Delete failed', 'error');
    else {
      showAlert('Task deleted.');
      fetchData();
    }
  };

  const handleStartTask = async (id: string) => {
    const startTime = getKLTime();
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    await supabase.from('activity_log').insert([{
      id: crypto.randomUUID(),
      type: 'task_started',
      desc: `Staff started task: ${task.title}`,
      timestamp: startTime,
      staff_name: authProfile?.full_name || 'Staff Member',
      staff_id: authProfile?.id,
      manager_viewed: false
    }]);

    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'running', commencementDate: startTime } : t));
    await supabase.from('tasks').update({ status: 'running', commencement_date: startTime, manager_viewed: false }).eq('id', id);
    showAlert('Focus session started.');
    fetchData();
  };

  const handlePauseTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'paused' } : t));
    await supabase.from('tasks').update({ status: 'paused', elapsed_sec: task.elapsedSec }).eq('id', id);
    showAlert('Task paused.');
    fetchData();
  };

  const handleCompleteTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const actualMins = Math.max(1, Math.round(task.elapsedSec / 60));
    const activePointConfig = getActivePointConfig(meritConfig);
    const definition = taskDefinitions.find(d => d.title.toLowerCase() === task.title.toLowerCase());
    
    const pointCalc = calculateTaskPoints(
      task.title,
      task.note || '',
      actualMins,
      activePointConfig,
      definition ? { ...definition, estimatedMins: Math.round(task.totalSec / 60) } : undefined,
      task.impact,
      task.complexity
    );

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#406c58', '#bda58c', '#dfb482']
    });

    const { data: pData } = await supabase.from('profiles').select('total_points').eq('id', authProfile?.id!).single();
    const currentPts = pData?.total_points || 0;
    await supabase.from('profiles').update({ total_points: currentPts + pointCalc.points }).eq('id', authProfile?.id!);

    await supabase.from('activity_log').insert([{
      id: crypto.randomUUID(),
      type: 'points_earned',
      desc: `Completed task: ${task.title}`,
      points: pointCalc.points,
      tier_val: task.tierVal,
      staff_name: authProfile?.full_name || 'Staff Member',
      staff_id: authProfile?.id,
      is_flagged: pointCalc.isFlagged,
      efficiency_score: pointCalc.efficiencyScore,
      manager_viewed: false
    }]);

    await supabase.from('tasks').update({
      status: 'completed',
      elapsed_sec: task.elapsedSec,
      completed_at: getKLTime(),
      actual_duration_minutes: actualMins,
      efficiency_score: pointCalc.efficiencyScore,
      points: pointCalc.points,
      manager_viewed: false
    }).eq('id', id);

    showAlert(`Completed. Earned +${pointCalc.points} pts!`);
    fetchData();
  };

  const handleDisputeTask = async (task: Task) => {
    const msg = prompt('Provide comments for point dispute:');
    if (!msg) return;

    const newId = crypto.randomUUID();
    const { error } = await supabase.from('appeals').insert([{
      id: newId,
      staff_id: authProfile?.id,
      staff_name: authProfile?.full_name || 'Staff Member',
      department: authProfile?.department || 'General',
      task_title: task.title,
      original_points: task.points,
      appeal_comment: msg,
      img_url: authProfile?.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${authProfile?.id}`,
      resolved: false
    }]);

    if (error) showAlert('Submission failed', 'error');
    else {
      showAlert('Dispute registered.');
      fetchData();
    }
  };

  // --- Manager Remote overrides ---
  const handleForcePause = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'paused', is_flagged: true, manager_viewed: false })
      .eq('id', taskId);

    if (error) showAlert('Pause failed', 'error');
    else { showAlert('Task paused remotely.'); fetchData(); }
  };

  const handleForceComplete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const actualMins = Math.max(1, Math.round(task.elapsedSec / 60));
    const activePointConfig = getActivePointConfig(meritConfig);
    const definition = taskDefinitions.find(d => d.title.toLowerCase() === task.title.toLowerCase());
    
    const pointCalc = calculateTaskPoints(
      task.title,
      task.note || '',
      actualMins,
      activePointConfig,
      definition ? { ...definition, estimatedMins: Math.round(task.totalSec / 60) } : undefined,
      task.impact,
      task.complexity
    );

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 }
    });

    const { data: pData } = await supabase.from('profiles').select('total_points').eq('id', task.ownerId!).single();
    const currentPts = pData?.total_points || 0;
    await supabase.from('profiles').update({ total_points: currentPts + pointCalc.points }).eq('id', task.ownerId!);

    await supabase.from('activity_log').insert([{
      id: crypto.randomUUID(),
      type: 'points_earned',
      desc: `CEO complete override: ${task.title}`,
      points: pointCalc.points,
      tier_val: task.tierVal,
      staff_name: team.find(m => m.id === task.ownerId)?.name || 'Staff Member',
      staff_id: task.ownerId,
      is_flagged: pointCalc.isFlagged,
      efficiency_score: pointCalc.efficiencyScore,
      manager_viewed: true
    }]);

    await supabase.from('tasks').update({
      status: 'completed',
      elapsed_sec: task.totalSec || (actualMins * 60),
      completed_at: getKLTime(),
      actual_duration_minutes: actualMins,
      efficiency_score: pointCalc.efficiencyScore,
      points: pointCalc.points,
      manager_viewed: true
    }).eq('id', taskId);

    showAlert('Task overridden completed.');
    fetchData();
  };

  const handleResolveFlag = async (taskId: string) => {
    const { error } = await supabase.from('tasks').update({ is_flagged: false, manager_viewed: true }).eq('id', taskId);
    if (error) showAlert('Clear failed', 'error');
    else { showAlert('Anomaly resolved.'); fetchData(); }
  };

  // --- HTML5 Drag & Drop Swimlanes Handler ---
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropCategory = async (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const meta = parseTaskMetadata(task, team);
    const updatedNote = formatNoteWithMetadata(getCleanNote(task.note), targetCategory, meta.initiative);

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, note: updatedNote } : t));

    const { error } = await supabase.from('tasks').update({ note: updatedNote }).eq('id', taskId);
    if (error) {
      showAlert('Move failed', 'error');
      fetchData();
    } else {
      showAlert(`Task category shifted to ${targetCategory}`);
      fetchData();
    }
  };

  const handleDropMatrix = async (e: React.DragEvent, impact: ImpactLevel, complexity: ComplexityLevel) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const activePointConfig = getActivePointConfig(meritConfig);
    const definition = taskDefinitions.find(d => d.title.toLowerCase() === task.title.toLowerCase());
    const estMins = Math.round(task.totalSec / 60) || 60;
    
    const pointCalc = calculateTaskPoints(
      task.title,
      task.note || '',
      estMins,
      activePointConfig,
      definition ? { ...definition, estimatedMins: estMins } : undefined,
      impact,
      complexity
    );

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, impact, complexity, points: pointCalc.points } : t));

    const { error } = await supabase
      .from('tasks')
      .update({ 
        impact, 
        complexity, 
        points: pointCalc.points,
        tier_name: pointCalc.tierName,
        tier_val: pointCalc.tierVal
      })
      .eq('id', taskId);

    if (error) {
      showAlert('Calibration failed', 'error');
      fetchData();
    } else {
      showAlert(`Calibrated matrix cell (+${pointCalc.points} pts)`);
      fetchData();
    }
  };

  const handleResolveAppeal = async (appealId: string, finalPts: number, note: string) => {
    const appeal = appeals.find(a => a.id === appealId);
    if (!appeal) return;

    const diff = finalPts - appeal.originalPoints;
    if (diff !== 0 && appeal.staffId) {
      const { data: pData } = await supabase.from('profiles').select('total_points').eq('id', appeal.staffId).single();
      const currentPts = pData?.total_points || 0;
      await supabase.from('profiles').update({ total_points: currentPts + diff }).eq('id', appeal.staffId);
    }

    const { error } = await supabase
      .from('appeals')
      .update({ status: 'resolved', final_points: finalPts, resolution_message: note, resolved_at: getKLTime() })
      .eq('id', appealId);

    if (error) showAlert('Resolution error', 'error');
    else { showAlert('Point dispute resolved.'); fetchData(); }
  };

  const handleRejectAppeal = async (appealId: string, note: string) => {
    const { error } = await supabase
      .from('appeals')
      .update({ status: 'rejected', resolution_message: note, resolved_at: getKLTime() })
      .eq('id', appealId);

    if (error) showAlert('Rejection error', 'error');
    else { showAlert('Point dispute rejected.'); fetchData(); }
  };

  const handleClaimBounty = async (bounty: Bounty) => {
    const { error: bountyError } = await supabase
      .from('bounties')
      .update({ status: 'claimed', claimed_by: authProfile?.id })
      .eq('id', bounty.id);

    if (bountyError) {
      showAlert('Failed to claim bounty. Someone else grabbed it!', 'error');
      return;
    }

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: `[BOUNTY] ${bounty.title}`,
      note: formatNoteWithMetadata(bounty.description, 'General', 'General Operations'),
      totalSec: 3600,
      elapsedSec: 0,
      status: 'queued',
      tierName: 'Bounty',
      tierVal: 2.0,
      points: bounty.point_reward,
      commencementDate: getKLTime(),
      ownerId: authProfile?.id,
      collaboratorIds: [],
      collaborators: [],
      frequency: { type: 'once' },
      isContinuous: false,
      workflow: [],
      impact: 'Medium',
      complexity: 'Medium'
    };

    const dbTask = {
      id: newTask.id,
      title: newTask.title,
      note: newTask.note,
      total_sec: newTask.totalSec,
      elapsed_sec: newTask.elapsedSec,
      status: newTask.status,
      tier_name: newTask.tierName,
      tier_val: newTask.tierVal,
      points: newTask.points,
      staff_id: authProfile?.id,
      commencement_date: newTask.commencementDate,
      impact: newTask.impact,
      complexity: newTask.complexity
    };

    await supabase.from('tasks').insert([dbTask]);
    showAlert(`Bounty claimed and schedule queued.`);
    fetchData();
  };

  const handleRedeemReward = async (reward: Reward) => {
    const userPoints = team.find(t => t.id === authProfile?.id)?.monthPoints || 0;
    if (userPoints < reward.point_cost) {
      showAlert('Insufficient points balance.', 'error');
      return;
    }

    if (!confirm(`Spend ${reward.point_cost} points on "${reward.title}"?`)) return;

    const { error } = await supabase.rpc('redeem_reward', {
      p_user_id: authProfile?.id,
      p_reward_id: reward.id
    });

    if (error) {
      showAlert('Redemption failed', 'error');
    } else {
      confetti({
        particleCount: 80,
        spread: 60,
        colors: ['#406c58', '#bda58c', '#dfb482']
      });
      showAlert('Reward claimed.');
      fetchData();
    }
  };

  const handleFulfillRedemption = async (id: string) => {
    const { error } = await supabase.from('reward_redemptions').update({ status: 'fulfilled' }).eq('id', id);
    if (error) showAlert('Fulfillment failed', 'error');
    else { showAlert('Redemption fulfilled.'); fetchData(); }
  };

  const handleCreateInitiative = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInitiativeTitle.trim()) return;
    const trimmed = newInitiativeTitle.trim();
    setLocalInitiatives(prev => {
      const updated = [...prev, trimmed];
      if (typeof window !== 'undefined') {
        localStorage.setItem('localInitiatives', JSON.stringify(updated));
      }
      return updated;
    });
    setActiveInitiative(trimmed);
    setNewInitiativeTitle('');
    showAlert('Objective alignment registered.');
  };

  const handleRenameInitiative = async (oldName: string) => {
    const newName = prompt(`Rename objective "${oldName}" to:`, oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    const trimmedNewName = newName.trim();

    setLocalInitiatives(prev => {
      const updated = prev.map(i => i === oldName ? trimmedNewName : i);
      if (typeof window !== 'undefined') {
        localStorage.setItem('localInitiatives', JSON.stringify(updated));
      }
      return updated;
    });

    if (activeInitiative === oldName) {
      setActiveInitiative(trimmedNewName);
    }

    const affectedTasks = tasks.filter(t => parseTaskMetadata(t, team).initiative === oldName);
    
    if (affectedTasks.length > 0) {
      showAlert(`Updating ${affectedTasks.length} alignment subtasks...`, 'info');
      
      for (const t of affectedTasks) {
        const cat = parseTaskMetadata(t, team).category;
        const cleanNote = getCleanNote(t.note);
        const updatedNote = formatNoteWithMetadata(cleanNote, cat, trimmedNewName);
        
        await supabase.from('tasks').update({ note: updatedNote }).eq('id', t.id);
      }
    }

    showAlert(`Objective renamed to "${trimmedNewName}".`);
    fetchData();
  };

  const handleDeleteInitiative = async (nameToDelete: string) => {
    if (!confirm(`Are you sure you want to delete the objective "${nameToDelete}"?\nThis will re-align all its subtasks to "General Operations".`)) return;

    setLocalInitiatives(prev => {
      const updated = prev.filter(i => i !== nameToDelete);
      if (typeof window !== 'undefined') {
        localStorage.setItem('localInitiatives', JSON.stringify(updated));
      }
      return updated;
    });

    if (activeInitiative === nameToDelete) {
      setActiveInitiative('General Operations');
    }

    const affectedTasks = tasks.filter(t => parseTaskMetadata(t, team).initiative === nameToDelete);
    
    if (affectedTasks.length > 0) {
      showAlert(`Re-aligning ${affectedTasks.length} subtasks to General Operations...`, 'info');
      
      for (const t of affectedTasks) {
        const cat = parseTaskMetadata(t, team).category;
        const cleanNote = getCleanNote(t.note);
        const updatedNote = formatNoteWithMetadata(cleanNote, cat, 'General Operations');
        
        await supabase.from('tasks').update({ note: updatedNote }).eq('id', t.id);
      }
    }

    showAlert(`Objective "${nameToDelete}" deleted.`);
    fetchData();
  };

  const handleCreateCategory = (name: string) => {
    if (!name.trim()) return;
    const trimmed = name.trim();
    if (categories.includes(trimmed)) {
      showAlert(`Category "${trimmed}" already exists.`, 'error');
      return;
    }
    setCategories(prev => {
      const updated = [...prev, trimmed];
      if (typeof window !== 'undefined') {
        localStorage.setItem('boardCategories', JSON.stringify(updated));
      }
      return updated;
    });
    showAlert(`Category folder "${trimmed}" created.`);
  };

  const handleRenameCategory = async (oldName: string) => {
    const newName = prompt(`Rename category "${oldName}" to:`, oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();

    setCategories(prev => {
      const updated = prev.map(c => c === oldName ? trimmed : c);
      if (typeof window !== 'undefined') {
        localStorage.setItem('boardCategories', JSON.stringify(updated));
      }
      return updated;
    });

    const affectedTasks = tasks.filter(t => parseTaskMetadata(t, team).category === oldName);
    if (affectedTasks.length > 0) {
      showAlert(`Updating ${affectedTasks.length} task categories...`, 'info');
      for (const t of affectedTasks) {
        const init = parseTaskMetadata(t, team).initiative;
        const cleanNote = getCleanNote(t.note);
        const updatedNote = formatNoteWithMetadata(cleanNote, trimmed, init);
        await supabase.from('tasks').update({ note: updatedNote }).eq('id', t.id);
      }
    }
    showAlert(`Category renamed to "${trimmed}".`);
    fetchData();
  };

  const handleDeleteCategory = async (nameToDelete: string) => {
    if (categories.length <= 1) {
      showAlert('Cannot delete the last remaining category.', 'error');
      return;
    }
    const fallbackCategory = categories.find(c => c !== nameToDelete) || 'ECA HQ';
    if (!confirm(`Are you sure you want to delete the category "${nameToDelete}"?\nAll its tasks will be re-assigned to "${fallbackCategory}".`)) return;

    setCategories(prev => {
      const updated = prev.filter(c => c !== nameToDelete);
      if (typeof window !== 'undefined') {
        localStorage.setItem('boardCategories', JSON.stringify(updated));
      }
      return updated;
    });

    const affectedTasks = tasks.filter(t => parseTaskMetadata(t, team).category === nameToDelete);
    if (affectedTasks.length > 0) {
      const fallbackCat = categories.find(c => c !== nameToDelete) || 'ECA HQ';
      showAlert(`Re-aligning ${affectedTasks.length} tasks to ${fallbackCat}...`, 'info');
      for (const t of affectedTasks) {
        const init = parseTaskMetadata(t, team).initiative;
        const cleanNote = getCleanNote(t.note);
        const updatedNote = formatNoteWithMetadata(cleanNote, fallbackCat, init);
        await supabase.from('tasks').update({ note: updatedNote }).eq('id', t.id);
      }
    }
    showAlert(`Category "${nameToDelete}" deleted.`);
    fetchData();
  };

  const handleCreateNewFileTask = async (category: string = 'ECA HQ', initiative: string = 'Operations') => {
    const newId = crypto.randomUUID();
    const newTask: Task = {
      id: newId,
      title: 'Untitled Spec',
      note: formatNoteWithMetadata('', category, initiative),
      totalSec: 3600,
      elapsedSec: 0,
      status: 'queued',
      tierName: 'Core Operations',
      tierVal: 1.0,
      points: 100,
      commencementDate: getKLTime(),
      ownerId: '',
      collaboratorIds: [],
      workflow: [],
      impact: 'Medium',
      complexity: 'Medium'
    };
    
    setSelectedTask(newTask);
    
    const taskPayload = {
      id: newId,
      title: 'Untitled Spec',
      note: newTask.note,
      total_sec: 3600,
      elapsed_sec: 0,
      status: 'queued',
      tier_name: 'Core Operations',
      tier_val: 1.0,
      points: 100,
      staff_id: authProfile?.id || '00000000-0000-0000-0000-000000000000',
      collaborator_ids: [],
      workflow: [],
      impact: 'Medium',
      complexity: 'Medium',
      commencement_date: getKLTime()
    };
    
    await supabase.from('tasks').insert([taskPayload]);
    showAlert('New specification draft created.');
    fetchData();
  };

  const handleCreateTaskWithAutoCategorize = async (title: string, defaultFolder?: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    // Auto-categorize based on intention, fallback to hq/default if not matched
    const classification = autoClassifyTask(cleanTitle);
    const category = defaultFolder || classification.category;
    const initiative = classification.initiative;
    
    // Ensure the category exists in local categories list
    if (!categories.includes(category)) {
      setCategories(prev => {
        const updated = [...prev, category];
        if (typeof window !== 'undefined') {
          localStorage.setItem('boardCategories', JSON.stringify(updated));
        }
        return updated;
      });
    }

    const newId = crypto.randomUUID();
    const newTask: Task = {
      id: newId,
      title: cleanTitle,
      note: formatNoteWithMetadata('', category, initiative),
      totalSec: 3600,
      elapsedSec: 0,
      status: 'queued',
      tierName: 'Core Operations',
      tierVal: 1.0,
      points: 100,
      commencementDate: getKLTime(),
      ownerId: '',
      collaboratorIds: [],
      workflow: [],
      impact: 'Medium',
      complexity: 'Medium'
    };

    const taskPayload = {
      id: newId,
      title: cleanTitle,
      note: newTask.note,
      total_sec: 3600,
      elapsed_sec: 0,
      status: 'queued',
      tier_name: 'Core Operations',
      tier_val: 1.0,
      points: 100,
      staff_id: authProfile?.id || '00000000-0000-0000-0000-000000000000',
      collaborator_ids: [],
      workflow: [],
      impact: 'Medium',
      complexity: 'Medium',
      commencement_date: getKLTime()
    };

    setTasks(prev => [newTask, ...prev]);

    await supabase.from('tasks').insert([taskPayload]);
    showAlert(`Task created and categorized to "${category}" [Tag: ${initiative}]`);
    fetchData();
  };

  const handleMoveTaskCategory = async (taskId: string, targetCategory: string) => {
    const taskToMove = tasks.find(t => t.id === taskId);
    if (!taskToMove) return;

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const meta = parseTaskMetadata(t, team);
        const updatedNote = formatNoteWithMetadata(getCleanNote(t.note), targetCategory, meta.initiative);
        return { ...t, category: targetCategory, note: updatedNote };
      }
      return t;
    }));

    const meta = parseTaskMetadata(taskToMove, team);
    const updatedNote = formatNoteWithMetadata(getCleanNote(taskToMove.note), targetCategory, meta.initiative);
    await supabase.from('tasks').update({ note: updatedNote }).eq('id', taskId);

    showAlert(`Moved "${taskToMove.title}" to "${targetCategory}"`);
    fetchData();
  };

  const updateSelectedTaskField = (fields: Partial<Task>) => {
    if (!selectedTask) return;
    setSelectedTask(prev => prev ? { ...prev, ...fields } : null);
  };

  const handleSaveSelectedTask = async () => {
    if (!selectedTask) return;

    const activePointConfig = getActivePointConfig(meritConfig);
    const definition = taskDefinitions.find(d => d.title.toLowerCase() === selectedTask.title.toLowerCase());
    
    const durationMins = Math.round(selectedTask.totalSec / 60) || 60;
    const pointCalc = calculateTaskPoints(
      selectedTask.title,
      getCleanNote(selectedTask.note),
      durationMins,
      activePointConfig,
      definition ? { ...definition, estimatedMins: durationMins } : undefined,
      selectedTask.impact,
      selectedTask.complexity
    );

    const meta = parseTaskMetadata(selectedTask, team);
    const cat = selectedTask.category || meta.category;
    const init = selectedTask.initiative || meta.initiative;

    const formattedNote = formatNoteWithMetadata(getCleanNote(selectedTask.note), cat, init);

    const taskPayload = {
      id: selectedTask.id,
      title: selectedTask.title,
      note: formattedNote,
      total_sec: selectedTask.totalSec,
      elapsed_sec: selectedTask.elapsedSec,
      status: selectedTask.status,
      tier_name: pointCalc.tierName,
      tier_val: pointCalc.tierVal,
      points: pointCalc.points,
      staff_id: selectedTask.ownerId || authProfile?.id || '00000000-0000-0000-0000-000000000000',
      collaborator_ids: selectedTask.collaboratorIds || [],
      workflow: selectedTask.workflow || [],
      impact: selectedTask.impact,
      complexity: selectedTask.complexity,
      commencement_date: selectedTask.commencementDate
    };

    const { error } = await supabase.from('tasks').upsert([taskPayload]);
    if (error) {
      showAlert('Failed to save task: ' + error.message, 'error');
    } else {
      showAlert('Workspace file synchronized.');
      fetchData();
      // Update the active selected task in editor state with new point values
      setSelectedTask(prev => prev ? { ...prev, points: pointCalc.points, tierName: pointCalc.tierName } : null);
    }
  };

  const handleSaveThreshold = async () => {
    const newConfig = { ...meritConfig, weeklyThreshold: weeklyThresholdInput };
    const { error } = await supabase.from('system_configs').update({ value: newConfig }).eq('key', 'merit_config');
    if (error) showAlert('Sync failed', 'error');
    else { showAlert('Weekly performance threshold synchronized.'); setMeritConfig(newConfig); }
  };

  // --- Department Configuration Handlers ---
  const handleSaveDepartment = async () => {
    const name = newDeptName.trim();
    const scope = newDeptScope.trim();
    if (!name || !scope) return alert('Department name and job scope description are required.');
    
    const updatedDepts = {
      ...(orgConfig.departments || {}),
      [name]: { jobScope: scope }
    };
    
    const updated = { ...orgConfig, departments: updatedDepts };
    const { error } = await supabase.from('org_config').upsert({ workspace_id: 'default', config: updated });
    if (error) {
      showAlert('Failed to save department: ' + error.message, 'error');
    } else {
      setOrgConfig(updated);
      setNewDeptName('');
      setNewDeptScope('');
      showAlert('Department and Job Scope updated.');
    }
  };

  const handleDeleteDepartment = async (deptName: string) => {
    if (!confirm(`Are you sure you want to remove the department "${deptName}" and its pre-set job scope?`)) return;
    
    const { [deptName]: removed, ...rest } = orgConfig.departments || {};
    const updated = { ...orgConfig, departments: rest };
    const { error } = await supabase.from('org_config').upsert({ workspace_id: 'default', config: updated });
    if (error) {
      showAlert('Failed to remove department: ' + error.message, 'error');
    } else {
      setOrgConfig(updated);
      showAlert('Department removed.');
    }
  };

  const handleEnrollStaff = async () => {
    if (!newStaffName || !newStaffDept || !newStaffPass) return;
    const { error } = await supabase.from('profiles').insert([{
      id: crypto.randomUUID(),
      full_name: newStaffName,
      department: newStaffDept,
      access_id: newStaffName.toLowerCase().replace(/\s+/g, ''),
      passcode: newStaffPass,
      is_manager: false,
      role: 'Staff'
    }]);

    if (error) showAlert('Credentials creation failed: ' + error.message, 'error');
    else {
      showAlert('New personnel credentials deployed.');
      setNewStaffName('');
      setNewStaffDept('');
      setNewStaffPass('');
      fetchData();
    }
  };

  const handlePostBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBounty.title || !newBounty.description) return;
    const { error } = await supabase.from('bounties').insert([{
      title: newBounty.title,
      description: newBounty.description,
      point_reward: newBounty.points,
      status: 'open'
    }]);
    if (error) showAlert('Bounty deployment failed', 'error');
    else { showAlert('Bounty posted.'); setNewBounty({ title: '', description: '', points: 100 }); fetchData(); }
  };

  const handlePostReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReward.title || !newReward.description) return;
    const { error } = await supabase.from('rewards').insert([{
      title: newReward.title,
      description: newReward.description,
      point_cost: newReward.points,
      icon_type: newReward.icon,
      is_active: true
    }]);
    if (error) showAlert('Reward deployment failed', 'error');
    else { showAlert('Reward catalog updated.'); setNewReward({ title: '', description: '', points: 500, icon: 'card_giftcard' }); fetchData(); }
  };

  const handleJoinModule = async (moduleId: string) => {
    const { error } = await supabase.from('module_enrollments').insert([{
      id: crypto.randomUUID(),
      module_id: moduleId,
      staff_id: authProfile?.id,
      status: 'joined',
      current_step_order: 1
    }]);
    if (error) showAlert('Join failed', 'error');
    else {
      showAlert('Enrolled in module.');
      fetchData();
    }
  };

  const handleCompleteStep = async (moduleId: string, stepOrder: number) => {
    const enrollment = enrollments.find(e => e.module_id === moduleId && e.staff_id === authProfile?.id);
    if (!enrollment) return;

    const moduleStepsForThis = moduleSteps.filter(s => s.module_id === moduleId);
    const isLastStep = stepOrder === Math.max(...moduleStepsForThis.map(s => s.step_order));

    const payload: any = {
      current_step_order: stepOrder + 1
    };

    if (isLastStep) {
      payload.status = 'completed';
      payload.completed_at = getKLTime();

      const mod = modules.find(m => m.id === moduleId);
      if (mod) {
        const { data: pData } = await supabase.from('profiles').select('total_points').eq('id', authProfile?.id!).single();
        const currentPts = pData?.total_points || 0;
        await supabase.from('profiles').update({ total_points: currentPts + mod.meritValue }).eq('id', authProfile?.id!);

        await supabase.from('activity_log').insert([{
          id: crypto.randomUUID(),
          type: 'points_earned',
          desc: `Completed Course: ${mod.title}`,
          points: mod.meritValue,
          staff_name: authProfile?.full_name || 'Staff Member',
          staff_id: authProfile?.id,
          manager_viewed: false
        }]);

        confetti({
          particleCount: 120,
          spread: 80,
          colors: ['#406c58', '#bda58c', '#dfb482']
        });
        showAlert(`Course completed! +${mod.meritValue} pts awarded.`);
      }
    }

    const { error } = await supabase.from('module_enrollments').update(payload).eq('id', enrollment.id);
    if (error) showAlert('Step save failed', 'error');
    else {
      if (!isLastStep) showAlert('Module progress saved.');
      fetchData();
    }
  };

  // --- Derived Metrics ---
  const activeFocusTask = useMemo(() => {
    return tasks.find(t => (t.ownerId === authProfile?.id || t.collaboratorIds?.includes(authProfile?.id || '')) && t.status === 'running');
  }, [tasks, authProfile]);

  const staffMissions = useMemo(() => {
    return tasks.filter(t => t.ownerId === authProfile?.id || t.collaboratorIds?.includes(authProfile?.id || ''));
  }, [tasks, authProfile]);

  const staffMissionsToday = useMemo(() => {
    return staffMissions.filter(t => t.status !== 'completed');
  }, [staffMissions]);

  const staffCompletedMissions = useMemo(() => {
    return staffMissions.filter(t => t.status === 'completed');
  }, [staffMissions]);

  const weeklyPoints = useMemo(() => {
    const finishedLogs = activityLog.filter(a => a.staffId === authProfile?.id && a.type === 'points_earned');
    const fromLogs = finishedLogs.reduce((sum, log) => sum + (log.points || 0), 0);
    // Fallback: if no activity log entries, use the stored total_points from profile
    if (fromLogs === 0) {
      const member = team.find(t => t.id === authProfile?.id);
      return member?.monthPoints || 0;
    }
    return fromLogs;
  }, [activityLog, authProfile, team]);

  const weeklyEfficiency = useMemo(() => {
    const finishedLogs = activityLog.filter(a => a.staffId === authProfile?.id && a.type === 'points_earned' && a.efficiencyScore !== undefined);
    if (finishedLogs.length === 0) return 1.0;
    return finishedLogs.reduce((sum, log) => sum + log.efficiencyScore!, 0) / finishedLogs.length;
  }, [activityLog, authProfile]);

  const lifetimePoints = useMemo(() => {
    const member = team.find(t => t.id === authProfile?.id);
    return member?.monthPoints || 0;
  }, [team, authProfile]);

  const sortedLeaderboard = useMemo(() => {
    return [...team].sort((a, b) => b.monthPoints - a.monthPoints);
  }, [team]);

  // --- RENDER PORTAL ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#eef2ee] flex items-center justify-center p-6 relative overflow-hidden font-body antialiased text-[#1a2620]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#dce4dc_1px,transparent_1px),linear-gradient(to_bottom,#dce4dc_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-40 pointer-events-none" />

        <div className="w-full max-w-md bg-white border border-[#e1e7e1] p-8 sm:p-10 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col items-center">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#406c58]" />
          
          <div className="w-14 h-14 bg-[#406c58] rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md mb-6">
            M
          </div>

          <h2 className="text-xl font-black font-headline tracking-widest text-[#1a2620] uppercase mb-1">KPI Merit Access</h2>
          <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-8">Workplace Performance Engine</p>

          <form onSubmit={handleAuth} className="w-full space-y-5 text-left">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest block mb-2 text-stone-500 ml-1">Access ID</label>
              <input 
                required 
                value={accessId}
                onChange={e => setAccessId(e.target.value)}
                className="w-full bg-[#f2f5f2] border border-[#d8e2d8] rounded-xl py-3 px-4 outline-none text-[#1a2620] text-xs font-semibold focus:border-[#406c58]/65 transition-all" 
                placeholder="access_id..." 
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest block mb-2 text-stone-500 ml-1">Passkey</label>
              <input 
                type="password" 
                required 
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                className="w-full bg-[#f2f5f2] border border-[#d8e2d8] rounded-xl py-3 px-4 outline-none text-[#1a2620] text-xs font-semibold focus:border-[#406c58]/65 transition-all" 
                placeholder="••••••" 
              />
            </div>

            {authError && (
              <p className="text-[10px] font-bold text-rose-700 text-center uppercase tracking-wide bg-rose-50 border border-rose-200 p-2 rounded-lg">
                {authError}
              </p>
            )}

            <button type="submit" className="w-full py-3.5 rounded-xl bg-[#406c58] hover:bg-[#335746] text-white font-black uppercase tracking-widest text-xs transition-all shadow-md cursor-pointer mt-4">
              Unlock Console
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef2ee] text-[#1a2620] font-body antialiased flex flex-col relative overflow-hidden">
      
      {/* Background decorations */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#dce4dc_1px,transparent_1px),linear-gradient(to_bottom,#dce4dc_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-35 pointer-events-none" />

      {/* Global alert toast */}
      {alertMsg && (
        <div className={`fixed top-6 right-6 z-[250] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border animate-in slide-in-from-top-6 duration-300 ${
          alertMsg.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          alertMsg.type === 'info' ? 'bg-stone-50 border-stone-200 text-stone-800' :
          'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <span className="material-symbols-outlined text-[20px]">
            {alertMsg.type === 'error' ? 'error' : alertMsg.type === 'info' ? 'info' : 'check_circle'}
          </span>
          <p className="text-xs font-black uppercase tracking-wider">{alertMsg.text}</p>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-[100] bg-white/85 backdrop-blur-md border-b border-[#e1e7e1] px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-[#406c58] flex items-center justify-center text-white font-black text-lg shadow-sm">
            M
          </div>
          <div>
            <h1 className="text-base font-black font-headline uppercase tracking-widest text-[#1a2620] flex items-center gap-2">
              KPI Merit 
              {authProfile?.is_manager ? (
                <span className="text-[9px] bg-[#406c58]/10 border border-[#406c58]/20 text-[#406c58] font-bold px-2.5 py-0.5 rounded-full uppercase">CEO Suite</span>
              ) : (
                <span className="text-[9px] bg-stone-100 border border-stone-200 text-stone-600 font-bold px-2.5 py-0.5 rounded-full uppercase">Staff Dashboard</span>
              )}
            </h1>
            <p className="text-[8px] uppercase tracking-widest font-black text-stone-400">Core Performance</p>
          </div>
        </div>

        {/* Dynamic Navigation Tabs for Staff */}
        {!authProfile?.is_manager && (
          <nav className="hidden md:flex bg-[#f4f6f4] p-1 rounded-xl border border-[#e1e7e1] gap-1">
            {['missions', 'training', 'rewards', 'leaderboard'].map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveView(tab); setSelectedModule(null); }}
                className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  activeView === tab ? 'bg-[#406c58] text-white shadow-sm' : 'text-stone-500 hover:text-stone-850'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        )}

        {/* Header Right */}
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-3 bg-[#f4f6f4] px-4 py-1.5 rounded-xl border border-[#e1e7e1] cursor-pointer hover:bg-[#e8ede8] hover:border-[#c8d5c8] transition-all active:scale-95" onClick={() => setProfileModalOpen(true)} title="Edit Profile">
            <img src={authProfile?.photoUrl} className="w-6 h-6 rounded-lg object-cover border border-stone-200" alt="" />
            <div className="text-left">
              <p className="text-xs font-bold text-stone-800 leading-none">{authProfile?.full_name}</p>
              <p className="text-[8px] font-black uppercase text-stone-450 mt-1">{authProfile?.designation}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center p-2 rounded-xl bg-white border border-[#e1e7e1] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all duration-150 active:scale-[0.93] active:translate-y-[0.5px] cursor-pointer shadow-sm"
            title="Sign Out"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </header>

      {/* Mobile navigation switcher */}
      {!authProfile?.is_manager && (
        <div className="md:hidden flex justify-around bg-white border-b border-[#e1e7e1] p-2 shrink-0">
          {['missions', 'training', 'rewards', 'leaderboard'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveView(tab); setSelectedModule(null); }}
              className={`text-[9px] font-black uppercase tracking-wider py-1.5 px-3 rounded ${
                activeView === tab ? 'bg-[#406c58]/10 text-[#406c58] border border-[#406c58]/20 font-bold' : 'text-stone-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────────────────────────────────────
          MAIN WORKSPACE CANVAS (MANAGER VIEW)
      ────────────────────────────────────────────────────────────────────────────────────────────────────────── */}
      {authProfile?.is_manager && (
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 p-6 h-[calc(100vh-80px)] overflow-hidden">
          
          {/* COLUMN 1: OBSIDIAN EXPLORER SIDEBAR (xl:col-span-3) */}
          <section className="xl:col-span-3 bg-white border border-[#e1e7e1] rounded-3xl p-4 flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 relative">
            <div className="flex flex-col h-full overflow-hidden space-y-4">
              
              {/* Explorer Header */}
              <div className="space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-stone-600 flex items-center gap-1.5 font-headline">
                    <span className="material-symbols-outlined text-[#406c58] text-sm">folder_open</span>
                    Vault Explorer
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const name = prompt('Create new category folder:');
                        if (name) handleCreateCategory(name);
                      }}
                      className="p-1 hover:bg-stone-100 rounded text-stone-500 hover:text-[#406c58] transition-all duration-150 active:scale-[0.93] active:translate-y-[0.5px] cursor-pointer"
                      title="New Category Folder"
                    >
                      <span className="material-symbols-outlined text-[16px] block">create_new_folder</span>
                    </button>
                  </div>
                </div>

                {/* Search input */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-stone-550">
                    <span className="material-symbols-outlined text-[16px]">search</span>
                  </span>
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search files/folders..."
                    className="w-full bg-[#f4f6f4] border border-[#d8e2d8] rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-[#1a2620] outline-none focus:border-[#406c58]/40 transition-colors"
                  />
                </div>
              </div>

              {/* Tree Menu */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                {categories.map(folder => {
                  const folderTasks = tasks.filter(t => {
                    const meta = parseTaskMetadata(t, team);
                    const matchGroup = meta.category === folder;
                    const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchGroup && matchSearch;
                  });

                  // Sort tasks: ongoing first, completed after.
                  // Within completed tasks, sort chronologically: oldest is at the absolute bottom (descending by completion/commencement date).
                  const sortedFolderTasks = [...folderTasks].sort((a, b) => {
                    const aComp = a.status === 'completed';
                    const bComp = b.status === 'completed';
                    if (!aComp && bComp) return -1;
                    if (aComp && !bComp) return 1;
                    if (aComp && bComp) {
                      const timeA = new Date(a.lastCompletedDate || a.commencementDate || 0).getTime();
                      const timeB = new Date(b.lastCompletedDate || b.commencementDate || 0).getTime();
                      return timeB - timeA; // newer first, oldest at bottom
                    }
                    return 0;
                  });

                  const isExpanded = !!expandedFolders[folder];
                  
                  return (
                    <div key={folder} className="space-y-1">
                      {/* Folder Row */}
                      <div
                        onClick={() => setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }))}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-stone-50 transition-colors cursor-pointer group/folder"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-[16px] text-stone-500 shrink-0">
                            {isExpanded ? 'expand_more' : 'chevron_right'}
                          </span>
                          <span className="material-symbols-outlined text-[16px] text-[#406c58] shrink-0">
                            folder
                          </span>
                          <span className="text-xs font-bold text-stone-750 truncate">{folder}</span>
                        </div>

                        {/* Folder Action Icons */}
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <span className="text-[9px] font-black text-stone-500 bg-[#f4f6f4] border border-[#e1e7e1] px-1.5 py-0.5 rounded">
                            {sortedFolderTasks.length}
                          </span>
                          
                          <div className="hidden group-hover/folder:flex items-center gap-1 pl-1 border-l border-stone-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameCategory(folder);
                              }}
                              className="p-0.5 hover:bg-stone-200 rounded text-stone-500 hover:text-stone-700 transition-colors active:scale-[0.93] active:translate-y-[0.5px] duration-100"
                              title="Rename Folder"
                            >
                              <span className="material-symbols-outlined text-[12px] block">edit</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCategory(folder);
                              }}
                              className="p-0.5 hover:bg-rose-50 rounded text-stone-500 hover:text-rose-600 transition-colors active:scale-[0.93] active:translate-y-[0.5px] duration-100"
                              title="Delete Folder"
                            >
                              <span className="material-symbols-outlined text-[12px] block">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Folder Tasks list (Files) */}
                      {isExpanded && (
                        <div className="pl-6 space-y-0.5 border-l border-stone-200 ml-4 pb-1 max-h-[220px] overflow-y-auto thin-scrollbar">
                          {sortedFolderTasks.map(task => {
                            const isSelected = selectedTask?.id === task.id;
                            const isCompleted = task.status === 'completed';
                            const statusColor = 
                              task.status === 'running' ? 'bg-amber-500 animate-pulse' :
                              task.status === 'paused' ? 'bg-stone-450' :
                              isCompleted ? 'bg-emerald-500' :
                              'bg-stone-300';
                            
                            const taskMeta = parseTaskMetadata(task, team);
                            const taskTheme = getCategoryTheme(taskMeta.category);

                            return (
                              <div
                                key={task.id}
                                draggable={true}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', task.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onClick={() => setSelectedTask(task)}
                                className={`flex items-center justify-between p-2 rounded-xl text-left cursor-grab active:cursor-grabbing transition-all duration-155 active:scale-[0.97] active:translate-y-[0.5px] ${
                                  isSelected 
                                    ? (isCompleted
                                        ? 'bg-emerald-50 border border-emerald-300 font-semibold shadow-sm text-emerald-700'
                                        : `${taskTheme.bg} border border-current font-semibold shadow-sm ${taskTheme.text}`) 
                                    : (isCompleted
                                        ? 'text-stone-450 hover:text-stone-650 hover:bg-stone-50'
                                        : 'text-stone-600 hover:text-stone-850 hover:bg-stone-50')
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {isCompleted ? (
                                    <span className="material-symbols-outlined text-[14px] text-emerald-550 shrink-0">
                                      check_circle
                                    </span>
                                  ) : (
                                    <>
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />
                                      <span className={`material-symbols-outlined text-[14px] ${taskTheme.text} shrink-0`}>
                                        description
                                      </span>
                                    </>
                                  )}
                                  <span className="truncate text-xs font-semibold">{task.title}</span>
                                </div>
                                <span className={`text-[9px] font-mono shrink-0 ml-2 ${isCompleted ? 'text-emerald-600 font-bold' : 'text-stone-500'}`}>
                                  +{task.points}p
                                </span>
                              </div>
                            );
                          })}
                          {sortedFolderTasks.length === 0 && (
                            <p className="text-[9px] text-stone-400 italic pl-3 py-1">Folder is empty</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* COLUMN 2: OBSIDIAN EDITOR CANVAS (xl:col-span-6) */}
          <section className="xl:col-span-6 bg-white border border-[#e1e7e1] rounded-3xl p-6 flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 relative">
            {!selectedTask ? (
              /* CEO Active Command Center */
              <div className="flex-1 flex flex-col overflow-hidden space-y-5 select-none animate-fade-in text-left">
                <div className="shrink-0 flex items-center justify-between border-b border-[#e1e7e1] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black font-headline tracking-widest text-[#1a2620] uppercase">Active Command Center</h2>
                      <span className="text-[8px] font-black uppercase bg-[#a16207]/10 text-[#a16207] border border-[#a16207]/25 px-2.5 py-1 rounded-lg tracking-widest leading-none shrink-0 flex items-center gap-1.5 shadow-sm font-headline">
                        <span className="material-symbols-outlined text-[10px] font-bold">lock</span>
                        Admin Overview - Exclusive
                      </span>
                    </div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-stone-500 mt-0.5 font-headline">Cross-Business Operations & Ongoing Focus</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenAddTask('ECA HQ')}
                      className="px-4 py-2 bg-[#406c58] hover:bg-[#335746] text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[14px]">add_task</span> ADD TASK
                    </button>
                    <button
                      onClick={() => setMacroViewOpen(true)}
                      className="px-3 py-1.5 bg-white border border-[#e1e7e1] hover:bg-stone-50 text-stone-750 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] shadow-sm cursor-pointer"
                    >
                      MACRO VIEW
                    </button>
                  </div>
                </div>

                {/* Vault stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                  <div className="bg-[#f4f6f4] border border-[#e1e7e1] rounded-xl p-3 flex flex-col justify-center">
                    <span className="text-base font-bold text-stone-850 font-headline leading-tight">{tasks.length}</span>
                    <span className="text-[8px] font-black uppercase tracking-wider text-stone-550 mt-0.5">Total Task</span>
                  </div>
                  <div className="bg-[#f4f6f4] border border-[#e1e7e1] rounded-xl p-3 flex flex-col justify-center">
                    <span className="text-base font-bold text-amber-600 font-headline leading-tight">{tasks.filter(t => t.status === 'running').length}</span>
                    <span className="text-[8px] font-black uppercase tracking-wider text-stone-550 mt-0.5">Running</span>
                  </div>
                  <div className="bg-[#f4f6f4] border border-[#e1e7e1] rounded-xl p-3 flex flex-col justify-center">
                    <span className="text-base font-bold text-emerald-600 font-headline leading-tight">{tasks.filter(t => t.status === 'completed').length}</span>
                    <span className="text-[8px] font-black uppercase tracking-wider text-stone-550 mt-0.5">Completed</span>
                  </div>
                  <div className="bg-[#f4f6f4] border border-[#e1e7e1] rounded-xl p-3 flex flex-col justify-center">
                    <span className="text-base font-bold text-stone-800 font-headline leading-tight">{categories.length}</span>
                    <span className="text-[8px] font-black uppercase tracking-wider text-stone-550 mt-0.5">Business Folders</span>
                  </div>
                </div>

                {/* View Selection & Tag Filters (Matrix Architecture) */}
                <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 bg-[#f4f6f4] border border-[#e1e7e1] rounded-2xl p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-stone-500 font-headline">Active View:</span>
                    <button
                      onClick={() => {
                        setCeoViewActive(!ceoViewActive);
                        if (!ceoViewActive) setSelectedFunctionTag('All');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border ${
                        ceoViewActive
                          ? 'bg-[#406c58] text-white border-[#406c58] shadow-sm font-bold'
                          : 'bg-white text-stone-600 border-[#e1e7e1] hover:border-stone-300'
                      }`}
                    >
                      👑 CEO View {ceoViewActive ? 'ON' : 'OFF'}
                    </button>
                    <span className="text-stone-300">|</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-stone-550 font-headline">Department Filters:</span>
                    {FUNCTION_TAGS.map(tag => (
                      <button
                        key={tag}
                        onClick={() => setSelectedFunctionTag(selectedFunctionTag === tag ? 'All' : tag)}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border ${
                          selectedFunctionTag === tag
                            ? 'bg-[#406c58] text-white border-[#406c58] shadow-sm font-bold'
                            : 'bg-white text-stone-600 border-[#e1e7e1] hover:border-stone-300'
                        }`}
                      >
                        🏷️ {tag}
                      </button>
                    ))}
                  </div>
                  
                  <span className="text-[8px] font-black uppercase tracking-widest text-stone-500 bg-white border border-[#e1e7e1] px-2.5 py-1 rounded-lg">
                    {ceoViewActive ? 'My Tasks Only' : selectedFunctionTag === 'All' ? 'All Staff Tasks' : `Focused on: ${selectedFunctionTag}`}
                  </span>
                </div>

                {/* Multi-Business Grid */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categories.map(folder => {
                      const theme = getCategoryTheme(folder);
                      // Get tasks belonging to this category folder
                      const folderAllTasks = tasks.filter(t => {
                        const meta = parseTaskMetadata(t, team);
                        const matchFolder = meta.category === folder;
                        const matchTag = selectedFunctionTag === 'All' || meta.initiative === selectedFunctionTag;
                        // CEO View: when ON, only show tasks owned by me
                        const matchOwner = ceoViewActive ? t.ownerId === authProfile?.id : true;
                        return matchFolder && matchTag && matchOwner;
                      });

                      // When a department filter is active, show ALL statuses; otherwise only ongoing
                      const showAllStatuses = selectedFunctionTag !== 'All';
                      const queuedTasks = folderAllTasks.filter(t => t.status === 'queued');
                      const ongoingTasks = folderAllTasks.filter(t => t.status === 'running' || t.status === 'paused');
                      const completedTasks = folderAllTasks.filter(t => t.status === 'completed');
                      const pendingCount = queuedTasks.length;

                      return (
                        <div 
                          key={folder}
                          onDragOver={(e) => {
                            e.preventDefault();
                          }}
                          onDragEnter={() => setDragOverFolder(folder)}
                          onDragLeave={() => setDragOverFolder(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverFolder(null);
                            const taskId = e.dataTransfer.getData('text/plain');
                            if (taskId) {
                              handleMoveTaskCategory(taskId, folder);
                            }
                          }}
                          className={`bg-white border ${
                            dragOverFolder === folder 
                              ? 'border-[#406c58] border-dashed ring-4 ring-[#406c58]/10 bg-[#f4f6f4]' 
                              : 'border-[#e1e7e1]'
                          } ${theme.border} rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition-all duration-200`}
                        >
                          <div>
                            {/* Business Header */}
                            <div className="flex items-start justify-between border-b border-[#e1e7e1]/60 pb-3 mb-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-8 h-8 rounded-xl ${theme.badgeBg} ${theme.text} flex items-center justify-center font-bold text-xs tracking-wider font-headline shadow-inner shrink-0`}>
                                  {theme.initials}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-xs font-black font-headline uppercase tracking-wide text-stone-850 truncate leading-tight">
                                    {folder}
                                  </h3>
                                  <p className="text-[7px] font-black tracking-widest text-stone-500 uppercase mt-0.5 leading-none">{theme.label}</p>
                                </div>
                              </div>
                              <span className="text-[8px] font-black text-stone-550 bg-stone-100 border border-[#e1e7e1] px-2 py-0.5 rounded-lg shrink-0 font-mono">
                                {folderAllTasks.length} spec{folderAllTasks.length !== 1 ? 's' : ''}
                              </span>
                            </div>

                            {/* Inline Add Task Input */}
                            <div className="relative mb-3.5">
                              <input
                                type="text"
                                placeholder={`+ Add task to ${folder}...`}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                    handleCreateTaskWithAutoCategorize(e.currentTarget.value.trim(), folder);
                                    e.currentTarget.value = '';
                                  }
                                }}
                                className="w-full bg-[#f4f6f4] hover:bg-stone-50 border border-[#e1e7e1] rounded-xl px-3 py-1.5 text-[10px] font-semibold text-[#1a2620] outline-none focus:border-[#406c58] transition-all placeholder-stone-400"
                              />
                            </div>

                            {/* Task List: show ALL statuses when department filter is active */}
                            <div className="max-h-[385px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                              {/* Queued Tasks (shown when department filter is active) */}
                              {showAllStatuses && queuedTasks.length > 0 && (
                                <>
                                  <p className="text-[7px] font-black uppercase tracking-widest text-stone-450 mt-1">📋 Queued ({queuedTasks.length})</p>
                                  {queuedTasks.map(task => {
                                    const owner = team.find(m => m.id === task.ownerId);
                                    return (
                                      <div key={task.id} onClick={() => setSelectedTask(task)} className={`p-3 ${theme.bg} hover:bg-stone-50/55 border border-[#e1e7e1]/80 hover:border-[#406c58] rounded-xl cursor-pointer transition-all duration-155 space-y-1.5 shadow-sm`}>
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex items-start gap-2 min-w-0 flex-1">
                                            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-stone-350" />
                                            <span className="text-[11px] font-bold text-stone-850 block leading-tight truncate">{task.title}</span>
                                          </div>
                                          <span className="text-[7px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-headline leading-none shrink-0">QUEUED</span>
                                        </div>
                                        {owner && <div className="flex items-center gap-1.5 text-[9px] text-stone-600"><img src={owner.imgUrl} className="w-4 h-4 rounded-full object-cover border border-[#e1e7e1]" alt="" /><span className="truncate font-semibold">{owner.name}</span></div>}
                                      </div>
                                    );
                                  })}
                                </>
                              )}

                              {/* Ongoing Tasks (always shown) */}
                              {ongoingTasks.length > 0 && (
                                <>
                                  {showAllStatuses && <p className="text-[7px] font-black uppercase tracking-widest text-stone-450 mt-1">⚡ Active ({ongoingTasks.length})</p>}
                                  {ongoingTasks.map(task => {
                                    const owner = team.find(m => m.id === task.ownerId);
                                    const workflowTotal = task.workflow?.length || 0;
                                    const workflowDone = task.workflow?.filter(w => w.isCompleted).length || 0;
                                    const percent = workflowTotal > 0 ? Math.round((workflowDone / workflowTotal) * 100) : 0;
                                    
                                    return (
                                      <div
                                        key={task.id}
                                        draggable={true}
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData('text/plain', task.id);
                                          e.dataTransfer.effectAllowed = 'move';
                                        }}
                                        onClick={() => setSelectedTask(task)}
                                        className={`p-3 ${theme.bg} hover:bg-stone-50/55 border border-[#e1e7e1]/80 hover:border-[#406c58] rounded-xl cursor-grab active:cursor-grabbing transition-all duration-155 space-y-2.5 group/taskitem shadow-sm active:scale-[0.98] active:translate-y-[0.5px]`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex items-start gap-2 min-w-0 flex-1">
                                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                                              task.status === 'running' ? 'bg-amber-500 animate-pulse' : 'bg-stone-450'
                                            }`} />
                                            <div className="min-w-0 flex-1">
                                              <span className="text-[11px] font-bold text-stone-850 block leading-tight truncate group-hover/taskitem:text-[#406c58] transition-colors">
                                                {task.title}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="shrink-0 flex items-center gap-1.5">
                                            {task.status === 'running' ? (
                                              <div className="flex items-center gap-1">
                                                <span className="text-[7px] font-black tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded uppercase font-headline leading-none">ACTIVE</span>
                                                <span className="font-mono text-[9px] font-black text-amber-700 bg-amber-50/70 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-0.5 leading-none">
                                                  <span className="material-symbols-outlined text-[9px] block">schedule</span>
                                                  {fmt(task.elapsedSec)}
                                                </span>
                                              </div>
                                            ) : (
                                              <span className="text-[7px] font-black uppercase tracking-wider text-stone-550 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded font-headline leading-none">PAUSED</span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between text-[9px] text-stone-600 border-t border-[#e1e7e1]/40 pt-2 shrink-0">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            {owner ? (
                                              <>
                                                <img src={owner.imgUrl} className="w-4 h-4 rounded-full object-cover border border-[#e1e7e1] shrink-0" alt="" />
                                                <span className="truncate font-semibold text-stone-750">{owner.name}</span>
                                              </>
                                            ) : (
                                              <span className="italic text-stone-450">Unassigned</span>
                                            )}
                                          </div>
                                          <span className="font-mono text-[8px] font-bold text-stone-500 shrink-0">
                                            {workflowDone}/{workflowTotal} steps ({percent}%)
                                          </span>
                                        </div>
                                        {workflowTotal > 0 && (
                                          <div className="w-full bg-stone-150 h-1 rounded-full overflow-hidden shrink-0">
                                            <div className={`h-full rounded-full transition-all duration-300 ${
                                              task.status === 'running' ? 'bg-[#406c58]' : 'bg-stone-400'
                                            }`} style={{ width: `${percent}%` }} />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </>
                              )}

                              {/* Completed Tasks (shown when department filter is active) */}
                              {showAllStatuses && completedTasks.length > 0 && (
                                <>
                                  <p className="text-[7px] font-black uppercase tracking-widest text-stone-450 mt-1">✅ Completed ({completedTasks.length})</p>
                                  {completedTasks.map(task => {
                                    const owner = team.find(m => m.id === task.ownerId);
                                    return (
                                      <div key={task.id} onClick={() => setSelectedTask(task)} className={`p-3 bg-emerald-50/30 hover:bg-emerald-50/60 border border-emerald-200/40 rounded-xl cursor-pointer transition-all duration-155 space-y-1.5 shadow-sm opacity-75`}>
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex items-start gap-2 min-w-0 flex-1">
                                            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-emerald-500" />
                                            <span className="text-[11px] font-bold text-stone-700 block leading-tight truncate line-through">{task.title}</span>
                                          </div>
                                          <span className="text-[7px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-headline leading-none shrink-0">DONE</span>
                                        </div>
                                        {owner && <div className="flex items-center gap-1.5 text-[9px] text-stone-500"><img src={owner.imgUrl} className="w-4 h-4 rounded-full object-cover border border-[#e1e7e1]" alt="" /><span className="truncate font-semibold">{owner.name}</span></div>}
                                      </div>
                                    );
                                  })}
                                </>
                              )}

                              {/* Empty State */}
                              {ongoingTasks.length === 0 && (!showAllStatuses || (queuedTasks.length === 0 && completedTasks.length === 0)) && (
                                <div className="py-5 text-center border border-dashed border-[#e1e7e1] rounded-xl bg-white/40">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-stone-450 flex items-center justify-center gap-1.5">
                                    <span className="material-symbols-outlined text-[10px] text-emerald-500 font-bold">check_circle</span>
                                    Operational · Standby
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Business Card Footer metrics */}
                          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-stone-500 border-t border-[#e1e7e1]/45 pt-2 shrink-0 font-headline">
                            <span className="flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-stone-400" />
                              {pendingCount} Queued
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-emerald-500" />
                              {completedTasks.length} Completed
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Active Document Editor */
              <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                
                {/* Breadcrumb Path Bar */}
                {(() => {
                  const editorTaskMeta = parseTaskMetadata(selectedTask, team);
                  const editorTaskTheme = getCategoryTheme(selectedTask.category || editorTaskMeta.category);
                  return (
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-stone-500 shrink-0">
                      <span onClick={() => setSelectedTask(null)} className="hover:underline hover:text-[#406c58] cursor-pointer transition-colors duration-150">Vault</span>
                      <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border border-current tracking-wider ${editorTaskTheme.text} ${editorTaskTheme.badgeBg} leading-none`}>
                        {selectedTask.category || editorTaskMeta.category}
                      </span>
                      <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                      <span className="text-stone-600 truncate max-w-[150px]">
                        {selectedTask.title || 'Untitled Spec'}
                      </span>
                    </div>
                  );
                })()}

                {/* Main scrollable editor contents */}
                <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
                  
                  {/* Document Title */}
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={selectedTask.title}
                      onChange={e => updateSelectedTaskField({ title: e.target.value })}
                      className="w-full text-2xl font-bold bg-transparent outline-none border-b border-stone-200 focus:border-[#406c58]/40 pb-2 text-[#1a2620] font-headline tracking-tight"
                      placeholder="Untitled Spec"
                    />
                  </div>

                  {/* Obsidian Metadata Properties Block */}
                  <div className="bg-[#f4f6f4] border border-[#e1e7e1] rounded-2xl p-4 space-y-3.5 shrink-0 text-xs">
                    <div className="text-[9px] font-black uppercase tracking-widest text-[#406c58] border-b border-[#e1e7e1] pb-1.5 mb-2 font-headline">
                      Spec Properties
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Owner Dropdown */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-stone-550 font-headline">Owner</label>
                        <select
                          value={selectedTask.ownerId || ''}
                          onChange={e => updateSelectedTaskField({ ownerId: e.target.value })}
                          className="w-full bg-white border border-[#e1e7e1] rounded-xl py-1.5 px-3 outline-none text-[#1a2620] font-semibold text-xs focus:border-[#406c58]/40 transition-colors"
                        >
                          <option value="">Unassigned</option>
                          {team.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Category Dropdown */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-stone-550 font-headline">Business Folder</label>
                        <select
                          value={selectedTask.category || parseTaskMetadata(selectedTask, team).category}
                          onChange={e => {
                            const newCat = e.target.value;
                            updateSelectedTaskField({ category: newCat });
                          }}
                          className="w-full bg-white border border-[#e1e7e1] rounded-xl py-1.5 px-3 outline-none text-[#1a2620] font-semibold text-xs focus:border-[#406c58]/40 transition-colors"
                        >
                          {categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Function Tag is auto-classified from task title */}

                      {/* Impact Level Dropdown */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-stone-550 font-headline">Impact</label>
                        <select
                          value={selectedTask.impact || 'Medium'}
                          onChange={e => updateSelectedTaskField({ impact: e.target.value as ImpactLevel })}
                          className="w-full bg-white border border-[#e1e7e1] rounded-xl py-1.5 px-3 outline-none text-[#1a2620] font-semibold text-xs focus:border-[#406c58]/40 transition-colors"
                        >
                          {IMPACT_LEVELS.map(imp => (
                            <option key={imp} value={imp}>{imp}</option>
                          ))}
                        </select>
                      </div>

                      {/* Complexity Level Dropdown */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-stone-550 font-headline">Complexity</label>
                        <select
                          value={selectedTask.complexity || 'Medium'}
                          onChange={e => updateSelectedTaskField({ complexity: e.target.value as ComplexityLevel })}
                          className="w-full bg-white border border-[#e1e7e1] rounded-xl py-1.5 px-3 outline-none text-[#1a2620] font-semibold text-xs focus:border-[#406c58]/40 transition-colors"
                        >
                          {COMPLEXITY_LEVELS.map(comp => (
                            <option key={comp} value={comp}>{comp}</option>
                          ))}
                        </select>
                      </div>

                      {/* Estimated Duration minutes */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-stone-550 font-headline">Est. Time (Mins)</label>
                        <input
                          type="number"
                          value={Math.round(selectedTask.totalSec / 60) || 60}
                          onChange={e => updateSelectedTaskField({ totalSec: Number(e.target.value) * 60 })}
                          className="w-full bg-white border border-[#e1e7e1] rounded-xl py-1.5 px-3 outline-none text-[#1a2620] font-semibold text-xs text-center focus:border-[#406c58]/40 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Dynamic Live Points Indicator */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#e1e7e1] mt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-[#406c58]">military_tech</span>
                        <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider font-headline">Calculated Rewards:</span>
                      </div>
                      
                      {/* Calculate live rewards based on properties */}
                      {(() => {
                        const activePointConfig = getActivePointConfig(meritConfig);
                        const definition = taskDefinitions.find(d => d.title.toLowerCase() === selectedTask.title.toLowerCase());
                        const durationMins = Math.round(selectedTask.totalSec / 60) || 60;
                        const pointCalc = calculateTaskPoints(
                          selectedTask.title,
                          getCleanNote(selectedTask.note),
                          durationMins,
                          activePointConfig,
                          definition ? { ...definition, estimatedMins: durationMins } : undefined,
                          selectedTask.impact,
                          selectedTask.complexity
                        );
                        return (
                          <span className="text-xs font-black text-[#406c58] font-mono">
                            +{pointCalc.points} pts · {pointCalc.tierName}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Document Directives Notes */}
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-stone-550 block ml-1 font-headline">Directives Notes</label>
                    <textarea
                      value={getCleanNote(selectedTask.note)}
                      onChange={e => updateSelectedTaskField({ note: e.target.value })}
                      className="w-full bg-[#f4f6f4] border border-[#e1e7e1] rounded-2xl p-4 text-xs font-medium leading-relaxed text-[#1a2620] outline-none focus:border-[#406c58]/40 transition-colors h-48 resize-none custom-scrollbar"
                      placeholder="Decompose task scope here. Describe the expected outcomes, execution guidelines, and calibration standards..."
                    />
                  </div>

                  {/* Document Sub-steps checklist */}
                  <div className="space-y-3 border-t border-[#e1e7e1] pt-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[8px] font-black uppercase tracking-widest text-stone-550 ml-1 font-headline">Execution Steps Checklist</label>
                      <span className="text-[9px] font-black text-[#406c58] bg-[#406c58]/5 border border-[#406c58]/15 px-2 py-0.5 rounded-full font-headline">
                        {selectedTask.workflow?.filter(w => w.isCompleted).length || 0} / {selectedTask.workflow?.length || 0} completed
                      </span>
                    </div>

                    {/* Step list */}
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {selectedTask.workflow?.map(step => (
                        <div key={step.id} className="flex items-center justify-between p-2.5 bg-white border border-[#e1e7e1] hover:border-stone-300 rounded-xl transition-all group/step">
                          <div
                            onClick={() => {
                              const updated = selectedTask.workflow?.map(w => w.id === step.id ? { ...w, isCompleted: !w.isCompleted } : w) || [];
                              updateSelectedTaskField({ workflow: updated });
                            }}
                            className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1"
                          >
                            <span className="material-symbols-outlined text-[18px] text-[#406c58] shrink-0">
                              {step.isCompleted ? 'check_box' : 'check_box_outline_blank'}
                            </span>
                            <span className={`text-xs truncate ${step.isCompleted ? 'line-through text-stone-400' : 'text-stone-700 font-semibold'}`}>
                              {step.name}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => {
                              const updated = selectedTask.workflow?.filter(w => w.id !== step.id) || [];
                              updateSelectedTaskField({ workflow: updated });
                            }}
                            className="opacity-0 group-hover/step:opacity-100 p-0.5 hover:bg-rose-50 rounded text-stone-500 hover:text-rose-600 transition-all shrink-0 ml-2 cursor-pointer active:scale-[0.93] active:translate-y-[0.5px]"
                            title="Delete Step"
                          >
                            <span className="material-symbols-outlined text-[14px] block">delete</span>
                          </button>
                        </div>
                      ))}
                      {(!selectedTask.workflow || selectedTask.workflow.length === 0) && (
                        <p className="text-[10px] text-stone-550 italic text-center py-4">No checklist steps defined. Add one below.</p>
                      )}
                    </div>

                    {/* Quick Add Step */}
                    <div className="flex gap-2">
                      <input
                        value={newWorkflowStep}
                        onChange={e => setNewWorkflowStep(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newWorkflowStep.trim()) {
                              const newStep = { id: 'wf-' + Date.now(), name: newWorkflowStep.trim(), isCompleted: false };
                              updateSelectedTaskField({ workflow: [...(selectedTask.workflow || []), newStep] });
                              setNewWorkflowStep('');
                            }
                          }
                        }}
                        placeholder="Add a new milestone/checkpoint step..."
                        className="flex-1 bg-[#f4f6f4] border border-[#d8e2d8] rounded-xl px-4 py-2 text-xs font-semibold text-[#1a2620] outline-none focus:border-[#406c58]/40 transition-colors"
                      />
                      <button
                        onClick={() => {
                          if (newWorkflowStep.trim()) {
                            const newStep = { id: 'wf-' + Date.now(), name: newWorkflowStep.trim(), isCompleted: false };
                            updateSelectedTaskField({ workflow: [...(selectedTask.workflow || []), newStep] });
                            setNewWorkflowStep('');
                          }
                        }}
                        className="bg-[#406c58] hover:bg-[#335746] text-white px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer shadow-sm"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                </div>

                {/* Footer Controls Pane */}
                <div className="border-t border-[#e1e7e1] pt-4 flex flex-wrap gap-3 items-center justify-between shrink-0 bg-white">
                  
                  {/* Left Controls: Delete / Save */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleDeleteTask(selectedTask.id);
                        setSelectedTask(null);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-stone-250 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 text-stone-600 text-[10px] font-black uppercase tracking-widest transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                    >
                      Delete
                    </button>
                    <button
                      onClick={handleSaveSelectedTask}
                      className="px-5 py-2.5 bg-[#406c58] hover:bg-[#335746] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] shadow-md cursor-pointer"
                    >
                      Save Spec
                    </button>
                  </div>

                  {/* Right Controls: Task Runner Override */}
                  <div className="flex items-center gap-3">
                    {selectedTask.status === 'completed' ? (
                      <span className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        Spec Completed
                      </span>
                    ) : selectedTask.status === 'running' ? (
                      <div className="flex items-center gap-3 bg-amber-50/50 border border-amber-200 rounded-xl px-3 py-1">
                        <div className="text-right">
                          <p className="text-[7px] font-black uppercase text-amber-600">Running Timer</p>
                          <span className="font-mono text-xs font-black text-amber-700">{fmt(selectedTask.elapsedSec)}</span>
                        </div>
                        <button
                          onClick={() => handleForcePause(selectedTask.id)}
                          className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                        >
                          Pause
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {selectedTask.ownerId ? (
                          <button
                            onClick={() => handleStartTask(selectedTask.id)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                          >
                            Begin Timer
                          </button>
                        ) : (
                          <span className="text-[9px] text-stone-500 italic">Assign owner to run</span>
                        )}
                        <button
                          onClick={() => handleForceComplete(selectedTask.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                        >
                          Complete Spec
                        </button>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}
          </section>

          {/* COLUMN 3: RADAR & SYSTEM SETTINGS (3/12) */}
          <section className="xl:col-span-3 bg-white border border-[#e1e7e1] rounded-3xl p-5 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 relative">
            <div className="relative space-y-6 flex-1 flex-col overflow-hidden">
              {/* Tab Navigation */}
              <div className="grid grid-cols-4 gap-1 bg-[#f4f6f4] border border-[#e1e7e1] rounded-xl p-1 shrink-0">
                {(['team', 'economy', 'resolutions', 'settings'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveRightTab(tab)}
                    className={`py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer ${
                      activeRightTab === tab ? 'bg-[#406c58] text-white font-bold font-headline' : 'text-stone-500 hover:text-stone-850'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* TAB 1: RADAR */}
              {activeRightTab === 'team' && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar animate-fade-in">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-stone-600 font-headline">Personnel Operations</h3>
                    <p className="text-[8px] text-stone-400 uppercase tracking-widest font-black mt-0.5">Ticking active staff timers</p>
                  </div>

                  <div className="space-y-3 pt-2">
                    {team.map(member => {
                      const activeTasks = tasks.filter(t => t.ownerId === member.id && t.status === 'running');
                      const currentTask = activeTasks[activeTasks.length - 1];
                      const isRunning = !!currentTask;
                      
                      const efficiencyColor = 'text-[#406c58] bg-[#406c58]/5 border-[#406c58]/15';

                      return (
                        <div key={member.id} className="p-4 bg-[#f8faf8] border border-[#e1e7e1] rounded-2xl space-y-3 relative overflow-hidden">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <img src={member.imgUrl} className="w-8 h-8 rounded-full object-cover border border-[#e1e7e1]" alt="" />
                              <div>
                                <h4 className="text-xs font-bold text-stone-855">{member.name}</h4>
                                <p className="text-[8px] font-black uppercase text-stone-400 mt-0.5">Dept: {member.department}</p>
                              </div>
                            </div>
                            
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${efficiencyColor}`}>
                              Points: {member.monthPoints || 0}
                            </span>
                          </div>

                          {/* Task timer indicator */}
                          {isRunning ? (() => {
                            const currentTaskMeta = parseTaskMetadata(currentTask, team);
                            const currentTaskTheme = getCategoryTheme(currentTaskMeta.category);
                            return (
                              <div className="bg-white border border-[#e1e7e1] p-3 rounded-xl space-y-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1 min-w-0 pr-2">
                                    <div className="flex items-center gap-1">
                                      <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border border-current tracking-wider ${currentTaskTheme.text} ${currentTaskTheme.badgeBg} uppercase font-headline leading-none`}>
                                        {currentTaskMeta.category}
                                      </span>
                                    </div>
                                    <h5 className="text-[11px] font-bold text-stone-850 truncate mt-1.5 leading-tight">{currentTask.title}</h5>
                                  </div>
                                  <span className={`font-mono text-xs font-black shrink-0 ${currentTaskTheme.text}`}>
                                    {fmt(currentTask.elapsedSec)}
                                  </span>
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t border-[#e1e7e1] gap-3">
                                  <button
                                    onClick={() => handleForcePause(currentTask.id)}
                                    className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[8px] font-black uppercase tracking-wider rounded-lg transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                                  >
                                    Pause
                                  </button>
                                  <button
                                    onClick={() => handleForceComplete(currentTask.id)}
                                    className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[8px] font-black uppercase tracking-wider rounded-lg transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                                  >
                                    Complete
                                  </button>
                                </div>
                              </div>
                            );
                          })() : (
                            <div className="py-2 text-center bg-white border border-[#e1e7e1] rounded-xl">
                              <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 font-headline">Standby</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: ECONOMY MANAGER */}
              {activeRightTab === 'economy' && (
                <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar animate-fade-in">
                  
                  {/* Redemption Queue */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-stone-600">Redemption Queue</h4>
                    <div className="space-y-2">
                      {redemptions.filter(r => r.status === 'pending').map(red => (
                        <div key={red.id} className="p-3 bg-[#f8faf8] border border-[#e1e7e1] rounded-xl flex justify-between items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-stone-850 truncate">{red.rewards?.title}</h5>
                            <p className="text-[8px] font-black uppercase text-stone-400 mt-0.5">By: {red.profiles?.full_name}</p>
                          </div>
                          
                          <button
                            onClick={() => handleFulfillRedemption(red.id)}
                            className="px-3 py-1 bg-[#406c58] hover:bg-[#335746] text-white text-[8px] font-black uppercase tracking-widest rounded-lg transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer shrink-0"
                          >
                            Approve
                          </button>
                        </div>
                      ))}
                      {redemptions.filter(r => r.status === 'pending').length === 0 && (
                        <p className="text-[10px] text-stone-400 italic text-center py-2">No redemptions pending.</p>
                      )}
                    </div>
                  </div>

                  {/* Deploy Bounties */}
                  <form onSubmit={handlePostBounty} className="space-y-3 border-t border-[#e1e7e1] pt-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-stone-600">Deploy Open Bounty</h4>
                    <input
                      required
                      value={newBounty.title}
                      onChange={e => setNewBounty(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Bounty title..."
                      className="w-full bg-[#f2f5f2] border border-[#d8e2d8] rounded-xl px-4 py-2 text-xs font-bold text-[#1a2620] outline-none focus:border-[#406c58]/40"
                    />
                    <textarea
                      required
                      value={newBounty.description}
                      onChange={e => setNewBounty(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Task directives..."
                      className="w-full bg-[#f2f5f2] border border-[#d8e2d8] rounded-xl px-4 py-2 text-xs font-medium text-[#1a2620] outline-none h-16 resize-none focus:border-[#406c58]/40"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={newBounty.points}
                        onChange={e => setNewBounty(prev => ({ ...prev, points: Number(e.target.value) }))}
                        placeholder="Points..."
                        className="flex-1 bg-[#f2f5f2] border border-[#d8e2d8] rounded-xl px-4 py-2 text-xs font-black text-[#1a2620] text-center outline-none focus:border-[#406c58]/40"
                      />
                      <button
                        type="submit"
                        className="px-4 bg-[#406c58] hover:bg-[#335746] text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                      >
                        Deploy
                      </button>
                    </div>
                  </form>

                  {/* Deploy Rewards */}
                  <form onSubmit={handlePostReward} className="space-y-3 border-t border-[#e1e7e1] pt-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-stone-600">Deploy Shop Item</h4>
                    <input
                      required
                      value={newReward.title}
                      onChange={e => setNewReward(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Reward item title..."
                      className="w-full bg-[#f2f5f2] border border-[#d8e2d8] rounded-xl px-4 py-2 text-xs font-bold text-[#1a2620] outline-none focus:border-[#406c58]/40"
                    />
                    <input
                      required
                      value={newReward.description}
                      onChange={e => setNewReward(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Item details..."
                      className="w-full bg-[#f2f5f2] border border-[#d8e2d8] rounded-xl px-4 py-2 text-xs font-medium text-[#1a2620] outline-none focus:border-[#406c58]/40"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={newReward.points}
                        onChange={e => setNewReward(prev => ({ ...prev, points: Number(e.target.value) }))}
                        placeholder="Point cost..."
                        className="flex-1 bg-[#f2f5f2] border border-[#d8e2d8] rounded-xl px-4 py-2 text-xs font-black text-[#1a2620] text-center outline-none focus:border-[#406c58]/40"
                      />
                      <button
                        type="submit"
                        className="px-4 bg-[#406c58] hover:bg-[#335746] text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                      >
                        Deploy Shop
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: DISPUTES TRIAGE */}
              {activeRightTab === 'resolutions' && (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar animate-fade-in">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-stone-600 font-headline">Point Disputes Triage</h3>
                    <p className="text-[8px] text-stone-400 uppercase tracking-widest font-black mt-0.5">Approve or reject staff point claims</p>
                  </div>

                  {appeals.filter(a => !a.resolved).map(appeal => (
                    <div key={appeal.id} className="p-4 bg-white border border-[#e1e7e1] rounded-2xl space-y-3">
                      <div className="flex items-center gap-3">
                        <img src={appeal.imgUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                        <div>
                          <h4 className="text-xs font-bold text-stone-850">{appeal.staffName}</h4>
                          <p className="text-[8px] font-black uppercase text-stone-400 mt-0.5">{appeal.department} · {appeal.taskTitle}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-stone-500 bg-[#f2f5f2] p-2.5 rounded-xl border border-[#e1e7e1] font-medium leading-relaxed">
                        "{appeal.appealComment}"
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolveAppeal(appeal.id, appeal.originalPoints, 'Approved')}
                          className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectAppeal(appeal.id, 'Disapproved')}
                          className="flex-1 py-1.5 bg-rose-55 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                  {appeals.filter(a => !a.resolved).length === 0 && (
                    <p className="text-xs text-stone-450 italic text-center py-6">No pending disputes.</p>
                  )}
                </div>
              )}

              {/* TAB 4: GOVERNANCE SETTINGS */}
              {activeRightTab === 'settings' && (
                <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar animate-fade-in">
                  
                  {/* Target Baseline */}
                  <div className="p-4 bg-white border border-[#e1e7e1] rounded-2xl space-y-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-stone-500 font-headline">Global weekly threshold</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={weeklyThresholdInput}
                        onChange={e => setWeeklyThresholdInput(Number(e.target.value))}
                        className="flex-1 bg-[#f2f5f2] border border-[#d8e2d8] rounded-lg px-3 py-2 text-xs font-black text-[#1a2620] text-center"
                      />
                      <button
                        onClick={handleSaveThreshold}
                        className="px-4 bg-[#406c58] hover:bg-[#335746] text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                      >
                        Sync
                      </button>
                    </div>
                  </div>

                  {/* Personnel Directory */}
                  <div className="space-y-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-stone-500 font-headline">Enroll new credentials</p>
                    <div className="p-4 bg-white border border-[#e1e7e1] rounded-2xl space-y-3">
                      <input
                        value={newStaffName}
                        onChange={e => setNewStaffName(e.target.value)}
                        placeholder="Full name..."
                        className="w-full bg-[#f2f5f2] border border-[#d8e2d8] rounded-lg px-3 py-2 text-xs font-bold text-[#1a2620] outline-none"
                      />
                      <input
                        value={newStaffDept}
                        onChange={e => setNewStaffDept(e.target.value)}
                        placeholder="Department..."
                        list="enrolled-departments-staff"
                        className="w-full bg-[#f2f5f2] border border-[#d8e2d8] rounded-lg px-3 py-2 text-xs font-bold text-[#1a2620] outline-none"
                      />
                      <datalist id="enrolled-departments-staff">
                        {Object.keys(orgConfig.departments || {}).map(dept => (
                          <option key={dept} value={dept} />
                        ))}
                      </datalist>
                      <div className="flex gap-2">
                        <input
                          value={newStaffPass}
                          onChange={e => setNewStaffPass(e.target.value)}
                          placeholder="Passcode..."
                          className="flex-1 bg-[#f2f5f2] border border-[#d8e2d8] rounded-lg px-3 py-2 text-xs font-black text-[#1a2620] text-center"
                        />
                        <button
                          type="button"
                          onClick={() => setNewStaffPass(Math.floor(100000 + Math.random() * 900000).toString())}
                          className="p-2 bg-stone-100 border border-[#e1e7e1] rounded-lg text-stone-550 hover:text-stone-700 cursor-pointer transition-all duration-150 active:scale-[0.93] active:translate-y-[0.5px]"
                        >
                          <span className="material-symbols-outlined text-[16px] block">refresh</span>
                        </button>
                      </div>
                      <button
                        onClick={handleEnrollStaff}
                        className="w-full py-2 bg-[#406c58] hover:bg-[#335746] text-white font-black uppercase tracking-widest text-[9px] rounded-lg transition-colors duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                      >
                        Deploy Credentials
                      </button>
                    </div>
                  </div>

                  {/* Department & Job Scope Directory */}
                  <div className="space-y-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-stone-500 font-headline">Configure Department Job Scopes</p>
                    
                    {/* List of existing departments */}
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                      {Object.entries(orgConfig.departments || {}).map(([deptName, deptObj]) => (
                        <div key={deptName} className="p-3 bg-white border border-[#e1e7e1] rounded-xl flex flex-col gap-1.5 relative">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-stone-800 uppercase tracking-wider">{deptName}</span>
                            <button
                              onClick={() => handleDeleteDepartment(deptName)}
                              className="p-1 hover:bg-[#f2f5f2] rounded text-stone-500 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Remove Department"
                            >
                              <span className="material-symbols-outlined text-[13px] block">delete</span>
                            </button>
                          </div>
                          <p className="text-[9px] text-stone-600 whitespace-pre-wrap leading-relaxed font-semibold">
                            {deptObj.jobScope}
                          </p>
                        </div>
                      ))}
                      {Object.keys(orgConfig.departments || {}).length === 0 && (
                        <p className="text-[10px] text-stone-500 italic py-2 text-center">No custom departments configured.</p>
                      )}
                    </div>

                    {/* Add Department Form */}
                    <div className="p-4 bg-white border border-[#e1e7e1] rounded-2xl space-y-3">
                      <input
                        value={newDeptName}
                        onChange={e => setNewDeptName(e.target.value)}
                        placeholder="Department name..."
                        className="w-full bg-[#f2f5f2] border border-[#d8e2d8] rounded-lg px-3 py-2 text-xs font-bold text-[#1a2620] outline-none"
                      />
                      <textarea
                        value={newDeptScope}
                        onChange={e => setNewDeptScope(e.target.value)}
                        placeholder="Pre-set Job Scope & Daily Routine (e.g. tasks list)..."
                        rows={3}
                        className="w-full bg-[#f2f5f2] border border-[#d8e2d8] rounded-lg px-3 py-2 text-xs font-bold text-[#1a2620] outline-none resize-none"
                      />
                      <button
                        onClick={handleSaveDepartment}
                        className="w-full py-2 bg-[#406c58] hover:bg-[#335746] text-white font-black uppercase tracking-widest text-[9px] rounded-lg transition-colors duration-150 active:scale-[0.97] active:translate-y-[0.5px] cursor-pointer"
                      >
                        Save Department
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      )}



      {/* ──────────────────────────────────────────────────────────────────────────────────────────────────────────
          MAIN WORKSPACE CANVAS (STAFF VIEW)
      ────────────────────────────────────────────────────────────────────────────────────────────────────────── */}
      {!authProfile?.is_manager && (
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 p-6 h-[calc(100vh-80px)] overflow-hidden">
          
          {/* COLUMN 1: PERFORMANCE SUMMARY & MODULES (3/12) */}
          <section className="xl:col-span-3 bg-white border border-[#e1e7e1] rounded-3xl p-5 flex flex-col justify-between overflow-hidden shadow-sm relative">
            <div className="relative space-y-6 flex-1 flex flex-col overflow-hidden">
              {/* Circular Performance ring */}
              <div className="flex flex-col items-center p-4 bg-[#f8faf8] border border-[#e1e7e1] rounded-2xl text-center shrink-0">
                <div className="w-24 h-24 relative flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#e5eae5" strokeWidth="6" fill="transparent" />
                    <circle 
                      cx="48" cy="48" r="40" 
                      stroke="#406c58" strokeWidth="6" fill="transparent" 
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * Math.min(100, (weeklyPoints / (meritConfig.weeklyThreshold || 975)) * 100)) / 100}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <p className="text-sm font-black text-[#1a2620]">{weeklyPoints}</p>
                    <p className="text-[7px] text-stone-400 uppercase tracking-widest font-black">Points</p>
                  </div>
                </div>

                <h4 className="text-xs font-black uppercase text-[#1a2620] mt-3 tracking-widest">Weekly Performance</h4>
                <p className="text-[8px] text-stone-450 uppercase font-black tracking-widest mt-1">Goal: {meritConfig.weeklyThreshold || 975} pts</p>

                <div className="flex justify-between w-full border-t border-[#e1e7e1] pt-3 mt-4 text-[9px] font-black uppercase text-stone-500 tracking-wider">
                  <div>
                    <p className="text-[#1a2620]">{lifetimePoints}</p>
                    <p className="text-[7px]">Lifetime</p>
                  </div>
                  <div>
                    <p className="text-[#1a2620]">{Math.round(weeklyEfficiency * 100)}%</p>
                    <p className="text-[7px]">Efficiency</p>
                  </div>
                </div>
              </div>
 
              {/* Department Job Scope & Routines */}
              {authProfile?.department && (
                <div className="p-4 bg-[#f8faf8] border border-[#e1e7e1] rounded-2xl space-y-2 shrink-0 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center border-b border-[#e1e7e1]/60 pb-1.5">
                    <h4 className="text-[10px] font-black uppercase text-[#1a2620] tracking-widest flex items-center gap-1.5 font-headline">
                      <span className="material-symbols-outlined text-[#406c58] text-[15px]">assignment</span>
                      {authProfile.department} Job Scope
                    </h4>
                  </div>
                  <p className="text-[9px] font-semibold text-stone-600 leading-relaxed whitespace-pre-line max-h-[140px] overflow-y-auto custom-scrollbar">
                    {orgConfig.departments?.[authProfile.department]?.jobScope || 
                     (authProfile.department === 'Operations' ? '1. Perform daily car rental fleet checklist (refueling, cleaning, inspection).\n2. Coordinate client vehicle handovers.\n3. Log and report vehicle maintenance issues.' : 
                      authProfile.department === 'Marketing' ? '1. Create and schedule daily short-form TikTok promotion scripts and videos.\n2. Review and optimize consultancy ad campaigns.\n3. Track customer conversion and referral metrics.' :
                      authProfile.department === 'Software' ? '1. Monitor production server alerts and error logs.\n2. Execute routine database checks.\n3. Implement features according to active project blueprints.' :
                      authProfile.department === 'Finance' ? '1. Reconcile daily rental transactions.\n2. Process incoming contractor invoices.\n3. Prepare weekly profit & loss division reports.' :
                      authProfile.department === 'Strategic' ? '1. Align with business unit leaders on quarterly objectives.\n2. Review holding company cash flow allocations.' :
                      'No pre-set job scope defined for this department.')}
                  </p>
                </div>
              )}
 
              {/* Training Modules tab view */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center pb-2 border-b border-[#e1e7e1] mb-3 shrink-0">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#1a2620] flex items-center gap-1.5 font-headline">
                    <span className="material-symbols-outlined text-[#406c58] text-base">school</span>
                    Training matrix
                  </h3>
                </div>

                {/* Sub-view: Module Detail checklist */}
                {selectedModule ? (
                  <div className="flex-1 flex flex-col justify-between overflow-hidden animate-in fade-in duration-300">
                    <div className="overflow-y-auto space-y-4 pr-1 custom-scrollbar flex-1">
                      <div className="flex items-center gap-2 pb-2 border-b border-[#e1e7e1]">
                        <button
                          onClick={() => setSelectedModule(null)}
                          className="p-1 hover:bg-[#f4f6f4] border border-[#e1e7e1] rounded-lg text-stone-500 hover:text-stone-800 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px] block">arrow_back</span>
                        </button>
                        <h4 className="text-xs font-bold text-stone-850 line-clamp-1">{selectedModule.title}</h4>
                      </div>

                      <p className="text-[10px] text-stone-500 leading-relaxed font-medium bg-[#f4f6f4] p-3 rounded-xl border border-[#e1e7e1]">{selectedModule.description}</p>
                      
                      <div className="space-y-2.5">
                        {moduleSteps.filter(s => s.module_id === selectedModule.id).map(step => {
                          const enrollment = enrollments.find(e => e.module_id === selectedModule.id && e.staff_id === authProfile?.id);
                          const isStepCompleted = enrollment ? enrollment.current_step_order > step.step_order || enrollment.status === 'completed' : false;
                          const isStepActive = enrollment ? enrollment.current_step_order === step.step_order && enrollment.status !== 'completed' : false;

                          return (
                            <div key={step.id} className="p-3 bg-[#f4f6f4] border border-[#e1e7e1] rounded-xl space-y-2 relative overflow-hidden">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2">
                                  <span className={`material-symbols-outlined text-[16px] mt-0.5 ${
                                    isStepCompleted ? 'text-emerald-500' : isStepActive ? 'text-[#406c58]' : 'text-stone-300'
                                  }`}>
                                    {isStepCompleted ? 'check_circle' : 'circle'}
                                  </span>
                                  <div>
                                    <h5 className="text-[11px] font-bold text-stone-800 leading-tight">{step.title}</h5>
                                    <p className="text-[9px] text-stone-550 mt-1 leading-snug">{step.description}</p>
                                  </div>
                                </div>
                              </div>

                              {isStepActive && (
                                <button
                                  onClick={() => handleCompleteStep(selectedModule.id, step.step_order)}
                                  className="w-full mt-2 py-1.5 bg-[#406c58] hover:bg-[#335746] text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors cursor-pointer"
                                >
                                  Mark Step Complete
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Sub-view: Module grid list
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                    {modules.map(mod => {
                      const enrollment = enrollments.find(e => e.module_id === mod.id && e.staff_id === authProfile?.id);
                      const isEnrolled = !!enrollment;
                      const isCompleted = enrollment?.status === 'completed';
                      
                      const enrollmentBadge = 
                        isCompleted ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                        isEnrolled ? 'text-[#406c58] bg-[#406c58]/5 border-[#406c58]/15' :
                        'text-stone-500 bg-[#f2f5f2] border-[#e1e7e1]';

                      return (
                        <div
                          key={mod.id}
                          onClick={() => setSelectedModule(mod)}
                          className="p-3 bg-[#f2f5f2] border border-[#e1e7e1] hover:border-stone-350 rounded-2xl flex flex-col gap-2 cursor-pointer transition-all hover:-translate-y-0.5"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[8px] font-black uppercase text-[#406c58] tracking-widest">{mod.code}</p>
                              <h4 className="text-[11px] font-bold text-stone-800 leading-tight mt-0.5 line-clamp-1">{mod.title}</h4>
                            </div>
                            <span className="text-[9px] font-bold text-stone-500 font-mono">+{mod.meritValue} pts</span>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-[#e1e7e1]60">
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${enrollmentBadge}`}>
                              {isCompleted ? 'Completed' : isEnrolled ? 'In Progress' : 'Not Enrolled'}
                            </span>
                            {!isEnrolled && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleJoinModule(mod.id); }}
                                className="py-1 px-3 bg-[#406c58] hover:bg-[#335746] text-white text-[8px] font-black uppercase tracking-widest rounded-lg cursor-pointer"
                              >
                                Enroll
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* COLUMN 2: OPERATIONS TIMELINE (6/12) */}
          <section className="xl:col-span-6 flex flex-col gap-6 overflow-hidden">
            <div className="bg-white border border-[#e1e7e1] rounded-3xl p-5 flex-1 flex flex-col justify-between overflow-hidden shadow-sm relative">
              <div className="relative flex-1 flex flex-col space-y-6 overflow-hidden">
                <div className="flex justify-between items-end shrink-0">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-stone-605">Operational Missions</h3>
                    <p className="text-[8px] text-stone-400 uppercase tracking-widest font-black mt-0.5">Your daily schedule of tasks</p>
                  </div>
                  
                  <button
                    onClick={() => handleOpenAddTask('General')}
                    className="text-[9px] font-black uppercase tracking-widest bg-[#406c58] hover:bg-[#335746] text-white px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">add_task</span> New Mission
                  </button>
                </div>

                {/* Timeline Grid */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar pb-6 relative pl-6">
                  {/* Timeline vertical line */}
                  <div className="absolute left-[9px] top-4 bottom-8 w-0.5 bg-gradient-to-b from-[#406c58]/30 via-stone-200 to-transparent" />

                  {staffMissionsToday.map(task => {
                    const isActive = task.status === 'running';
                    const isPaused = task.status === 'paused';
                    
                    const cardBorder = 
                      isActive ? 'border-[#406c58]/30 bg-[#f4f6f4] shadow-sm' :
                      isPaused ? 'border-amber-300 bg-amber-50/10' :
                      'border-[#e1e7e1] bg-white';

                    return (
                      <div key={task.id} className="relative group animate-in fade-in duration-300">
                        {/* Timeline node */}
                        <div className={`absolute -left-[22px] top-6 w-3 h-3 rounded-full border border-white z-15 ${
                          isActive ? 'bg-[#406c58] ring-4 ring-[#406c58]/15' :
                          isPaused ? 'bg-amber-400 ring-4 ring-amber-500/15' :
                          'bg-stone-300'
                        }`} />

                        <div className={`border rounded-2xl p-5 space-y-4 transition-all hover:border-stone-300 relative ${cardBorder}`}>
                          <div className="flex justify-between items-start gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                  isActive ? 'text-[#406c58] bg-[#406c58]/10' :
                                  isPaused ? 'text-amber-600 bg-amber-50' :
                                  'text-stone-500 bg-stone-100'
                                }`}>
                                  {task.status}
                                </span>
                                <span className="text-[8px] font-black uppercase text-stone-500 tracking-wider bg-[#f2f5f2] border border-[#e1e7e1] px-2 py-0.5 rounded">
                                  {task.tierName}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-stone-850 mt-2">{task.title}</h4>
                            </div>
                            
                            <span className="font-mono text-xs font-black text-[#406c58] shrink-0">
                              +{task.points} pts
                            </span>
                          </div>

                          {task.note && (
                            <p className="text-[10px] text-stone-500 leading-relaxed font-medium bg-[#f4f6f4] p-2.5 rounded-xl border border-[#e1e7e1]40">{getCleanNote(task.note)}</p>
                          )}

                          {/* Workflow checklists */}
                          {task.workflow && task.workflow.length > 0 && (
                            <div className="space-y-2 bg-[#f4f6f4] p-3 rounded-xl border border-[#d8e2d8]/60">
                              <p className="text-[8px] font-black uppercase tracking-widest text-stone-500">Sub-steps Checklist</p>
                              <div className="space-y-1.5">
                                {task.workflow.map(step => (
                                  <div
                                    key={step.id}
                                    onClick={() => handleToggleWorkflowStep(task, step.id)}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <span className={`material-symbols-outlined text-[15px] ${
                                      step.isCompleted ? 'text-[#406c58]' : 'text-stone-300'
                                    }`}>
                                      {step.isCompleted ? 'check_box' : 'check_box_outline_blank'}
                                    </span>
                                    <span className={`text-[10px] ${
                                      step.isCompleted ? 'line-through text-stone-400' : 'text-stone-650'
                                    }`}>{step.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex justify-between items-center gap-4 pt-1.5 border-t border-[#e1e7e1]60">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleOpenEditTask(task)}
                                className="p-1.5 hover:bg-stone-100 border border-[#e1e7e1] rounded-lg text-stone-450 hover:text-stone-800 transition-all cursor-pointer"
                                title="Edit specs"
                              >
                                <span className="material-symbols-outlined text-[15px] block">edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-1.5 hover:bg-rose-50 border border-[#e1e7e1] hover:border-rose-200 rounded-lg text-stone-450 hover:text-rose-600 transition-all cursor-pointer"
                                title="Delete mission"
                              >
                                <span className="material-symbols-outlined text-[15px] block">delete</span>
                              </button>
                            </div>

                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => handleDisputeTask(task)}
                                className="px-3 py-1.5 bg-white border border-[#e1e7e1] hover:border-rose-350 hover:text-rose-600 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                              >
                                Dispute
                              </button>
                              
                              {task.status === 'queued' && (
                                <button
                                  onClick={() => handleStartTask(task.id)}
                                  className="px-4 py-1.5 bg-[#406c58] hover:bg-[#335746] text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                >
                                  <span className="material-symbols-outlined text-[14px]">play_arrow</span> Begin Now
                                </button>
                              )}

                              {task.status === 'running' && (
                                <>
                                  <button
                                    onClick={() => handlePauseTask(task.id)}
                                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                                  >
                                    Pause
                                  </button>
                                  <button
                                    onClick={() => handleCompleteTask(task.id)}
                                    className="px-4 py-1.5 bg-[#406c58] hover:bg-[#335746] text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm"
                                  >
                                    Mark Done
                                  </button>
                                </>
                              )}

                              {task.status === 'paused' && (
                                <>
                                  <button
                                    onClick={() => handleStartTask(task.id)}
                                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                                  >
                                    Resume
                                  </button>
                                  <button
                                    onClick={() => handleCompleteTask(task.id)}
                                    className="px-3 py-1.5 bg-[#406c58]/10 hover:bg-[#406c58] hover:text-white text-[#406c58] text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer border border-[#406c58]/20"
                                  >
                                    End
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {staffMissionsToday.length === 0 && (
                    <div className="text-center py-16 rounded-2xl border border-dashed border-[#e1e7e1] bg-[#f2f5f2] text-stone-400">
                      <span className="material-symbols-outlined text-[40px] mb-2 block opacity-40">task</span>
                      <p className="font-bold text-sm">Schedule cleared</p>
                      <p className="text-[10px] uppercase font-black tracking-widest mt-1">Decompose a new mission or claim bounties to begin</p>
                    </div>
                  )}

                  {/* Completed Archive Collapsible */}
                  <div className="mt-8 border-t border-[#e1e7e1] pt-4 shrink-0">
                    <button
                      onClick={() => setArchiveOpen(!archiveOpen)}
                      className="w-full flex justify-between items-center text-xs font-black uppercase tracking-widest text-stone-500 hover:text-stone-800 transition-colors py-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">history</span>
                        Completed Archive ({staffCompletedMissions.length} items)
                      </span>
                      <span className="material-symbols-outlined text-[18px]">{archiveOpen ? 'expand_less' : 'expand_more'}</span>
                    </button>

                    {archiveOpen && (
                      <div className="mt-4 space-y-3 animate-in slide-in-from-top-4 duration-300">
                        <input
                          value={archiveSearch}
                          onChange={e => setArchiveSearch(e.target.value)}
                          placeholder="Search archive..."
                          className="w-full bg-[#f2f5f2] border border-[#e1e7e1] rounded-xl px-4 py-2 text-xs font-semibold text-stone-700 outline-none focus:border-stone-300"
                        />

                        <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                          {staffCompletedMissions
                            .filter(t => !archiveSearch || t.title.toLowerCase().includes(archiveSearch.toLowerCase()))
                            .map(item => (
                              <div key={item.id} className="p-3 bg-white border border-[#e1e7e1] rounded-xl flex justify-between items-center shadow-sm">
                                <div>
                                  <h5 className="text-[11px] font-bold text-stone-800 leading-tight">{item.title}</h5>
                                  <p className="text-[8px] font-black uppercase text-stone-400 mt-0.5">Elapsed: {Math.round(item.elapsedSec / 60)}m · {item.completedAt?.substring(0, 10)}</p>
                                </div>
                                <span className="text-[10px] font-black text-emerald-600">+{item.points} pts</span>
                              </div>
                            ))}
                          {staffCompletedMissions.length === 0 && (
                            <p className="text-[10px] text-stone-400 italic text-center py-4">Archive empty.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* COLUMN 3: ACTIVE FOCUS & MARKETPLACE (3/12) */}
          <section className="xl:col-span-3 flex flex-col gap-6 overflow-hidden">
            
            {/* SUB-VIEW 1: ACTIVE FOCUS TIMER */}
            <div className="p-5 bg-white border border-[#e1e7e1] rounded-3xl flex flex-col items-center relative overflow-hidden shadow-sm shrink-0">
              <div className="relative w-full flex flex-col items-center space-y-4">
                <div className="w-full flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-wider text-stone-605 flex items-center gap-1.5 font-headline">
                    <span className="material-symbols-outlined text-[#406c58]">emergency_home</span>
                    Active Focus
                  </h3>
                  {activeFocusTask && (
                    <span className="w-2 h-2 rounded-full bg-[#406c58] animate-pulse"></span>
                  )}
                </div>

                {activeFocusTask ? (
                  <div className="w-full flex flex-col items-center text-center space-y-4">
                    {/* Ring Dial Timer */}
                    <div className="w-32 h-32 relative flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="56" stroke="#e5eae5" strokeWidth="8" fill="transparent" />
                        <circle 
                          cx="64" cy="64" r="56" 
                          stroke="#406c58" strokeWidth="8" fill="transparent" 
                          strokeDasharray={351.8}
                          strokeDashoffset={351.8 - (351.8 * Math.min(100, (activeFocusTask.elapsedSec / activeFocusTask.totalSec) * 100)) / 100}
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute">
                        <p className="text-lg font-mono font-black text-[#1a2620]">{fmt(activeFocusTask.elapsedSec)}</p>
                        <p className="text-[7px] text-stone-400 uppercase tracking-widest font-black">Elapsed</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-stone-850 line-clamp-1 leading-snug">{activeFocusTask.title}</h4>
                      <p className="text-[8px] font-black uppercase tracking-widest text-stone-450 mt-1">Estim. duration: {Math.round(activeFocusTask.totalSec / 60)} minutes</p>
                    </div>

                    <div className="flex gap-2.5 w-full">
                      <button
                        onClick={() => handlePauseTask(activeFocusTask.id)}
                        className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer border border-[#e1e7e1]"
                      >
                        Pause Timer
                      </button>
                      <button
                        onClick={() => handleCompleteTask(activeFocusTask.id)}
                        className="flex-1 py-2 bg-[#406c58] hover:bg-[#335746] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-sm"
                      >
                        Finish Ops
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center w-full">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">No active focus session</p>
                    <p className="text-[8px] text-stone-400 font-bold uppercase mt-1">Begin focus on any itinerary task</p>
                  </div>
                )}
              </div>
            </div>

            {/* SUB-VIEW 2: MARKETPLACE & LEADERBOARD TABS */}
            <div className="flex-1 bg-white border border-[#e1e7e1] rounded-3xl p-5 flex flex-col justify-between overflow-hidden shadow-sm relative">
              <div className="relative space-y-4 flex-1 flex flex-col overflow-hidden">
                
                {activeView === 'missions' && (
                  <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                    <div className="flex justify-between items-center border-b border-[#e1e7e1] pb-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#1a2620] font-headline">Leaderboard Standings</h4>
                    </div>

                    <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 custom-scrollbar">
                      {sortedLeaderboard.map((member, index) => {
                        const isSelf = member.id === authProfile?.id;
                        return (
                          <div 
                            key={member.id} 
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                              isSelf ? 'bg-[#406c58]/5 border-[#406c58]/20' : 'bg-[#f2f5f2] border-[#e1e7e1]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] font-black text-stone-400 w-3">{index + 1}</span>
                              <img src={member.imgUrl} className="w-6 h-6 rounded-full object-cover" alt="" />
                              <span className={`text-[11px] font-bold ${isSelf ? 'text-[#406c58]' : 'text-stone-850'}`}>{member.name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-stone-500 font-mono">{member.monthPoints} pts</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeView === 'training' && (
                  <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                    <div className="flex justify-between items-center border-b border-[#e1e7e1] pb-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#1a2620] font-headline">Recent Actions Log</h4>
                    </div>

                    <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 custom-scrollbar">
                      {activityLog.slice(0, 15).map(log => (
                        <div key={log.id} className="p-3 bg-[#f2f5f2] border border-[#e1e7e1] rounded-xl space-y-1">
                          <p className="text-[9px] text-stone-600 leading-snug">{log.desc}</p>
                          <p className="text-[7px] font-black uppercase text-stone-400">{log.staffName || 'System'} · {log.timestamp.substring(11, 16)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeView === 'rewards' && (
                  <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                    <div className="flex justify-between items-center border-b border-[#e1e7e1] pb-2 shrink-0">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#1a2620] font-headline">Redeem Catalog</h4>
                      <span className="text-[10px] font-bold text-[#406c58] bg-[#406c58]/5 px-2 py-0.5 rounded border border-[#406c58]/15 font-mono">
                        {team.find(t => t.id === authProfile?.id)?.monthPoints || 0} pts
                      </span>
                    </div>

                    <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 custom-scrollbar">
                      {rewards.filter(r => r.is_active).map(reward => {
                        const canAfford = (team.find(t => t.id === authProfile?.id)?.monthPoints || 0) >= reward.point_cost;
                        return (
                          <div key={reward.id} className="p-3 bg-[#f2f5f2] border border-[#e1e7e1] rounded-xl flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <h5 className="text-[11px] font-bold text-stone-850 truncate">{reward.title}</h5>
                              <p className="text-[8px] font-black uppercase text-stone-400 font-mono mt-0.5">{reward.point_cost} pts</p>
                            </div>

                            <button
                              disabled={!canAfford}
                              onClick={() => handleRedeemReward(reward)}
                              className={`py-1 px-3 rounded text-[8px] font-black uppercase tracking-widest transition-colors cursor-pointer shrink-0 ${
                                canAfford ? 'bg-[#406c58] hover:bg-[#335746] text-white' : 'bg-stone-100 text-stone-400 cursor-not-allowed border border-[#e1e7e1]'
                              }`}
                            >
                              Redeem
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeView === 'leaderboard' && (
                  <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                    <div className="flex justify-between items-center border-b border-[#e1e7e1] pb-2 shrink-0">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#1a2620] font-headline">Bounty Board</h4>
                    </div>

                    <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 custom-scrollbar">
                      {bounties.filter(b => b.status === 'open').map(bounty => (
                        <div key={bounty.id} className="p-3 bg-[#f2f5f2] border border-[#e1e7e1] rounded-xl flex flex-col gap-2 relative overflow-hidden">
                          <div className="flex justify-between items-start">
                            <h5 className="text-[11px] font-bold text-stone-850 line-clamp-1">{bounty.title}</h5>
                            <span className="text-[9px] font-bold text-[#406c58] font-mono">+{bounty.point_reward}</span>
                          </div>
                          
                          <p className="text-[8px] text-stone-500 line-clamp-2">{bounty.description}</p>
                          
                          <button
                            onClick={() => handleClaimBounty(bounty)}
                            className="w-full mt-1 py-1.5 bg-[#406c58]/10 hover:bg-[#406c58] hover:text-white border border-[#406c58]/20 text-[#406c58] text-[8px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                          >
                            Claim Bounty
                          </button>
                        </div>
                      ))}
                      {bounties.filter(b => b.status === 'open').length === 0 && (
                        <p className="text-[10px] text-stone-400 italic text-center py-4">No active bounties.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>
      )}

      {macroViewOpen && (
        <MacroViewGraph
          tasks={tasks}
          categories={categories}
          team={team}
          onClose={() => setMacroViewOpen(false)}
          onEditTask={(task) => {
            setMacroViewOpen(false);
            handleOpenEditTask(task);
          }}
        />
      )}

      {/* ──────────────────────────────────────────────────────────────────────────────────────────────────────────
          TASK COMPOSER MODAL (UNIVERSAL STYLE)
      ────────────────────────────────────────────────────────────────────────────────────────────────────────── */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white border border-[#e1e7e1] rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
            style={{ maxHeight: 'calc(100vh - 40px)' }}
          >
            {/* Modal Header */}
            <div className="px-8 pt-8 pb-4 flex justify-between items-start border-b border-[#e1e7e1]">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#406c58] mb-1">Operational Alignment</p>
                <h3 className="text-xl font-black font-headline text-[#1a2620] uppercase tracking-tight">
                  {editingTask ? 'Edit Mission Spec' : 'Decompose New Task'}
                </h3>
              </div>

              <button
                onClick={() => setTaskModalOpen(false)}
                className="p-1.5 rounded-full bg-[#f2f5f2] border border-[#e1e7e1] text-stone-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] block font-bold">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateTask} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-8 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                


                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block mb-2">Mission Title</label>
                    <input
                      required
                      value={taskTitle}
                      onChange={e => setTaskTitle(e.target.value)}
                      className="w-full bg-[#f4f6f4] border border-[#d8e2d8] rounded-xl px-4 py-3 text-xs font-bold text-[#1a2620] outline-none focus:border-[#406c58]/50"
                      placeholder="Enter operational mission scope..."
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block mb-2">Notes / Directives</label>
                    <textarea
                      value={taskNote}
                      onChange={e => setTaskNote(e.target.value)}
                      className="w-full bg-[#f4f6f4] border border-[#d8e2d8] rounded-xl px-4 py-3 text-xs font-medium text-[#1a2620] outline-none focus:border-[#406c58]/50 h-20 resize-none"
                      placeholder="Instructions and metrics..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block mb-2">Business Folder (Where)</label>
                    <select
                      value={taskCategory}
                      onChange={e => setTaskCategory(e.target.value)}
                      className="w-full bg-[#f4f6f4] border border-[#d8e2d8] rounded-xl px-4 py-3 text-xs font-bold text-[#1a2620] outline-none cursor-pointer"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Function Tag is auto-classified from task title — no manual dropdown needed */}
                </div>

                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block mb-2">Invite Members</label>
                  <div className="max-h-24 overflow-y-auto border border-[#d8e2d8] rounded-xl p-2.5 space-y-1 bg-[#f4f6f4] custom-scrollbar">
                    {team.filter(staff => staff.id !== authProfile?.id).map(staff => {
                      const isChecked = selectedCollabs.includes(staff.id);
                      return (
                        <label key={staff.id} className="flex items-center gap-2 text-xs text-[#1a2620] font-semibold cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedCollabs(selectedCollabs.filter(id => id !== staff.id));
                              } else {
                                setSelectedCollabs([...selectedCollabs, staff.id]);
                              }
                            }}
                            className="rounded border-[#d8e2d8] text-[#406c58] focus:ring-[#406c58]/40"
                          />
                          <span>{staff.name}</span>
                        </label>
                      );
                    })}
                    {team.filter(staff => staff.id !== authProfile?.id).length === 0 && (
                      <span className="text-[10px] text-stone-400 italic">No other team members found.</span>
                    )}
                  </div>
                </div>

                {/* Priority Matrix Calibrator */}
                {editingTask && (
                  <div className="bg-[#f8faf8] p-4 rounded-2xl border border-[#e1e7e1] space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-stone-550 font-headline">Strategic Priority Calibrator</span>
                      {aiLoading ? (
                        <span className="text-[9px] font-black text-[#406c58] uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                          Analyzing...
                        </span>
                      ) : (
                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Priority calibration</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-stone-400 block mb-1.5">Impact Level</label>
                        <div className="flex gap-1">
                          {IMPACT_LEVELS.map(lvl => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setTaskImpact(lvl)}
                              className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all cursor-pointer ${
                                taskImpact === lvl 
                                  ? 'bg-[#406c58] text-white border-[#406c58] font-bold shadow-sm' 
                                  : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                              }`}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-stone-400 block mb-1.5">Complexity Level</label>
                        <div className="flex gap-1">
                          {COMPLEXITY_LEVELS.map(lvl => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setTaskComplexity(lvl)}
                              className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all cursor-pointer ${
                                taskComplexity === lvl 
                                  ? 'bg-[#406c58] text-white border-[#406c58] font-bold shadow-sm' 
                                  : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                              }`}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timings */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block mb-2">Estimated duration (mins)</label>
                    <input
                      type="number"
                      value={taskDuration}
                      onChange={e => setTaskDuration(Number(e.target.value))}
                      className="w-full bg-[#f4f6f4] border border-[#d8e2d8] rounded-xl px-4 py-3 text-xs font-bold text-[#1a2620] outline-none focus:border-[#406c58]/50"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block mb-2">Operation Type</label>
                    <div className="flex flex-col gap-2 bg-[#f4f6f4] border border-[#d8e2d8] rounded-xl p-3">
                      <div className="flex gap-2 items-center">
                        <input
                          type="checkbox"
                          checked={isContinuous}
                          onChange={e => {
                            const checked = e.target.checked;
                            setIsContinuous(checked);
                            if (checked) {
                              setFreqType('daily');
                            } else {
                              setFreqType('once');
                            }
                          }}
                          id="continuous-chk"
                          className="rounded border-stone-350 text-[#406c58] bg-white w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="continuous-chk" className="text-xs font-bold text-stone-600 cursor-pointer">Continuous task</label>
                      </div>
                      
                      {isContinuous && (
                        <div className="flex gap-4 pl-6 pt-1 border-t border-stone-200/50 mt-1">
                          {['daily', 'weekly', 'monthly'].map((type) => (
                            <label key={type} className="flex items-center gap-1.5 text-xs text-[#1a2620] font-bold cursor-pointer capitalize">
                              <input
                                type="radio"
                                name="routineType"
                                value={type}
                                checked={freqType === type}
                                onChange={() => setFreqType(type as any)}
                                className="text-[#406c58] focus:ring-[#406c58]/40"
                              />
                              <span>{type}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Checklist Steps */}
                <div className="space-y-3">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-stone-500 block">Workflow Checklist Breakdown</label>
                  <div className="flex gap-2">
                    <input
                      value={newWorkflowStep}
                      onChange={e => setNewWorkflowStep(e.target.value)}
                      placeholder="Add sub-step..."
                      className="flex-1 bg-[#f4f6f4] border border-[#d8e2d8] rounded-xl px-4 py-2.5 text-xs font-bold text-stone-750 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddWorkflowStep}
                      className="px-4 bg-[#406c58] hover:bg-[#335746] text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                    >
                      Add Step
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {workflowSteps.map(step => (
                      <div key={step.id} className="flex items-center justify-between bg-[#f2f5f2] p-2.5 rounded-xl border border-[#e1e7e1]">
                        <span className="text-[10px] font-semibold text-stone-700">{step.name}</span>
                        <button
                          type="button"
                          onClick={() => setWorkflowSteps(prev => prev.filter(w => w.id !== step.id))}
                          className="text-rose-600 hover:text-rose-500 text-[10px] font-black uppercase cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-8 py-5 bg-[#f8faf8] border-t border-[#e1e7e1] flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-5 py-3 rounded-xl border border-[#e1e7e1] text-stone-500 hover:text-stone-800 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-[#406c58] hover:bg-[#335746] text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                >
                  Save Specification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {authProfile && (
        <ProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          profile={{
            ...authProfile,
            imgUrl: authProfile.photoUrl,
            name: authProfile.full_name,
            role: authProfile.designation,
            monthPoints: 0,
            tier: 1,
          }}
          onSave={handleSaveProfile}
          onUploadAvatar={handleUploadAvatar}
          onDeleteAvatar={handleDeleteAvatar}
        />
      )}

    </div>
  );
}
