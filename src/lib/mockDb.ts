// Centralized seed data and configuration for the KPI Merit system.
// This replaces the old mock DB with comprehensive state matching stitch-app.html prototype.

import type { Task, Achievement, StaffProfile, AppealItem, TeamMember, AiPointConfig, SkillModule } from './types';

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
// SEED TASKS
// ═══════════════════════════════════════════
export const SEED_TASKS: Task[] = [
  {
    id: 'mock-1',
    title: 'Data Pipeline Migration',
    note: 'Moving from v1 to v2 endpoints. Critical logic.',
    totalSec: 7200,
    elapsedSec: 6480,
    status: 'running',
    tierName: 'Tier 4: Critical',
    tierVal: 2.0,
    points: Math.floor((120 + 50) * 2.0),
  },
  {
    id: 'mock-2',
    title: 'Quarterly OKR Planning',
    note: 'Drafting Q4 objectives.',
    totalSec: 3600,
    elapsedSec: 0,
    status: 'queued',
    tierName: 'Tier 2: Standard',
    tierVal: 1.2,
    points: Math.floor(60 * 1.2),
  },
  {
    id: 'mock-3',
    title: 'Fix Login UI Glitch',
    note: 'Resolved mobile button state error. Routine update.',
    totalSec: 1800,
    elapsedSec: 1800,
    status: 'completed',
    tierName: 'Tier 1: Routine',
    tierVal: 1.0,
    points: Math.floor(30 * 1.0),
  },
];

// ═══════════════════════════════════════════
// SEED ACHIEVEMENTS
// ═══════════════════════════════════════════
export const SEED_ACHIEVEMENTS: Achievement[] = [
  { id: 'ach-1', icon: 'star', title: '30-Day Streak', desc: 'Reward staff for consistent high-productivity logins sequentially over a 30 day period.', trigger: 'LOGIN_SEQ' },
  { id: 'ach-2', icon: 'local_fire_department', title: 'Top 5% Quarterly', desc: 'Automatic tiering reward for ranking in the top 5% of global lifetime leaderboards at quarter end.', trigger: 'END_Q' },
  { id: 'ach-3', icon: 'done_all', title: 'Module 001 Certified', desc: 'Successful completion and verification of the primary Advanced Architecture skills accelerator.', trigger: 'MODULE_DONE' },
];

export const SEED_UNLOCKED_ACHIEVEMENTS = ['ach-1', 'ach-3'];

// ═══════════════════════════════════════════
// STAFF PROFILE
// ═══════════════════════════════════════════
export const SEED_PROFILE: StaffProfile = {
  name: 'Sarah Jenkins',
  designation: 'Senior Systems Engineer',
  ic: '920101-14-5332',
  photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAQUpm3ZtILq5X-OZvQEQPH_N6Ye5XwrFb_anJy6VbUJBKdB_4K_92qe8OKs__Sa4hAyemtWjl4ZmzN1_wt-OCNzD4_88RvOeb_94GInUVR3ly1CP-y3ZMDPrxquTgFptplOh5FC92FvRlV5HisINvQ3ZHyJJ9TyMQtECn8rEhAVZHcdLJkUe-Tl6X2Q7OE1kdNX2AVDsuz4a3fewRnxYo65NJNPzu8dRf8mJBM8ChfSsYcewmvjdoMRrFmfh3Xv-1J4uBN8JEqE0vz',
};

