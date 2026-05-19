-- ═══════════════════════════════════════════
-- DATA PERSISTENCE & MISSING COLUMNS PATCH
-- ═══════════════════════════════════════════

-- 1. Add missing columns to tasks table for full persistence
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS workflow JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS frequency JSONB DEFAULT '{"type":"once"}'::jsonb,
ADD COLUMN IF NOT EXISTS is_continuous BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS collaborator_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS collaborators TEXT[] DEFAULT '{}';

-- 2. Add missing columns to profiles table for specific tracking if needed
-- (Currently profiles seem fine, but ensuring photo_url is there)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 3. Update tasks RLS (Ensuring anyone can manage for simplicity in MVP)
DROP POLICY IF EXISTS "Anyone can manage tasks." ON public.tasks;
CREATE POLICY "Anyone can manage tasks." ON public.tasks FOR ALL USING (true);
