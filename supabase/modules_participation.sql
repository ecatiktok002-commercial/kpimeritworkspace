-- Migration: Skill Module Participation and Coursework
-- This adds steps to modules and tracks staff enrollment/progress.

-- 1. Module Steps (A to Z Coursework)
CREATE TABLE IF NOT EXISTS public.module_steps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id UUID REFERENCES public.skill_modules(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content_url TEXT, -- Link to video, doc, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Module Enrollments (Participation Tracking)
CREATE TABLE IF NOT EXISTS public.module_enrollments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id UUID REFERENCES public.skill_modules(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'joined', -- 'joined', 'in-progress', 'completed'
    current_step_order INTEGER DEFAULT 1,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(module_id, staff_id)
);

-- 3. RLS Policies
ALTER TABLE public.module_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view steps." ON public.module_steps FOR SELECT USING (true);
CREATE POLICY "Anyone can manage steps." ON public.module_steps FOR ALL USING (true);

ALTER TABLE public.module_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view enrollments." ON public.module_enrollments FOR SELECT USING (true);
CREATE POLICY "Anyone can manage enrollments." ON public.module_enrollments FOR ALL USING (true);