// ═══════════════════════════════════════════
// TEAM MEMBERS (Manager View)
// ═══════════════════════════════════════════
export const SEED_TEAM: TeamMember[] = [
  {
    id: 'tm-1',
    name: 'Alex Thompson',
    imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCorb4SuWl5rO8ehRLdzAAsiSRQgwlHJ2jwAPArYcBqfd0mWal_uNJwXgoW5S274JDMGc_ilK_fUDc6UM1K0Rcd2ZAOfSF-ZzDRXfjTaATA5trHhpHkUgB7P5KjHrsZSjt_LInqRFpE0KSqf4MAK_We0x1AYHS77xh5YNAKY8fuYW1p6Je7jNgtEFfLhH08y5skbHetu6bIqF1bI94qESQYW5OvgWJrq7M6mLO36ujIfciHhD9ZUso1b7djzQEM2A5DNmX_so0pRSQX',
    status: 'active',
    currentTask: 'API Migration',
    elapsed: '01:45:12',
    monthPoints: 4820,
    rank: 1,
  },
  {
    id: 'tm-2',
    name: 'Sarah Jenkins',
    imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAGg8w7c2klA3xCRerxPKklNYwXQ7yxvVZ1dxt-vj_VuJI7LQPTxzM2Z0sObURpXBLlbz128VLjHGwy1x8nIBQZKr2tuTrQ7BZ9l5Cwn3ObxvjpzAtXE578RC9sPTZxQEGotO3zPsI9ch0LOqvkpCSu0uCA4hBlSBXfhJgQ698T1Mvt0IIy_MtIuVrXyO2Q7iYokJo5Qv0pAbrmf_VtdTay34iQeiDiN1PK5ZQXRm4hGxNhPzFvSdi5E--4w3S23UFKpXoW4_929_9o',
    status: 'idle',
    monthPoints: 4650,
    rank: 2,
  },
  {
    id: 'tm-3',
    name: 'Marcus Chen',
    imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnBO_aOAS4Z1SFAhnr_VZSZ0keOPaFdZekFpG3MqVHs8ceugknOgDHlN_G9gvqnWTR7OpK-4o4pQLzyVRdzEDzYYm-xEXYLvuTowiSKk9HNt2ds76sxjLv-kg4SWFbJKN-JQ88f_OkSeZ3lcVbUdFln7J4s-lMZzA8bRcHVvvlMbFGzAG7-cr9kfc0z6o8imDcFtC3_yvDB3t59REwxfATPz2lxbBU2RNrEXo7EvNl_JjLqsbFFfNZq5DUWce5OcrqnIt7b-2YDV5L',
    status: 'active',
    currentTask: 'Audit Review',
    elapsed: '00:23:40',
    monthPoints: 4210,
    rank: 3,
  },
];

// ═══════════════════════════════════════════
// APPEALS (Triage View)
// ═══════════════════════════════════════════
export const SEED_APPEALS: AppealItem[] = [
  {
    id: 'appeal-1',
    staffName: 'Sarah Jenkins',
    department: 'Engineering',
    taskTitle: 'Deploy v2-beta hotfix to production cluster',
    originalPoints: 85,
    appealComment: 'The AI rated this a standard task, but the hotfix required manual rollback of 3 microservices and live coordination with the SRE team during off-hours. Complexity was significantly higher than a routine deploy.',
    imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAc_-gYB_5fScqOrG2VH5iHI4u3C58lYWiN2VElr0NnLVqoyKQPLhxds7lKlWkmLXHai9tvHkDK26ikOvB3HD44L1KL8rrkaZ8tqyrbLxtuqKA2boMDRC4lkAqPUh33xYkqeK6ej_RFyvltSAX-GLjUnp4kkETn-GHIAs1aiUhue7ArpvNQ_ngtlwvWdNqgnu6vMGPOQG0furMk9H7BGAJss4uRW6YLmQcD2RPB7g3-jQbd7iIwLzzSLSX4XxvGDjujLM2lCu2qE8JB',
    resolved: false,
  },
];

// ═══════════════════════════════════════════
// SKILL MODULES (Learning View)
// ═══════════════════════════════════════════
export const SEED_MODULES: SkillModule[] = [
  {
    id: 'mod-1',
    code: 'Module 001',
    title: 'Advanced Architecture',
    description: 'Master distributed systems, microservices orchestration, and high-availability patterns.',
    meritValue: 1250,
    participants: 12,
  },
  {
    id: 'mod-2',
    code: 'Module 002',
    title: 'Leadership & Empathy',
    description: 'Develop core soft skills required for leading squad scrums and managing cross-departmental expectations.',
    meritValue: 800,
    participants: 0,
  },
];
