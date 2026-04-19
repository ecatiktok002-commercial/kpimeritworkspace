// TypeScript type definitions for the KPI Merit system

/** Frequency rule for repeating tasks */
export interface TaskFrequency {
  /** 'once' = one-time task | 'daily' = every day | 'weekly' = specific days of the week */
  type: 'once' | 'daily' | 'weekly';
  /** For weekly: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat */
  days?: number[];
}

export interface Task {
  id: string;
  title: string;
  note: string;
  totalSec: number;
  elapsedSec: number;
  status: 'queued' | 'running' | 'completed';
  tierName: string;
  tierVal: number;
  points: number;
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
  workflow?: { id: string; name: string; isCompleted: boolean }[];
}

export interface ActivityLog {
  id: string;
  type: 'achievement' | 'points_earned' | 'system';
  desc: string;
  points?: number;
  timestamp: string;
  staffName?: string;
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  desc: string;
  trigger: string;
  taskRequired?: string;
  triggerValue?: number;
}

export interface StaffProfile {
  name: string;
  designation: string;
  department: string; // Added department
  employmentType: 'Staff' | 'Intern'; // Added employmentType
  ic: string;
  photoUrl: string;
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
  multiplierRoutine: number;
  multiplierStandard: number;
  multiplierComplex: number;
  multiplierCritical: number;
}

export interface AppealItem {
  id: string;
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
  elapsed?: string;
  monthPoints: number;
  rank: number;
  department?: string;
  productivityScore?: number;
  totalAssigned?: number;
}

export interface AiPointConfig {
  basePtsPerMin: number;
  difficultyMultiplier: {
    routine: number;
    standard: number;
    complex: number;
    critical: number;
  };
  priorityKeywords: string[];
  priorityBonus: number;
}

export interface SkillModule {
  id: string;
  code: string;
  title: string;
  description: string;
  meritValue: number;
  participants: number;
}
