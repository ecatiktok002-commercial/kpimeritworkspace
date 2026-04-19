// Centralized seed data and configuration for the KPI Merit system.
// This replaces the old mock DB with comprehensive state matching stitch-app.html prototype.

import type { Task, Achievement, StaffProfile, AppealItem, TeamMember, AiPointConfig, SkillModule, OrganizationConfig, MeritConfig } from './types';

// ═══════════════════════════════════════════
// AI POINT CONFIGURATION
// ═══════════════════════════════════════════
export const AI_POINT_CONFIG: AiPointConfig = {
  basePtsPerMin: 1,
  difficultyMultiplier: {
    routine: 1.0,
    standard: 1.2,
    complex: 1.5,
    critical: 2.0,
  },
  priorityKeywords: ['urgent', 'high priority', 'blocker'],
  priorityBonus: 50,
};

// ═══════════════════════════════════════════
// MERIT LOGIC CONFIGURATION (Management set)
// ═══════════════════════════════════════════
export const SEED_MERIT_CONFIG: MeritConfig = {
  basePoints: 10,
  multiplierRoutine: 1.0,
  multiplierStandard: 1.2,
  multiplierComplex: 1.5,
  multiplierCritical: 2.0,
};

// ═══════════════════════════════════════════
// ORGANIZATION SETTINGS
// ═══════════════════════════════════════════
export const SEED_ORG_CONFIG: OrganizationConfig = {
  workspaceName: 'Merit Organization',
  defaultDesignation: 'Staff',
  autoAssignments: {}
};

// ═══════════════════════════════════════════
// SEED TASKS
// ═══════════════════════════════════════════
export const SEED_TASKS: Task[] = [];

// ═══════════════════════════════════════════
// SEED ACHIEVEMENTS
// ═══════════════════════════════════════════
export const SEED_ACHIEVEMENTS: Achievement[] = [];

export const SEED_UNLOCKED_ACHIEVEMENTS = [];

// ═══════════════════════════════════════════
// STAFF PROFILE
// ═══════════════════════════════════════════
export const SEED_PROFILE: StaffProfile = {
  name: 'New Staff',
  designation: 'Staff',
  department: 'Operations',
  employmentType: 'Staff',
  ic: '000000-00-0000',
  photoUrl: 'https://i.pravatar.cc/150?u=new_staff',
};

// ═══════════════════════════════════════════
// TEAM MEMBERS (Manager View)
// ═══════════════════════════════════════════
export const SEED_TEAM: TeamMember[] = [];

// ═══════════════════════════════════════════
// APPEALS (Triage View)
// ═══════════════════════════════════════════
export const SEED_APPEALS: AppealItem[] = [];

// ═══════════════════════════════════════════
// SKILL MODULES (Learning View)
// ═══════════════════════════════════════════
export const SEED_MODULES: SkillModule[] = [];
