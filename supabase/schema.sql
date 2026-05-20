-- ════════════════════════════════════════════════════════════════════════════════
-- KPI MERIT SYSTEM: CONSOLIDATED PRODUCTION SCHEMA
-- ════════════════════════════════════════════════════════════════════════════════
-- This schema removes redundant Milestone/Achievement logic and consolidates 
-- the efficiency engine for Car Rental, E-hailing, and TikTok Marketing operations.

-- 1. CLEANUP (DROP NON-RELEVANT TABLES)
-- ════════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS public.unlocked_achievements CASCADE;
DROP TABLE IF EXISTS public.achievements CASCADE;
-- Bounties are kept for the Staff Economy board but can be dropped if unused.
-- We keep training modules as they are still active in the Skill Accelerator.

-- 2. EXTENSIONS & TYPES
-- ════════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_type') THEN
        CREATE TYPE employment_type AS ENUM ('Staff', 'Intern'); 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('queued', 'running', 'paused', 'completed'); 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appeal_status') THEN
        CREATE TYPE appeal_status AS ENUM ('pending', 'resolved', 'rejected'); 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bounty_status') THEN
        CREATE TYPE bounty_status AS ENUM ('open', 'claimed', 'completed'); 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_status') THEN
        CREATE TYPE reward_status AS ENUM ('pending', 'fulfilled', 'rejected'); 
    END IF;
END $$;

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'paused';

-- 3. CORE IDENTITY & CONFIG
-- ════════════════════════════════════════════════════════════════════════════════

-- Public Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    manager_uid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    access_id TEXT UNIQUE,
    passcode TEXT,
    full_name TEXT NOT NULL,
    designation TEXT,
    department TEXT,
    role TEXT DEFAULT 'Staff',
    employment_type employment_type DEFAULT 'Staff',
    ic_number TEXT,
    photo_url TEXT,
    total_points INTEGER DEFAULT 0,
    is_manager BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace Config
