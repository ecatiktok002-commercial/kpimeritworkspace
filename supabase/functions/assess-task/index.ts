// ═══════════════════════════════════════════════════════════════════════
// ASSESS-TASK: AI-Powered Task Impact & Complexity Assessment
// ═══════════════════════════════════════════════════════════════════════
// Server-side Edge Function that evaluates tasks using:
// 1. Admin overrides from task_definitions (highest priority)
// 2. Historical calibration data learning
// 3. Keyword-based heuristic assessment
// 4. Deterministic hash fallback (never random)

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// ─── Types ───────────────────────────────────────────────────────────
type ImpactLevel = 'Low' | 'Medium' | 'High';
type ComplexityLevel = 'Low' | 'Medium' | 'High';

interface AssessmentResult {
  impact: ImpactLevel;
  complexity: ComplexityLevel;
  points: number;
  reasoning: string;
  source: 'admin_override' | 'historical_learning' | 'keyword_heuristic' | 'hash_fallback';
}

// ─── Default Point Matrix ────────────────────────────────────────────
const DEFAULT_MATRIX: Record<ImpactLevel, Record<ComplexityLevel, number>> = {
  Low:    { Low: 10, Medium: 20, High: 30 },
  Medium: { Low: 20, Medium: 40, High: 60 },
  High:   { Low: 30, Medium: 60, High: 100 },
};

// ─── Keyword Dictionaries ────────────────────────────────────────────
const HIGH_IMPACT_KEYWORDS = [
  // General & Tech
  'production', 'crash', 'urgent', 'critical', 'crisis', 'vip', 'client',
  'customer', 'revenue', 'escalation', 'audit', 'compliance', 'deadline', 'legal',
  // Car Rental Specific
  'accident', 'breakdown', 'police report', 'stolen', 'insurance', 'claim',
  'compound', 'summon', 'damage', 'fleet expansion', 'safety',
  // Marketing Specific
  'launch', 'live', 'campaign', 'viral', 'pitch', 'ad spend', 'budget'
];

const MED_IMPACT_KEYWORDS = [
  // General & Tech
  'feature', 'design', 'plan', 'report', 'meeting', 'training', 'onboard',
  'update', 'upgrade', 'settle', 'finalize', 'complete', 'submit', 'review', 'prepare',
  // Car Rental Specific
  'handover', 'schedule', 'booking', 'reservation', 'rent', 'rental', 'return',
  'collect', 'deliver', 'car wash', 'service', 'maintenance', 'oil change', 'tyre',
  'battery', 'puspakom', 'inspection', 'e-hailing', 'renewal', 'contract', 'late payment', 'deposit',
  // Marketing Specific
  'content', 'edit', 'video', 'shoot', 'tiktok', 'social', 'script', 'caption', 'graphic design', 'poster', 'posting'
];

const LOW_IMPACT_KEYWORDS = [
  'internal', 'housekeeping', 'organize', 'sort', 'file', 'print', 'copy', 'scan', 'data entry',
  'clean', 'tidy', 'refuel', 'petrol', 'top up', 'routine', 'basic'
];

const HIGH_COMPLEXITY_KEYWORDS = [
  // General & Tech
  'architecture', 'refactor', 'complex', 'integration', 'migration', 'system',
  'deploy', 'infrastructure', 'strategy', 'analysis', 'research', 'development',
  'build', 'restructure', 'overhaul', 'workflow', 'automation', 'cross-functional',
  // Car Rental Specific
  'insurance claim', 'fleet management', 'dispute', 'major repair',
  // Marketing Specific
  'marketing strategy', 'campaign optimization', 'client onboarding'
];

const MED_COMPLEXITY_KEYWORDS = [
  // General & Tech
  'api', 'database', 'server', 'configure', 'troubleshoot', 'fix', 'debug', 'optimize',
  'document', 'process', 'coordinate', 'manage', 'track', 'report', 'audit', 'inspect', 'verify', 'test',
  // Car Rental Specific
  'booking handling', 'routine maintenance', 'service scheduling',
  // Marketing Specific
  'edit', 'video', 'shoot', 'content', 'design', 'plan', 'review', 'social media', 'tiktok', 'poster', 'caption'
];

