-- ═══════════════════════════════════════════
-- MATRIX POINTS FEATURE SCHEMA UPDATE
-- ═══════════════════════════════════════════

-- 1. Add columns to task_definitions table
ALTER TABLE public.task_definitions
ADD COLUMN IF NOT EXISTS impact TEXT CHECK (impact IN ('Low', 'Medium', 'High')) DEFAULT 'Low',
ADD COLUMN IF NOT EXISTS complexity TEXT CHECK (complexity IN ('Low', 'Medium', 'High')) DEFAULT 'Low';

-- 2. Add columns to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS impact TEXT CHECK (impact IN ('Low', 'Medium', 'High')),
ADD COLUMN IF NOT EXISTS complexity TEXT CHECK (complexity IN ('Low', 'Medium', 'High'));
