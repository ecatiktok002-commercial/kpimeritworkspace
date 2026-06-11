import { MeritConfig, AiPointConfig, Task } from './types';

export const getKLTime = () => {
  const d = new Date();
  const options = { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-US', options as any);
  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}+08:00`;
};

export const fmt = (sec: number) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export function getActivePointConfig(merit: MeritConfig): AiPointConfig {
  const basePoints = Number(merit.basePoints || 10);
  return {
    basePtsPerMin: basePoints / 10,
    tierNames: {
      tier1: merit.tier1Name || 'Routine',
      tier2: merit.tier2Name || 'Standard',
      tier3: merit.tier3Name || 'Complex',
      tier4: merit.tier4Name || 'Critical',
      tier5: merit.tier5Name || 'Extraordinary',
    },
    difficultyMultiplier: {
      tier1: Number(merit.multiplierTier1 || 1.0),
      tier2: Number(merit.multiplierTier2 || 1.3),
      tier3: Number(merit.multiplierTier3 || 1.7),
      tier4: Number(merit.multiplierTier4 || 2.2),
      tier5: Number(merit.multiplierTier5 || 3.0),
    },
    priorityKeywords: ['urgent', 'high priority', 'blocker'],
    priorityBonus: 50,
    keywordRules: merit.keywordRules,
    aiKeywords: merit.aiKeywords
  };
}

export function extractEntityTag(title: string): string | null {
  if (!title) return null;
  const match = title.match(/\b([A-Z]{2,4})\s*(\d{1,4}[A-Z]?)\b/);
  if (match) {
    return `${match[1]}${match[2]}`.replace(/\s+/g, '').toUpperCase();
  }
  const altMatch = title.match(/([A-Z]{2,4})\s*(\d{2,4})/);
  if (altMatch) {
    return `${altMatch[1]}${altMatch[2]}`.replace(/\s+/g, '').toUpperCase();
  }
  return null;
}

export function resolveParentTaskId(title: string, category: string, existingTasks: Task[]) {
  const entityTag = extractEntityTag(title);
  if (!entityTag) {
    return { entityTag: null, parentTaskId: null };
  }

  // Filter tasks in the same category with matching entityTag
  const matchingTasks = existingTasks.filter(t => {
    // Resolve category of the existing task (or check task.category directly if populated)
    const tCat = t.category;
    if (tCat !== category) return false;

    const tTag = t.entityTag || extractEntityTag(t.title);
    return tTag === entityTag;
  });

  if (matchingTasks.length > 0) {
    // Link the oldest task as parent. Sort by commencementDate ascending.
    const sorted = [...matchingTasks].sort((a, b) => {
      const aTime = new Date(a.commencementDate || 0).getTime();
      const bTime = new Date(b.commencementDate || 0).getTime();
      return aTime - bTime;
    });
    return { entityTag, parentTaskId: sorted[0].id };
  }

  return { entityTag, parentTaskId: null };
}