const LOW_COMPLEXITY_KEYWORDS = [
  'car wash', 'wash', 'clean', 'tidy', 'refuel', 'petrol', 'top up', 'print', 'copy', 'scan', 'file',
  'data entry', 'reply', 'whatsapp', 'email', 'message', 'comment', 'handover', 'return', 'collect', 'deliver', 'dispatch',
  'send', 'basic', 'simple'
];

// ─── Deterministic Hash ──────────────────────────────────────────────
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function weightedPick(seed: number): ImpactLevel {
  const v = Math.abs(seed) % 100;
  if (v < 30) return 'Low';
  if (v < 80) return 'Medium';
  return 'High';
}

// ─── Keyword Assessment ──────────────────────────────────────────────
function keywordAssess(text: string): { impact: ImpactLevel | null; complexity: ComplexityLevel | null } {
  const lower = text.toLowerCase();
  let impact: ImpactLevel | null = null;
  let complexity: ComplexityLevel | null = null;

  if (HIGH_IMPACT_KEYWORDS.some(kw => lower.includes(kw))) {
    impact = 'High';
  } else if (MED_IMPACT_KEYWORDS.some(kw => lower.includes(kw))) {
    impact = 'Medium';
  } else if (LOW_IMPACT_KEYWORDS.some(kw => lower.includes(kw))) {
    impact = 'Low';
  }

  if (HIGH_COMPLEXITY_KEYWORDS.some(kw => lower.includes(kw))) {
    complexity = 'High';
  } else if (MED_COMPLEXITY_KEYWORDS.some(kw => lower.includes(kw))) {
    complexity = 'Medium';
  } else if (LOW_COMPLEXITY_KEYWORDS.some(kw => lower.includes(kw))) {
    complexity = 'Low';
  }

  return { impact, complexity };
}

