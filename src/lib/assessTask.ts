import { supabase } from './supabaseClient';
import type { ImpactLevel, ComplexityLevel } from './types';
import { HIGH_IMPACT_KEYWORDS, MED_IMPACT_KEYWORDS, HIGH_CMPLX_KEYWORDS, MED_CMPLX_KEYWORDS, DEFAULT_ASSESSMENT_MATRIX } from './constants/assessmentKeywords';

export interface EdgeAssessmentResult {
  impact: ImpactLevel;
  complexity: ComplexityLevel;
  points: number;
  reasoning: string;
  source: 'admin_override' | 'historical_learning' | 'keyword_heuristic' | 'hash_fallback';
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Calls the assess-task Edge Function for server-side AI assessment.
 * Falls back to a local heuristic if the Edge Function is unavailable.
 */
export async function assessTaskViaEdge(title: string, note: string): Promise<EdgeAssessmentResult> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/assess-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ title, note }),
    });

    if (!response.ok) {
      throw new Error(`Edge Function returned ${response.status}`);
    }

    const data = await response.json();
    return data as EdgeAssessmentResult;
  } catch (err) {
    console.warn('Edge Function assess-task unavailable, using local fallback:', err);
    // Local fallback (same deterministic hash logic)
    return localFallbackAssessment(title, note);
  }
}

/** Local fallback when Edge Function is unreachable */
function localFallbackAssessment(title: string, note: string): EdgeAssessmentResult {
  const combinedTxt = `${title} ${note}`.toLowerCase();

  let impact: ImpactLevel | null = null;
  let complexity: ComplexityLevel | null = null;

  if (HIGH_IMPACT_KEYWORDS.some(kw => combinedTxt.includes(kw))) impact = 'High';
  else if (MED_IMPACT_KEYWORDS.some(kw => combinedTxt.includes(kw))) impact = 'Medium';

  if (HIGH_CMPLX_KEYWORDS.some(kw => combinedTxt.includes(kw))) complexity = 'High';
  else if (MED_CMPLX_KEYWORDS.some(kw => combinedTxt.includes(kw))) complexity = 'Medium';

  if (!impact || !complexity) {
    let hash = 0;
    for (let i = 0; i < combinedTxt.length; i++) {
      hash = ((hash << 5) - hash) + combinedTxt.charCodeAt(i);
      hash |= 0;
    }
    const pick = (seed: number): ImpactLevel => {
      const v = Math.abs(seed) % 100;
      if (v < 30) return 'Low';
      if (v < 80) return 'Medium';
      return 'High';
    };
    if (!impact) impact = pick(hash);
    if (!complexity) complexity = pick(hash >> 8);
  }

  return {
    impact,
    complexity,
    points: DEFAULT_ASSESSMENT_MATRIX[impact][complexity],
    reasoning: 'Local fallback (Edge Function unavailable)',
    source: 'hash_fallback',
  };
}
