// Centralized seed data and configuration for the KPI Merit system.
// This replaces the old mock DB with comprehensive state matching stitch-app.html prototype.

import type { Task, StaffProfile, AppealItem, TeamMember, AiPointConfig, SkillModule, OrganizationConfig, MeritConfig } from './types';

// ═══════════════════════════════════════════
// AI POINT CONFIGURATION
// ═══════════════════════════════════════════
export const AI_POINT_CONFIG: AiPointConfig = {
  basePtsPerMin: 1,
  tierNames: {
    tier1: 'Routine',
    tier2: 'Standard',
    tier3: 'Complex',
    tier4: 'Critical',
    tier5: 'Extraordinary',
  },
  difficultyMultiplier: {
    tier1: 1.0,
    tier2: 1.3,
    tier3: 1.7,
    tier4: 2.2,
    tier5: 3.0,
  },
  priorityKeywords: ['urgent', 'high priority', 'blocker'],
  priorityBonus: 50,
  aiKeywords: {
    tier5: ['extraordinary', 'breakthrough', 'innovative', 'architect', 'strategic', 'master', 'visionary', 'overhaul', 'spearhead', 'blueprint', 'enterprise', 'viral', 'campaign launch', 'fleet expansion', 'scale', 'franchise'],
    tier4: ['critical', 'advanced', 'urgent', 'priority', 'executive', 'oversight', 'escalation', 'crucial', 'high-impact', 'audit', 'deployment', 'lead', 'directing', 'breakdown', 'accident', 'vip client', 'crisis'],
    tier3: ['complex', 'creative', 'analyze', 'design', 'develop', 'research', 'troubleshoot', 'technical', 'proposal', 'implement', 'review', 'analysis', 'draft', 'plan', 'execution', 'resolve', 'bug', 'fix', 'tiktok video', 'video editing', 'scripting', 'marketing content', 'vehicle maintenance', 'inspection', 'repair', 'shoot', 'edit', 'video storyboard', 'tiktok trend', 'car rental platform'],
    tier1: ['routine', 'admin', 'filing', 'cleanup', 'log', 'entry', 'simple', 'basic', 'manual', 'repetitive', 'housekeeping', 'data entry', 'print', 'email', 'reply', 'sort', 'organize', 'meeting', 'standup', 'sync', 'chat', 'call', 'followup', 'update', 'check', 'car wash', 'refuel', 'customer inquiry', 'booking confirmation', 'handover', 'daily rental check', 'ehailing driver sync', 'vehicle cleanup']
  },
};

