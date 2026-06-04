import { MeritConfig, AiPointConfig } from './types';

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
