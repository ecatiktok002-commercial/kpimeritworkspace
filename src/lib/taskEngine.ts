import type { AiPointConfig, Task } from './types';

export interface PointCalcResult {
  points: number;
  tierName: string;
  tierVal: number;
  hasPriority: boolean;
  efficiencyScore: number;
  isFlagged: boolean;
  isInvalid: boolean;
  actualDurationMinutes: number;
}

/**
 * Antigravity Logic: Reward efficiency against a standard (Golden Rule).
 * Points = (Golden Rule * Tier Multiplier) * Efficiency Coefficient
 */
export function calculateAntigravityPoints(
  actualMins: number,
  goldenRule: number,
  tierMultiplier: number,
  basePtsPerMin: number = 1
): { points: number; efficiencyScore: number; isFlagged: boolean } {
  // Efficiency Coefficient (EC)
  // If Actual Time <= Golden Rule: EC = 1.0
  // If Actual Time > Golden Rule: EC = Golden Rule / Actual Time
  let efficiencyScore = 1.0;
  if (actualMins > goldenRule && goldenRule > 0) {
    efficiencyScore = goldenRule / actualMins;
  }

  // Calculation: Points = (Golden Rule * Tier Multiplier) * Efficiency Coefficient
  // Note: basePtsPerMin is factored in if we want to scale the organizational economy.
  const rawPoints = (goldenRule * basePtsPerMin * tierMultiplier) * efficiencyScore;
  const points = Math.max(1, Math.floor(rawPoints));
  
  // Red Flag if EC < 0.70
  const isFlagged = efficiencyScore < 0.70;

  return { points, efficiencyScore, isFlagged };
}

/**
 * Simple Stemmer to handle variations like "Edit", "Editing", "Edited"
 */
function getStem(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.length <= 3) return w;
  return w
    .replace(/ing$/, '')
    .replace(/ed$/, '')
    .replace(/s$/, '')
    .replace(/er$/, '');
}

/**
 * Stopwords to ignore in keyword matching to make it more flexible
 */
const STOPWORDS = new Set(['to', 'for', 'the', 'a', 'an', 'and', 'with', 'untuk', 'pada', 'bagi', 'dan', 'dengan']);

/**
 * Semantic Groups for intention-based matching (Multi-language synonyms)
 */
const SEMANTIC_GROUPS = [
  ['wash', 'cuci', 'cleaning', 'clean', 'scrub', 'sanitize', 'mop', 'broom'],
  ['car', 'kereta', 'vehicle', 'automotive', 'auto', 'transport', 'sedan', 'suv', 'mpv', 'van', 'lorry', 'truck', 'fleet'],
  ['refuel', 'petrol', 'gas', 'minyak', 'fuel', 'pump', 'shell', 'petronas', 'caltex', 'petron'],
  ['video', 'edit', 'editing', 'editor', 'shoot', 'shooting', 'recording', 'content', 'social media', 'viral', 'tiktok', 'reels', 'shorts', 'sunting', 'film', 'clip'],
  ['script', 'scripting', 'writing', 'write', 'storyboard', 'draft', 'skrip', 'tulis'],
  ['admin', 'filing', 'paperwork', 'documentation', 'clerical', 'office', 'data', 'entry', 'report', 'archive', 'admin'],
  ['urgent', 'segara', 'pantas', 'priority', 'critical', 'asap', 'emergency', 'immediate', 'kecemasan'],
  ['service', 'servis', 'maintenance', 'repair', 'fix', 'inspection', 'checkup', 'workshop', 'baiki'],
  ['send', 'hantar', 'deliver', 'delivery', 'transport', 'drop', 'pickup', 'pick'],
];

/**
 * Check if a word is a vehicle plate number (e.g., VGD3976, ABC1234)
 */
function isPlateNumber(word: string): boolean {
  return /^[A-Z]{1,3}\d{1,4}$/i.test(word);
}

function checkSemanticMatch(text: string, keyword: string): boolean {
  if (!text || !keyword) return false;
  
  const textLower = text.toLowerCase();
  const keywordLower = keyword.toLowerCase();
  
  // 1. Direct match (Full string)
  if (textLower.includes(keywordLower)) return true;
  
  // 2. Token-based matching with Stemming and Semantic Groups
  const textTokens = textLower.split(/[^a-z0-9]+/).filter(w => w.length > 1);
  const textStems = textTokens.map(getStem);
  
  // Add 'car' intent if a plate number is detected
  if (textTokens.some(isPlateNumber)) {
    textStems.push(getStem('car'));
  }
  
  const keywordTokens = keywordLower.split(/[^a-z0-9]+/).filter(w => w.length > 1);
  // Filter out stopwords from the keyword to make it more flexible (e.g., "Send Car to Service" -> "Send Car Service")
  const keywordStems = keywordTokens
    .filter(t => !STOPWORDS.has(t))
    .map(getStem);

  if (keywordStems.length === 0) return false;

  // For a match, EVERY part of the keyword must be found in the text (either directly or via synonym)
  return keywordStems.every(kStem => {
    // Find the group this keyword stem belongs to
    const group = SEMANTIC_GROUPS.find(g => g.map(getStem).includes(kStem));
    const variations = group ? group.map(getStem) : [kStem];
    
    // Check if any word in the text (stemmed) matches any variation of this keyword part
    return variations.some(v => textStems.includes(v));
  });
}