// ═══════════════════════════════════════════
// MERIT LOGIC CONFIGURATION (Management set)
// ═══════════════════════════════════════════
export const SEED_MERIT_CONFIG: MeritConfig = {
  basePoints: 0.5,
  tier1Name: 'Routine',
  multiplierTier1: 1.0,
  tier2Name: 'Standard',
  multiplierTier2: 1.2,
  tier3Name: 'Complex',
  multiplierTier3: 1.5,
  tier4Name: 'Critical',
  multiplierTier4: 2.0,
  tier5Name: 'Extraordinary',
  multiplierTier5: 3.0,
  weeklyThreshold: 975,
  aiKeywords: {
    tier5: ['extraordinary', 'breakthrough', 'innovative', 'architect', 'strategic', 'master', 'visionary', 'overhaul', 'spearhead', 'blueprint', 'enterprise', 'viral', 'campaign launch', 'fleet expansion', 'scale', 'franchise'],
    tier4: ['critical', 'advanced', 'urgent', 'priority', 'executive', 'oversight', 'escalation', 'crucial', 'high-impact', 'audit', 'deployment', 'lead', 'directing', 'breakdown', 'accident', 'vip client', 'crisis'],
    tier3: ['complex', 'creative', 'analyze', 'design', 'develop', 'research', 'troubleshoot', 'technical', 'proposal', 'implement', 'review', 'analysis', 'draft', 'plan', 'execution', 'resolve', 'bug', 'fix', 'tiktok video', 'video editing', 'scripting', 'marketing content', 'vehicle maintenance', 'inspection', 'repair', 'shoot', 'edit', 'video storyboard', 'tiktok trend', 'car rental platform'],
    tier1: ['routine', 'admin', 'filing', 'cleanup', 'log', 'entry', 'simple', 'basic', 'manual', 'repetitive', 'housekeeping', 'data entry', 'print', 'email', 'reply', 'sort', 'organize', 'meeting', 'standup', 'sync', 'chat', 'call', 'followup', 'update', 'check', 'car wash', 'refuel', 'customer inquiry', 'booking confirmation', 'handover', 'daily rental check', 'ehailing driver sync', 'vehicle cleanup']
  },
  keywordRules: [
    // Tier 1: Routine
    { id: 'kr1', keyword: 'Car Wash', points: 5, tierLevel: 1 },
    { id: 'kr2', keyword: 'Refuel', points: 5, tierLevel: 1 },
    { id: 'kr7', keyword: 'Daily Rental Check', tierLevel: 1 },
    { id: 'kr5', keyword: 'E-hailing Inquiry', points: 10, tierLevel: 1 },
    
    // Tier 2: Standard
    { id: 'kr4', keyword: 'Vehicle Handover', points: 15, tierLevel: 2 },
    { id: 'kr11', keyword: 'Customer Support', tierLevel: 2 },
    { id: 'kr12', keyword: 'Booking Confirmation', tierLevel: 2 },
    
    // Tier 3: Complex
    { id: 'kr3', keyword: 'TikTok Shoot', points: 50, tierLevel: 3 },
    { id: 'kr6', keyword: 'Video Editing', tierLevel: 3 },
    { id: 'kr10', keyword: 'Scripting', tierLevel: 3 },
    { id: 'kr13', keyword: 'Vehicle Inspection', tierLevel: 3 },
    
    // Tier 4: Critical
    { id: 'kr14', keyword: 'Crisis Management', tierLevel: 4 },
    { id: 'kr15', keyword: 'Strategic Planning', tierLevel: 4 },
    { id: 'kr16', keyword: 'Marketing Audit', tierLevel: 4 },
    
    // Tier 5: Extraordinary
    { id: 'kr8', keyword: 'Fleet Expansion', tierLevel: 5 },
    { id: 'kr9', keyword: 'Viral Campaign', tierLevel: 5 },
    { id: 'kr17', keyword: 'Market Launch', tierLevel: 5 }
  ]
};

// ═══════════════════════════════════════════
// ORGANIZATION SETTINGS
// ═══════════════════════════════════════════
export const SEED_ORG_CONFIG: OrganizationConfig = {
  workspaceName: 'Merit Organization',
  defaultDesignation: 'Staff',
  autoAssignments: {},
  departments: {
    'Operations': {
      jobScope: '1. Perform daily car rental fleet checklist (refueling, cleaning, inspection).\n2. Coordinate client vehicle handovers.\n3. Log and report vehicle maintenance issues.'
    },
    'Marketing': {
      jobScope: '1. Create and schedule daily short-form TikTok promotion scripts and videos.\n2. Review and optimize consultancy ad campaigns.\n3. Track customer conversion and referral metrics.'
    },
    'Software': {
      jobScope: '1. Monitor production server alerts and error logs.\n2. Execute routine database checks.\n3. Implement features according to active project blueprints.'
    },
    'Finance': {
      jobScope: '1. Reconcile daily rental transactions.\n2. Process incoming contractor invoices.\n3. Prepare weekly profit & loss division reports.'
    },
    'Strategic': {
      jobScope: '1. Align with business unit leaders on quarterly objectives.\n2. Review holding company cash flow allocations.'
    }
  }
};

// ═══════════════════════════════════════════
// SEED TASKS
// ═══════════════════════════════════════════
export const SEED_TASKS: Task[] = [];


// ═══════════════════════════════════════════
// STAFF PROFILE
// ═══════════════════════════════════════════
export const SEED_PROFILE: StaffProfile = {
  name: 'New Staff',
  designation: 'Staff',
  department: 'Operations',
  employmentType: 'Staff',
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
