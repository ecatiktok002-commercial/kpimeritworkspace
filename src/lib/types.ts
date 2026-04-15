// TypeScript type definitions for the KPI Merit system

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
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  desc: string;
  trigger: string;
}

export interface StaffProfile {
  name: string;
  designation: string;
  ic: string;
  photoUrl: string;
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
  status: 'active' | 'idle';
  currentTask?: string;
  elapsed?: string;
  monthPoints: number;
  rank: number;
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
