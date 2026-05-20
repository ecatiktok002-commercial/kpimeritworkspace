import type { ImpactLevel, ComplexityLevel } from '@/lib/types';

export const HIGH_IMPACT_KEYWORDS = [
  'production', 'crash', 'urgent', 'critical', 'crisis', 'vip', 'client',
  'customer', 'revenue', 'escalation', 'audit', 'compliance', 'deadline', 'legal',
  'accident', 'breakdown', 'police report', 'stolen', 'insurance', 'claim',
  'compound', 'summon', 'damage', 'fleet expansion', 'safety', 'launch',
  'live', 'campaign', 'viral', 'pitch', 'ad spend', 'budget'
];

export const MED_IMPACT_KEYWORDS = [
  'feature', 'design', 'plan', 'report', 'meeting', 'training', 'onboard',
  'update', 'upgrade', 'settle', 'finalize', 'complete', 'submit', 'review', 'prepare',
  'handover', 'schedule', 'booking', 'reservation', 'rent', 'rental', 'return',
  'collect', 'deliver', 'car wash', 'service', 'maintenance', 'oil change', 'tyre',
  'battery', 'puspakom', 'inspection', 'e-hailing', 'renewal', 'contract', 'late payment', 'deposit',
  'content', 'edit', 'video', 'shoot', 'tiktok', 'social', 'script', 'caption', 'graphic design', 'poster', 'posting'
];

export const HIGH_CMPLX_KEYWORDS = [
  'architecture', 'refactor', 'complex', 'integration', 'migration', 'system',
  'deploy', 'infrastructure', 'strategy', 'analysis', 'research', 'development',
  'build', 'restructure', 'overhaul', 'workflow', 'automation', 'cross-functional',
  'insurance claim', 'fleet management', 'dispute', 'major repair',
  'marketing strategy', 'campaign optimization', 'client onboarding'
];

export const MED_CMPLX_KEYWORDS = [
  'api', 'database', 'server', 'configure', 'troubleshoot', 'fix', 'debug', 'optimize',
  'document', 'process', 'coordinate', 'manage', 'track', 'report', 'audit', 'inspect', 'verify', 'test',
  'booking handling', 'routine maintenance', 'service scheduling',
  'edit', 'video', 'shoot', 'content', 'design', 'plan', 'review', 'social media', 'tiktok', 'poster', 'caption'
];

export const DEFAULT_ASSESSMENT_MATRIX: Record<ImpactLevel, Record<ComplexityLevel, number>> = {
  Low: { Low: 10, Medium: 20, High: 30 },
  Medium: { Low: 20, Medium: 40, High: 60 },
  High: { Low: 30, Medium: 60, High: 100 },
};
