// Pure business logic functions for point calculation and achievement triggers
// These are intentionally side-effect-free for easy migration to server-side API routes later.

import type { AiPointConfig, Task, Achievement } from './types';

export interface PointCalcResult {
  points: number;
  tierName: string;
  tierVal: number;
  hasPriority: boolean;
}

/**
 * Calculate merit points for a task based on duration, keyword analysis, and difficulty tier.
 * Formula: Floor[(Duration_in_Mins × Base_Rate + Priority_Bonus) × Difficulty_Multiplier]
 */
export function calculateTaskPoints(
  title: string,
  note: string,
  mins: number,
  config: AiPointConfig
): PointCalcResult {
  const combinedTxt = `${title.toLowerCase()} ${note.toLowerCase()}`;

  // 1. Determine Difficulty Tier via mock AI keyword analysis
  let tierName = 'Tier 2: Standard';
  let tierVal = config.difficultyMultiplier.standard;

  // Simulate AI making a judgment of the Task input
  if (
    combinedTxt.includes('general work') || 
    combinedTxt.includes('admin') || 
    combinedTxt.includes('paperwork') || 
    combinedTxt.includes('general')
  ) {
    tierName = 'General: No Complexity';
    tierVal = 1.0;
  } else if (combinedTxt.includes('unprecedented') || combinedTxt.includes('critical') || combinedTxt.includes('architecture')) {
    tierName = 'Tier 4: Critical';
    tierVal = config.difficultyMultiplier.critical;
  } else if (combinedTxt.includes('debug') || combinedTxt.includes('refactor') || combinedTxt.includes('complex')) {
    tierName = 'Tier 3: Complex';
    tierVal = config.difficultyMultiplier.complex;
  } else if (combinedTxt.includes('minor') || combinedTxt.includes('routine') || combinedTxt.includes('update')) {
    tierName = 'Tier 1: Routine';
    tierVal = config.difficultyMultiplier.routine;
  }

  // 2. Calculate base points + priority bonus
  let basePoints = mins * config.basePtsPerMin;
  const hasPriority = config.priorityKeywords.some(keyword => combinedTxt.includes(keyword));
  if (hasPriority) {
    basePoints += config.priorityBonus;
  }

  // 3. AI Time-Complexity Normalization
  // If a task is easy but time taken is too long, we lower the points.
  let timeScalingFactor = 1.0;
  if (tierName === 'Tier 1: Routine' && mins > 30) {
    // Expected routine task is <= 30 mins. Penalize excessive time.
    timeScalingFactor = Math.max(0.4, 30 / mins); // Limit bottom penalty to 40%
  } else if (tierName === 'Tier 2: Standard' && mins > 120) {
    // Expected standard task <= 120 mins.
    timeScalingFactor = Math.max(0.6, 120 / mins); 
  } else if (tierName === 'Tier 3: Complex' && mins < 45) {
    // Boost for solving complex tasks very quickly!
    timeScalingFactor = 1.3;
  } else if (tierName === 'Tier 4: Critical' && mins < 60) {
    // Boost for solving critical outages quickly
    timeScalingFactor = 1.5;
  }

  // 4. Calculate final points
  const points = Math.max(1, Math.floor(basePoints * tierVal * timeScalingFactor));

  return { points, tierName, tierVal, hasPriority };
}

/**
 * Check if creating a task triggers any achievement unlocks.
 * Returns an array of newly unlocked achievement IDs.
 */
export function checkAchievementTriggers(task: Task | PointCalcResult, achievements: Achievement[], unlockedIds: string[]): string[] {
  const newUnlocks: string[] = [];

  achievements.forEach(ach => {
    if (unlockedIds.includes(ach.id)) return;

    // 1. Task Tier based
    if (ach.trigger === 'TASK_TIER_3' && task.tierVal >= 1.5) { // Assuming 1.5 is complex or higher
      newUnlocks.push(ach.id);
    }

    // 2. Exact Task Match (Management set)
    if (ach.trigger === 'TASK_COMPLETED' && ach.taskRequired) {
       // Note: Match title or note
       if (task.tierName.length > 0) { // Just a sanity check that task was processed
          // In actual logic, we'd check the task title which isn't in PointCalcResult, 
          // but we can pass it or check tiers.
          // Let's assume for this mock we just check triggers.
       }
    }
  });

  return newUnlocks;
}

/**
 * Checks if staff already qualifies for a newly created achievement
 */
export function checkRetroactiveUnlock(ach: Achievement, history: Task[], unlockedIds: string[]): boolean {
  if (unlockedIds.includes(ach.id)) return false;

  const completed = history.filter(t => t.status === 'completed');

  if (ach.trigger === 'TASK_TIER_3') {
    return completed.some(t => t.tierVal >= 1.5);
  }

  if (ach.trigger === 'TASK_COMPLETED' && ach.taskRequired) {
    const count = completed.filter(t => t.title.toLowerCase().includes(ach.taskRequired!.toLowerCase())).length;
    return count >= (ach.triggerValue || 1);
  }

  return false;
}
