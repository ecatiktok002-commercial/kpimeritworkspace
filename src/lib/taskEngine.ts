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

  // 1. Determine Difficulty Tier via keyword analysis
  let tierName = 'Tier 2: Standard';
  let tierVal = config.difficultyMultiplier.standard;

  if (combinedTxt.includes('unprecedented') || combinedTxt.includes('critical') || combinedTxt.includes('architecture')) {
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

  // 3. Apply difficulty multiplier
  const points = Math.floor(basePoints * tierVal);

  return { points, tierName, tierVal, hasPriority };
}

/**
 * Check if creating a task triggers any achievement unlocks.
 * Returns an array of newly unlocked achievement IDs.
 */
export function checkAchievementTriggers(
  task: Pick<Task, 'tierName'>,
  achievements: Achievement[],
  currentlyUnlocked: string[]
): string[] {
  const newlyUnlocked: string[] = [];

  // Tier 3: Complex tasks trigger TASK_TIER_3 achievements
  if (task.tierName === 'Tier 3: Complex') {
    const matching = achievements.find(a => a.trigger === 'TASK_TIER_3' && !currentlyUnlocked.includes(a.id));
    if (matching) {
      newlyUnlocked.push(matching.id);
    }
  }

  return newlyUnlocked;
}

/**
 * Check if a newly created achievement should retroactively unlock for a user.
 * Scans existing tasks to see if any already satisfy the trigger condition.
 */
export function checkRetroactiveUnlock(
  achievement: Achievement,
  existingTasks: Task[],
  currentlyUnlocked: string[]
): boolean {
  if (currentlyUnlocked.includes(achievement.id)) return false;

  switch (achievement.trigger) {
    case 'TASK_TIER_3':
      return existingTasks.some(t => t.tierName === 'Tier 3: Complex');
    case 'MODULE_DONE':
      // Will be wired when skill completion is tracked
      return false;
    case 'LOGIN_SEQ':
      // Will be wired when login streaks are tracked
      return false;
    default:
      return false;
  }
}
