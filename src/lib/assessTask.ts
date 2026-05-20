import { supabase } from './supabaseClient';
import type { ImpactLevel, ComplexityLevel } from './types';

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

  const HIGH_IMPACT = ['production', 'crash', 'urgent', 'critical', 'crisis', 'vip', 'client', 'customer', 'revenue', 'escalation', 'audit', 'compliance', 'deadline', 'legal', 'accident', 'breakdown', 'police report', 'stolen', 'insurance', 'claim', 'compound', 'summon', 'damage', 'fleet expansion', 'safety', 'launch', 'live', 'campaign', 'viral', 'pitch', 'ad spend', 'budget'];
  const MED_IMPACT = ['feature', 'design', 'plan', 'report', 'meeting', 'training', 'onboard', 'update', 'upgrade', 'settle', 'finalize', 'complete', 'submit', 'review', 'prepare', 'handover', 'schedule', 'booking', 'reservation', 'rent', 'rental', 'return', 'collect', 'deliver', 'car wash', 'service', 'maintenance', 'oil change', 'tyre', 'battery', 'puspakom', 'inspection', 'e-hailing', 'renewal', 'contract', 'late payment', 'deposit', 'content', 'edit', 'video', 'shoot', 'tiktok', 'social', 'script', 'caption', 'graphic design', 'poster', 'posting'];
  const HIGH_CMPLX = ['architecture', 'refactor', 'complex', 'integration', 'migration', 'system', 'deploy', 'infrastructure', 'strategy', 'analysis', 'research', 'development', 'build', 'restructure', 'overhaul', 'workflow', 'automation', 'cross-functional', 'insurance claim', 'fleet management', 'dispute', 'major repair', 'marketing strategy', 'campaign optimization', 'client onboarding'];
  const MED_CMPLX = ['api', 'database', 'server', 'configure', 'troubleshoot', 'fix', 'debug', 'optimize', 'document', 'process', 'coordinate', 'manage', 'track', 'report', 'audit', 'inspect', 'verify', 'test', 'booking handling', 'routine maintenance', 'service scheduling', 'edit', 'video', 'shoot', 'content', 'design', 'plan', 'review', 'social media', 'tiktok', 'poster', 'caption'];

  let impact: ImpactLevel | null = null;
  let complexity: ComplexityLevel | null = null;

  if (HIGH_IMPACT.some(kw => combinedTxt.includes(kw))) impact = 'High';
  else if (MED_IMPACT.some(kw => combinedTxt.includes(kw))) impact = 'Medium';

  if (HIGH_CMPLX.some(kw => combinedTxt.includes(kw))) complexity = 'High';
  else if (MED_CMPLX.some(kw => combinedTxt.includes(kw))) complexity = 'Medium';

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

  const matrix = {
    Low: { Low: 10, Medium: 20, High: 30 },
    Medium: { Low: 20, Medium: 40, High: 60 },
    High: { Low: 30, Medium: 60, High: 100 },
  };

  return {
    impact,
    complexity,
    points: matrix[impact][complexity],
    reasoning: 'Local fallback (Edge Function unavailable)',
    source: 'hash_fallback',
  };
}