CREATE TABLE IF NOT EXISTS public.org_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id TEXT UNIQUE DEFAULT 'default',
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Settings (Merit Engine, Keywords, etc.)
CREATE TABLE IF NOT EXISTS public.system_configs (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCTIVITY ENGINE
-- ════════════════════════════════════════════════════════════════════════════════

-- Task Standards (Golden Rules)
CREATE TABLE IF NOT EXISTS public.task_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL UNIQUE,
    golden_rule_minutes INTEGER,
    tier_multiplier NUMERIC DEFAULT 1.0,
    is_calibrated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active Task Queue
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    note TEXT,
    total_sec INTEGER NOT NULL,
    elapsed_sec INTEGER DEFAULT 0,
    status task_status DEFAULT 'queued',
    tier_name TEXT,
    tier_val NUMERIC,
    points INTEGER DEFAULT 0,
    commencement_date TIMESTAMPTZ,
    actual_duration_minutes INTEGER,
    efficiency_score NUMERIC,
    is_flagged BOOLEAN DEFAULT FALSE,
    manager_viewed BOOLEAN DEFAULT FALSE,
    workflow JSONB DEFAULT '[]'::jsonb,
    frequency JSONB DEFAULT '{"type":"once"}'::jsonb,
    is_continuous BOOLEAN DEFAULT FALSE,
    collaborator_ids UUID[] DEFAULT '{}',
    collaborators TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Calibration Data (Staff Review Pool)
CREATE TABLE IF NOT EXISTS public.task_calibration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_title TEXT NOT NULL,
    task_note TEXT,
    actual_duration_minutes INTEGER NOT NULL,
    staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    staff_role TEXT,
    department TEXT,
    points_awarded INTEGER,
    tier_val NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Log (Ledger Feed)
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- points_earned, task_started, system
    "desc" TEXT NOT NULL,
    points INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    staff_name TEXT,
    staff_id UUID,
    efficiency_score NUMERIC,
    is_flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disputes & Appeals
CREATE TABLE IF NOT EXISTS public.appeals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    appeal_comment TEXT NOT NULL,
    original_points INTEGER NOT NULL,
    final_points INTEGER,
    resolution_message TEXT,
    status appeal_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 5. SKILLS ACCELERATOR (TRAINING)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.skill_modules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    merit_value INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.module_steps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id UUID REFERENCES public.skill_modules(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.module_enrollments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id UUID REFERENCES public.skill_modules(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'joined', -- joined, completed
    current_step_order INTEGER DEFAULT 1,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ECONOMY (OPTIONAL)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bounties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    point_reward INTEGER NOT NULL,
    status bounty_status DEFAULT 'open',
    claimed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    point_cost INTEGER NOT NULL,
    icon_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reward_redemptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    reward_id UUID REFERENCES public.rewards(id) ON DELETE CASCADE NOT NULL,
    status reward_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SECURITY & RLS
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated users (Staff Gateway)
-- In production, restrict based on role/auth
DROP POLICY IF EXISTS "Allow all for profiles" ON public.profiles;
CREATE POLICY "Allow all for profiles" ON public.profiles FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for tasks" ON public.tasks;
CREATE POLICY "Allow all for tasks" ON public.tasks FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for appeals" ON public.appeals;
CREATE POLICY "Allow all for appeals" ON public.appeals FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for system_configs" ON public.system_configs;
CREATE POLICY "Allow all for system_configs" ON public.system_configs FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for activity_log" ON public.activity_log;
CREATE POLICY "Allow all for activity_log" ON public.activity_log FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for org_config" ON public.org_config;
CREATE POLICY "Allow all for org_config" ON public.org_config FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for definitions" ON public.task_definitions;
CREATE POLICY "Allow all for definitions" ON public.task_definitions FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for calibration" ON public.task_calibration;
CREATE POLICY "Allow all for calibration" ON public.task_calibration FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for skill_modules" ON public.skill_modules;
CREATE POLICY "Allow all for skill_modules" ON public.skill_modules FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for module_steps" ON public.module_steps;
CREATE POLICY "Allow all for module_steps" ON public.module_steps FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for module_enrollments" ON public.module_enrollments;
CREATE POLICY "Allow all for module_enrollments" ON public.module_enrollments FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for bounties" ON public.bounties;
CREATE POLICY "Allow all for bounties" ON public.bounties FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for rewards" ON public.rewards;
CREATE POLICY "Allow all for rewards" ON public.rewards FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all for redemptions" ON public.reward_redemptions;
CREATE POLICY "Allow all for redemptions" ON public.reward_redemptions FOR ALL USING (true);

-- 8. SEED DATA & ENGINE CONFIG
-- ════════════════════════════════════════════════════════════════════════════════

-- Primary Merit Configuration
INSERT INTO public.system_configs (key, value) VALUES
('merit_config', '{
  "basePoints": 10,
  "weeklyThreshold": 975,
  "multiplierTier1": 1.1,
  "multiplierTier2": 1.3,
  "multiplierTier3": 1.6,
  "multiplierTier4": 2.0,
  "multiplierTier5": 2.5,
  "tier1Name": "Routine",
  "tier2Name": "Standard",
  "tier3Name": "Advanced",
  "tier4Name": "Expert",
  "tier5Name": "Critical",
  "keywordRules": [
    {"id": "k1", "keyword": "Car Wash", "points": 5, "tierLevel": 1},
    {"id": "k2", "keyword": "Refuel", "points": 5, "tierLevel": 1},
    {"id": "k3", "keyword": "Daily Rental Check", "tierLevel": 1},
    {"id": "k4", "keyword": "Vehicle Handover", "points": 15, "tierLevel": 2},
    {"id": "k5", "keyword": "Customer Support", "tierLevel": 2},
    {"id": "k6", "keyword": "TikTok Shoot", "points": 50, "tierLevel": 3},
    {"id": "k7", "keyword": "Video Editing", "tierLevel": 3},
    {"id": "k8", "keyword": "Vehicle Inspection", "tierLevel": 3},
    {"id": "k9", "keyword": "Crisis Management", "tierLevel": 4},
    {"id": "k10", "keyword": "Fleet Expansion", "tierLevel": 5},
    {"id": "k11", "keyword": "Viral Campaign", "tierLevel": 5}
  ]
}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Workspace Default
INSERT INTO public.org_config (workspace_id, config) VALUES
('default', '{
  "workspaceName": "Antigravity Productivity Hub",
  "defaultDesignation": "Executive Staff",
  "industryDomains": ["Car Rental", "E-hailing", "TikTok Marketing"],
  "autoAssignments": {}
}')
ON CONFLICT (workspace_id) DO UPDATE SET config = EXCLUDED.config;