/**
 * Main point calculation entry point.
 */
export function calculateTaskPoints(
  title: string,
  note: string,
  actualMins: number,
  config: AiPointConfig,
  definition?: { goldenRule?: number, goldenRuleMinutes?: number, estimatedMins?: number, tierMultiplier?: number, isCalibrated: boolean }
): PointCalcResult {
  const combinedTxt = `${title.toLowerCase()} ${note.toLowerCase()}`;
  
  const goldenRule = definition?.goldenRule || definition?.goldenRuleMinutes || 0;

  let keywordTierVal: number | null = null;
  let keywordTierName: string | null = null;

  // 0. Management Keyword Override (Tier/Points Assignment)
  if (config.keywordRules && config.keywordRules.length > 0) {
    const matchedRule = config.keywordRules.find(rule => 
      checkSemanticMatch(combinedTxt, rule.keyword)
    );

    if (matchedRule) {
      const targetTierLevel = matchedRule.tierLevel;
      let targetTierVal = config.difficultyMultiplier.tier1;
      let tierName = `Tier 1: ${config.tierNames.tier1}`;

      if (targetTierLevel === 5) {
        targetTierVal = config.difficultyMultiplier.tier5;
        tierName = `Tier 5: ${config.tierNames.tier5}`;
      } else if (targetTierLevel === 4) {
        targetTierVal = config.difficultyMultiplier.tier4;
        tierName = `Tier 4: ${config.tierNames.tier4}`;
      } else if (targetTierLevel === 3) {
        targetTierVal = config.difficultyMultiplier.tier3;
        tierName = `Tier 3: ${config.tierNames.tier3}`;
      } else if (targetTierLevel === 2) {
        targetTierVal = config.difficultyMultiplier.tier2;
        tierName = `Tier 2: ${config.tierNames.tier2}`;
      }

      // A. If fixed points are defined, use them directly
      if (matchedRule.points !== undefined && matchedRule.points !== null) {
        return {
          points: matchedRule.points,
          tierName: tierName,
          tierVal: targetTierVal,
          hasPriority: false,
          efficiencyScore: 1.0,
          isFlagged: false,
          isInvalid: false,
          actualDurationMinutes: actualMins
        };
      }

      // B. If no fixed points, treat it as a tier assignment and continue to dynamic calc
      // We'll update the tierVal used for the rest of the calculation
      keywordTierVal = targetTierVal;
      keywordTierName = tierName;
    }
  }

  // Default tiering logic
  let tierName = keywordTierName || `Tier 2: ${config.tierNames.tier2}`;
  let tierVal = keywordTierVal || config.difficultyMultiplier.tier2;
  const isCalibrated = definition?.isCalibrated ?? false;

  // 1. Pre-defined Task Match (From Manager calibration)
  if (definition) {
    tierVal = definition.tierMultiplier || config.difficultyMultiplier.tier2;
    // Map multiplier back to tier name for UI consistency
    if (tierVal >= config.difficultyMultiplier.tier5) tierName = `Tier 5: ${config.tierNames.tier5}`;
    else if (tierVal >= config.difficultyMultiplier.tier4) tierName = `Tier 4: ${config.tierNames.tier4}`;
    else if (tierVal >= config.difficultyMultiplier.tier3) tierName = `Tier 3: ${config.tierNames.tier3}`;
    else if (tierVal >= config.difficultyMultiplier.tier2) tierName = `Tier 2: ${config.tierNames.tier2}`;
    else tierName = `Tier 1: ${config.tierNames.tier1}`;
  } 
  // 2. Autonomous Keyword Logic (AI Advisor) - ONLY if no explicit keyword rule matched
  else if (!keywordTierVal) {
    const t5 = (config.aiKeywords?.tier5 && config.aiKeywords.tier5.length > 0) ? config.aiKeywords.tier5 : ['extraordinary', 'breakthrough', 'innovative', 'architect', 'strategic', 'master', 'visionary', 'overhaul', 'spearhead', 'blueprint', 'enterprise', 'viral', 'campaign launch', 'fleet expansion', 'scale', 'franchise'];
    const t4 = (config.aiKeywords?.tier4 && config.aiKeywords.tier4.length > 0) ? config.aiKeywords.tier4 : ['critical', 'advanced', 'urgent', 'priority', 'executive', 'oversight', 'escalation', 'crucial', 'high-impact', 'audit', 'deployment', 'launch', 'management', 'lead', 'directing', 'breakdown', 'accident', 'vip client', 'crisis'];
    const t3 = (config.aiKeywords?.tier3 && config.aiKeywords.tier3.length > 0) ? config.aiKeywords.tier3 : ['complex', 'creative', 'analyze', 'design', 'develop', 'research', 'troubleshoot', 'technical', 'proposal', 'implement', 'review', 'analysis', 'draft', 'plan', 'execution', 'resolve', 'bug', 'fix', 'tiktok video', 'video editing', 'scripting', 'marketing content', 'vehicle maintenance', 'inspection', 'repair', 'shoot', 'edit', 'video storyboard', 'tiktok trend', 'car rental platform'];
    const t1 = (config.aiKeywords?.tier1 && config.aiKeywords.tier1.length > 0) ? config.aiKeywords.tier1 : ['routine', 'admin', 'filing', 'cleanup', 'log', 'entry', 'simple', 'basic', 'manual', 'repetitive', 'housekeeping', 'data entry', 'print', 'email', 'reply', 'sort', 'organize', 'meeting', 'standup', 'sync', 'chat', 'call', 'followup', 'update', 'check', 'car wash', 'refuel', 'customer inquiry', 'booking confirmation', 'handover', 'daily rental check', 'ehailing driver sync', 'vehicle cleanup'];

    if (t5.some(kw => checkSemanticMatch(combinedTxt, kw))) {
      tierName = `Tier 5: ${config.tierNames.tier5}`;
      tierVal = config.difficultyMultiplier.tier5;
    } else if (t4.some(kw => checkSemanticMatch(combinedTxt, kw))) {
      tierName = `Tier 4: ${config.tierNames.tier4}`;
      tierVal = config.difficultyMultiplier.tier4;
    } else if (t3.some(kw => checkSemanticMatch(combinedTxt, kw))) {
      tierName = `Tier 3: ${config.tierNames.tier3}`;
      tierVal = config.difficultyMultiplier.tier3;
    } else if (t1.some(kw => checkSemanticMatch(combinedTxt, kw))) {
      tierName = `Tier 1: ${config.tierNames.tier1}`;
      tierVal = config.difficultyMultiplier.tier1;
    } else {
      tierName = `Tier 2: ${config.tierNames.tier2}`;
      tierVal = config.difficultyMultiplier.tier2;
    }
  }

  const estimatedMins = goldenRule > 0 ? goldenRule : (definition?.estimatedMins || 0);

  // If there's absolutely no estimate, we fall back to a minimal reward or actualMins (should be rare)
  if (estimatedMins === 0) {
    const points = Math.max(1, Math.floor(actualMins * tierVal));
    return { 
      points, 
      tierName: `Unestimated (${tierName})`, 
      tierVal, 
      hasPriority: false, 
      efficiencyScore: 1.0, 
      isFlagged: false,
      isInvalid: false,
      actualDurationMinutes: actualMins
    };
  }

  // ANTIGRAVITY INCENTIVE MODE: 
  // Base Reward is locked to the Estimated Time. 
  // Finishing early yields FULL estimated reward (flipping the incentive to be fast).
  // Exceeding the estimate decays the reward (e.g., losing 1 MP per minute over).
  
  let basePoints = Math.floor(estimatedMins * tierVal);
  let points = basePoints;
  let efficiencyScore = 1.0;
  
  if (actualMins > estimatedMins) {
    const overtimeMins = actualMins - estimatedMins;
    // Penalty: lose 1 MP (scaled by tier, or just 1 absolute MP) for every minute over.
    // We use Math.floor(overtimeMins) to subtract from basePoints
    points = Math.max(1, basePoints - Math.floor(overtimeMins));
    efficiencyScore = points / basePoints; // Reflect the decay in efficiency score
  }

  const isFlagged = efficiencyScore < 0.70; // Flag for manager review if < 70% efficient
  const isInvalid = actualMins > (estimatedMins * 4);
  
  const displayTierName = isCalibrated 
    ? `Calibrated (${tierName})` 
    : `Performance Mode (${tierName})`;

  return { 
    points, 
    tierName: displayTierName, 
    tierVal, 
    hasPriority: false, 
    efficiencyScore, 
    isFlagged,
    isInvalid,
    actualDurationMinutes: actualMins
  };
}

