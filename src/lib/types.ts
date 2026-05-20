// TypeScript type definitions for the KPI Merit system
export interface Achievement { id: string; title: string; description: string; icon: string; trigger_type: string; }

export type ImpactLevel = 'Low' | 'Medium' | 'High';
export type ComplexityLevel = 'Low' | 'Medium' | 'High';


/** Frequency rule for repeating tasks */
export interface TaskFrequency {
  /** 'once' = one-time task | 'daily' = every day | 'weekly' = specific days of the week | 'monthly' = specific date of the month */
  type: 'once' | 'daily' | 'weekly' | 'monthly';
  /** For weekly: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat */
  days?: number[];
  /** For monthly: 1 to 31 */
  triggerDate?: number;
}

export interface Task {
  id: string;
  title: string;
  note: string;
  totalSec: number;
  elapsedSec: number;
  status: 'queued' | 'running' | 'paused' | 'completed';
  tierName: string;
  tierVal: number;
  points: number;
  impact?: ImpactLevel;
  complexity?: ComplexityLevel;
  commencementDate?: string;
  /** ID of the staff member who created the task (data isolation) */
  ownerId?: string;
  /** IDs of collaborators invited to share visibility of this task */
  collaboratorIds?: string[];
  /** Display names of collaborators (for UI rendering) */
  collaborators?: string[];
  /** Recurrence rule — defaults to 'once' if not set */
  frequency?: TaskFrequency;
  /** Date string of last completion (used by recurrence engine) */
  lastCompletedDate?: string;
  isContinuous?: boolean;
  managerViewed?: boolean;
  workflow?: { id: string; name: string; isCompleted: boolean }[];
  actualDurationMinutes?: number;
  efficiencyScore?: number;
  isFlagged?: boolean;
  goldenRuleMinutes?: number;
  isCalibrated?: boolean;
  sentinelReminder?: boolean;
  isAutoCompleted?: boolean;
  completedAt?: string;
}

export interface TaskDefinition {
  id: string;
  title: string;
  goldenRuleMinutes?: number;
  tierMultiplier: number;
  isCalibrated: boolean;
  impact?: ImpactLevel;
  complexity?: ComplexityLevel;
}

export interface TaskCalibration {
  id: string;
  taskTitle: string;
  taskNote?: string;
  actualDurationMinutes: number;
  staffId?: string;
  pointsAwarded?: number;
  tierVal?: number;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  type: 'points_earned' | 'system' | 'task_started' | 'status_change';
  desc: string;
  points?: number;
  tier_val?: number;
  timestamp: string;
  staffName?: string;
  staffId?: string;
  isFlagged?: boolean;
  efficiencyScore?: number;
  managerViewed?: boolean;
}

export interface StaffProfile {
  name: string;
  designation: string;
  department: string;
  employmentType: 'Staff' | 'Intern';
  photoUrl: string;
  photo_url?: string;
}

export interface OrganizationConfig {
  workspaceName: string;
  defaultDesignation: string;
  autoAssignments: {
    [key: string]: { // Key could be "Intern-Marketing"
      tasks: string[];
    }
  };
}

export interface MeritConfig {
  basePoints: number;
  tier1Name: string;
  multiplierTier1: number;
  tier2Name: string;
  multiplierTier2: number;
  tier3Name: string;
  multiplierTier3: number;
  tier4Name: string;
  multiplierTier4: number;
  tier5Name: string;
  multiplierTier5: number;
  pointMatrix?: {
    Low: { Low: number; Medium: number; High: number };
    Medium: { Low: number; Medium: number; High: number };
    High: { Low: number; Medium: number; High: number };
  };
  keywordRules: KeywordRule[];
  aiKeywords?: {
    tier5: string[];
    tier4: string[];
    tier3: string[];
    tier1: string[];
  };
  weeklyThreshold?: number;
}

export interface KeywordRule {
  id: string;
  keyword: string;
  points?: number; // Optional: If provided, overrides dynamic points
  tierLevel: number; // 1, 2, 3, 4, or 5
}

export interface AppealItem {
  id: string;
  staffId?: string;
  staffName: string;
  department: string;
  taskTitle: string;
  originalPoints: number;
  appealComment: string;
  imgUrl: string;
  resolved: boolean;
  resolutionMessage?: string;
  finalPoints?: number;
}

export interface TeamMember {
  id: string;
  name: string;
  imgUrl: string;
  status: 'active' | 'idle' | 'online';
  currentTask?: string;
  isFlagged?: boolean;
  elapsed?: string;
  monthPoints: number;
  rank: number;
  department?: string;
  productivityScore?: number;
  efficiencyScore?: number; // Weekly average
  totalAssigned?: number;
  role?: string;
}

export interface AiPointConfig {
  basePtsPerMin: number;
  tierNames: {
    tier1: string;
    tier2: string;
    tier3: string;
    tier4: string;
    tier5: string;
  };
  difficultyMultiplier: {
    tier1: number;
    tier2: number;
    tier3: number;
    tier4: number;
    tier5: number;
  };
  priorityKeywords: string[];
  priorityBonus: number;
  keywordRules?: KeywordRule[];
  aiKeywords?: {
    tier5: string[];
    tier4: string[];
    tier3: string[];
    tier1: string[];
  };
  pointMatrix?: {
    Low: { Low: number; Medium: number; High: number };
    Medium: { Low: number; Medium: number; High: number };
    High: { Low: number; Medium: number; High: number };
  };
}

export interface SkillModule {
  id: string;
  code: string;
  title: string;
  description: string;
  meritValue: number;
  participants: number;
}

export interface Bounty {
  id: string;
  title: string;
  description: string;
  point_reward: number;
  status: 'open' | 'claimed' | 'completed';
  claimed_by?: string;
  created_at: string;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  point_cost: number;
  icon_type: string;
  is_active: boolean;
  created_at?: string;
}

export interface RewardRedemption {
  id: string;
  user_id: string;
  reward_id: string;
  status: 'pending' | 'fulfilled' | 'rejected';
  created_at: string;
  profiles?: { full_name: string };
  rewards?: { title: string; point_cost: number; icon_type: string };
}

export interface ModuleStep {
  id: string;
  module_id: string;
  step_order: number;
  title: string;
  description: string;
  content_url?: string;
}

export interface ModuleEnrollment {
  id: string;
  module_id: string;
  staff_id: string;
  staffName?: string;
  status: 'joined' | 'in-progress' | 'completed';
  current_step_order: number;
  completed_at?: string;
}

export interface UserAuthProfile extends StaffProfile {
  id: string;
  is_manager: boolean;
  access_id?: string;
  full_name?: string;
  role?: string;
}
