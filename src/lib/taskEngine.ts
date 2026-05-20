import type { AiPointConfig, Task, ImpactLevel, ComplexityLevel } from './types';
import { HIGH_IMPACT_KEYWORDS, MED_IMPACT_KEYWORDS, HIGH_CMPLX_KEYWORDS, MED_CMPLX_KEYWORDS, DEFAULT_ASSESSMENT_MATRIX } from './constants/assessmentKeywords';

export interface PointCalcResult {
  points: number;
  tierName: string;
  tierVal: number;
  hasPriority: boolean;
  efficiencyScore: number;
  isFlagged: boolean;
  isInvalid: boolean;
  actualDurationMinutes: number;
  impact?: ImpactLevel;
  complexity?: ComplexityLevel;
}

export function simulateAIAssessment(title: string, note: string): { impact: ImpactLevel, complexity: ComplexityLevel } {
    const combinedTxt = `${title} ${note}`.toLowerCase();
    let impact: ImpactLevel | null = null;
    let complexity: ComplexityLevel | null = null;

    // --- Impact Assessment ---
    if (HIGH_IMPACT_KEYWORDS.some(kw => combinedTxt.includes(kw))) {
      impact = 'High';
    } else if (MED_IMPACT_KEYWORDS.some(kw => combinedTxt.includes(kw))) {
      impact = 'Medium';
    }

    // --- Complexity Assessment ---
    if (HIGH_CMPLX_KEYWORDS.some(kw => combinedTxt.includes(kw))) {
      complexity = 'High';
    } else if (MED_CMPLX_KEYWORDS.some(kw => combinedTxt.includes(kw))) {
      complexity = 'Medium';
    }

    // Deterministic fallback based on title hash (not random, so same title = same result)
    if (!impact || !complexity) {
      let hash = 0;
      for (let i = 0; i < combinedTxt.length; i++) {
        hash = ((hash << 5) - hash) + combinedTxt.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      const levels: ImpactLevel[] = ['Low', 'Medium', 'High'];
      // Weighted: 30% Low, 50% Medium, 20% High
      const weightedPick = (seed: number): ImpactLevel => {
        const v = Math.abs(seed) % 100;
        if (v < 30) return 'Low';
        if (v < 80) return 'Medium';
        return 'High';
      };
      if (!impact) impact = weightedPick(hash);
      if (!complexity) complexity = weightedPick(hash >> 8);
    }

    return { impact, complexity };
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
  ['marketing', 'campaign', 'viral', 'ad', 'tiktok', 'social', 'posting', 'poster', 'graphic'],
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
  definition?: { goldenRule?: number, goldenRuleMinutes?: number, estimatedMins?: number, tierMultiplier?: number, isCalibrated: boolean, impact?: ImpactLevel, complexity?: ComplexityLevel },
  assessedImpact?: ImpactLevel,
  assessedComplexity?: ComplexityLevel
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
        // Still run AI assessment for impact/complexity even with fixed-point keywords
        let kwImpact = assessedImpact;
        let kwComplexity = assessedComplexity;
        if (definition?.impact && definition?.complexity) {
          kwImpact = definition.impact;
          kwComplexity = definition.complexity;
        }
        if (!kwImpact || !kwComplexity) {
          const ai = simulateAIAssessment(title, note);
          if (!kwImpact) kwImpact = ai.impact;
          if (!kwComplexity) kwComplexity = ai.complexity;
        }
        return {
          points: matchedRule.points,
          tierName: tierName,
          tierVal: targetTierVal,
          hasPriority: false,
          efficiencyScore: 1.0,
          isFlagged: false,
          isInvalid: false,
          actualDurationMinutes: actualMins,
          impact: kwImpact,
          complexity: kwComplexity
        };
      }

      keywordTierVal = targetTierVal;
      keywordTierName = tierName;
    }
  }

  // Value + Complexity Matrix logic
  let finalImpact = assessedImpact;
  let finalComplexity = assessedComplexity;

  if (definition?.impact && definition?.complexity) {
    finalImpact = definition.impact;
    finalComplexity = definition.complexity;
  }

  if (!finalImpact || !finalComplexity) {
    const ai = simulateAIAssessment(title, note);
    finalImpact = ai.impact;
    finalComplexity = ai.complexity;
  }

  let points = 10; // default fallback
  if (config.pointMatrix && config.pointMatrix[finalImpact] && config.pointMatrix[finalImpact][finalComplexity]) {
    points = config.pointMatrix[finalImpact][finalComplexity];
  } else {
    // Hardcoded fallback matrix if config missing
    points = DEFAULT_ASSESSMENT_MATRIX[finalImpact][finalComplexity];
  }

  const isFlagged = false;
  const isInvalid = false;
  
  return { 
    points, 
    tierName: `Matrix (${finalImpact} Impact / ${finalComplexity} Cmplx)`, 
    tierVal: keywordTierVal || config.difficultyMultiplier.tier2, 
    hasPriority: false, 
    efficiencyScore: 1.0, 
    isFlagged,
    isInvalid,
    actualDurationMinutes: actualMins,
    impact: finalImpact,
    complexity: finalComplexity
  };
}