// ─── Main Handler ────────────────────────────────────────────────────
export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    try {
      const { title, note = '' } = await req.json();

      if (!title || typeof title !== 'string') {
        return Response.json({ error: 'title is required' }, { status: 400 });
      }

      const supabase = ctx.supabaseAdmin; // Use admin client to bypass RLS
      const combinedTxt = `${title || ''} ${note || ''}`.toLowerCase();
      const reasons: string[] = [];

      // ──────────────────────────────────────────────────────────────
      // LAYER 1: Check admin-defined overrides in task_definitions
      // ──────────────────────────────────────────────────────────────
      const { data: definitions } = await supabase
        .from('task_definitions')
        .select('impact, complexity')
        .ilike('title', title)
        .limit(1);

      if (definitions && definitions.length > 0 && definitions[0].impact && definitions[0].complexity) {
        const def = definitions[0];
        const matrix = DEFAULT_MATRIX;
        const points = matrix[def.impact as ImpactLevel]?.[def.complexity as ComplexityLevel] ?? 10;
        
        return Response.json({
          impact: def.impact,
          complexity: def.complexity,
          points,
          reasoning: `Admin-defined override from Task Definitions: Impact=${def.impact}, Complexity=${def.complexity}`,
          source: 'admin_override',
        } as AssessmentResult, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      // ──────────────────────────────────────────────────────────────
      // LAYER 2: Learn from historical calibration data
      // ──────────────────────────────────────────────────────────────
      // Look for similar past tasks by fuzzy title match
      const { data: calibrationData } = await supabase
        .from('task_calibration')
        .select('task_title, actual_duration_minutes, points_awarded, tier_val')
        .order('created_at', { ascending: false })
        .limit(100);

      let historicalImpact: ImpactLevel | null = null;
      let historicalComplexity: ComplexityLevel | null = null;

      if (calibrationData && calibrationData.length > 0) {
        // Find similar tasks (title words overlap)
        const titleWords = (title || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const similar = calibrationData.filter((cal: any) => {
          const calWords = (cal.task_title || '').toLowerCase().split(/\s+/);
          const overlap = titleWords.filter((w: string) => calWords.some((cw: string) => cw.includes(w) || w.includes(cw)));
          return overlap.length >= Math.max(1, Math.floor(titleWords.length * 0.5));
        });

        if (similar.length > 0) {
          // Derive impact from average points awarded
          const avgPoints = similar.reduce((sum: number, s: any) => sum + (s.points_awarded || 0), 0) / similar.length;
          const avgDuration = similar.reduce((sum: number, s: any) => sum + (s.actual_duration_minutes || 0), 0) / similar.length;

          // Points-based impact inference
          if (avgPoints >= 80) historicalImpact = 'High';
          else if (avgPoints >= 30) historicalImpact = 'Medium';
          else historicalImpact = 'Low';

          // Duration-based complexity inference
          if (avgDuration >= 120) historicalComplexity = 'High';
          else if (avgDuration >= 30) historicalComplexity = 'Medium';
          else historicalComplexity = 'Low';

          reasons.push(`Learned from ${similar.length} similar past task(s): avg ${Math.round(avgPoints)} pts, avg ${Math.round(avgDuration)} mins`);
        }
      }

      if (historicalImpact && historicalComplexity) {
        const points = DEFAULT_MATRIX[historicalImpact][historicalComplexity];
        return Response.json({
          impact: historicalImpact,
          complexity: historicalComplexity,
          points,
          reasoning: reasons.join('. '),
          source: 'historical_learning',
        } as AssessmentResult, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      // ──────────────────────────────────────────────────────────────
      // LAYER 3: Keyword-based heuristic assessment
      // ──────────────────────────────────────────────────────────────
      const kw = keywordAssess(combinedText);

      if (kw.impact && kw.complexity) {
        const points = DEFAULT_MATRIX[kw.impact][kw.complexity];
        const matchedImpactKw = [...HIGH_IMPACT_KEYWORDS, ...MED_IMPACT_KEYWORDS].find(k => combinedText.includes(k));
        const matchedCmplxKw = [...HIGH_COMPLEXITY_KEYWORDS, ...MED_COMPLEXITY_KEYWORDS].find(k => combinedText.includes(k));
        return Response.json({
          impact: kw.impact,
          complexity: kw.complexity,
          points,
          reasoning: `Keyword match: "${matchedImpactKw}" → ${kw.impact} Impact, "${matchedCmplxKw}" → ${kw.complexity} Complexity`,
          source: 'keyword_heuristic',
        } as AssessmentResult, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      // ──────────────────────────────────────────────────────────────
      // LAYER 4: Deterministic hash fallback + partial keyword
      // ──────────────────────────────────────────────────────────────
      const hash = hashString(combinedText);
      const finalImpact = kw.impact || (historicalImpact as ImpactLevel) || weightedPick(hash);
      const finalComplexity = kw.complexity || (historicalComplexity as ComplexityLevel) || weightedPick(hash >> 8);
      const points = DEFAULT_MATRIX[finalImpact][finalComplexity];

      const partialReasons: string[] = [];
      if (kw.impact) partialReasons.push(`Impact from keyword`);
      if (kw.complexity) partialReasons.push(`Complexity from keyword`);
      if (historicalImpact) partialReasons.push(`Impact from history`);
      if (historicalComplexity) partialReasons.push(`Complexity from history`);
      if (partialReasons.length === 0) partialReasons.push('No keyword or history match — used deterministic hash');

      return Response.json({
        impact: finalImpact,
        complexity: finalComplexity,
        points,
        reasoning: partialReasons.join(', '),
        source: 'hash_fallback',
      } as AssessmentResult, {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });

    } catch (err) {
      console.error('assess-task error:', err);
      return Response.json({ error: 'Internal server error' }, {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }
  }),
};
