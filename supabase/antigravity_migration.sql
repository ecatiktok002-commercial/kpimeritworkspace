-- ═══════════════════════════════════════════
-- ANTIGRAVITY FEATURE: SCHEMA UPDATE
-- ═══════════════════════════════════════════

-- 1. Update task_definitions table
-- Adds standard time and calibration status
ALTER TABLE public.task_definitions
ADD COLUMN IF NOT EXISTS golden_rule_minutes INTEGER,
ADD COLUMN IF NOT EXISTS is_calibrated BOOLEAN DEFAULT FALSE;

-- 2. Update tasks table (entries)
-- Adds actual performance tracking and efficiency metrics
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS efficiency_score NUMERIC,
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS manager_viewed BOOLEAN DEFAULT FALSE;

-- 2.5 Update activity_log table
ALTER TABLE public.activity_log
ADD COLUMN IF NOT EXISTS efficiency_score NUMERIC,
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS manager_viewed BOOLEAN DEFAULT FALSE;

-- 3. Update task_definitions constraint (optional but helpful)
-- Ensure title is unique for lookups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'task_definitions_title_key'
    ) THEN
        ALTER TABLE public.task_definitions ADD CONSTRAINT task_definitions_title_key UNIQUE (title);
    END IF;
END $$;
-- 4. Create task_calibration table (for Learning Mode)
-- Used to log actual durations to help managers set Golden Rules
CREATE TABLE IF NOT EXISTS public.task_calibration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_title TEXT NOT NULL,
    actual_duration_minutes INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for all tables (optional but recommended)
ALTER TABLE public.task_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_calibration ENABLE ROW LEVEL SECURITY;

-- Simple permissive policies for now (adjust as needed for production)
CREATE POLICY "Allow all for authenticated users" ON public.tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.task_definitions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.task_calibration FOR ALL USING (auth.role() = 'authenticated');
