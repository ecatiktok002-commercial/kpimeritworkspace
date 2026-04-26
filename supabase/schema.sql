-- ═══════════════════════════════════════════
-- KPI MERIT SYSTEM: COMPLETE SUPABASE SCHEMA
-- ═══════════════════════════════════════════

-- 0. TEARDOWN (To allow clean re-runs)
-- ═══════════════════════════════════════════
DROP TABLE IF EXISTS public.system_configs CASCADE;
DROP TABLE IF EXISTS public.appeals CASCADE;
DROP TABLE IF EXISTS public.unlocked_achievements CASCADE;
DROP TABLE IF EXISTS public.achievements CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TYPE IF EXISTS employment_type CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS appeal_status CASCADE;

-- 1. EXTENSIONS & TYPES
-- ═══════════════════════════════════════════
CREATE TYPE employment_type AS ENUM ('Staff', 'Intern');
CREATE TYPE task_status AS ENUM ('queued', 'running', 'completed');
CREATE TYPE appeal_status AS ENUM ('pending', 'resolved', 'rejected');

-- 2. TABLES
-- ═══════════════════════════════════════════

-- Public Profiles (Custom Auth / Management)
CREATE TABLE public.profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    manager_uid UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Link to the manager's Supabase UID
    access_id TEXT UNIQUE,
    passcode TEXT,
    full_name TEXT NOT NULL,
    designation TEXT,
    department TEXT,
    role TEXT DEFAULT 'Staff', -- Configurable pre-defined roles
    employment_type employment_type DEFAULT 'Staff',
    ic_number TEXT,
    photo_url TEXT,
    total_points INTEGER DEFAULT 0,
    is_manager BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks & Point Awards
CREATE TABLE public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id TEXT NOT NULL, -- Changed from staff_id UUID to owner_id TEXT for flexibility
    title TEXT NOT NULL,
    note TEXT,
    total_sec INTEGER NOT NULL,
    elapsed_sec INTEGER DEFAULT 0,
    status task_status DEFAULT 'queued',
    tier_name TEXT,
    tier_val NUMERIC(3,2),
    points INTEGER DEFAULT 0,
    commencement_date TIMESTAMPTZ DEFAULT NOW(),
    collaborator_ids TEXT[], -- Changed to TEXT[]
    collaborators TEXT[],
    frequency JSONB DEFAULT '{"type": "once"}',
    last_completed_date TIMESTAMPTZ,
    is_continuous BOOLEAN DEFAULT FALSE,
    workflow JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Activity Log for Ledger
CREATE TABLE public.activity_log (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- achievement, points_earned, system
    desc TEXT NOT NULL,
    points INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    staff_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Org Config Table
CREATE TABLE public.org_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id TEXT UNIQUE DEFAULT 'default',
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Achievement Mastery List
CREATE TABLE public.achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    icon TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL, -- e.g. 'TASK_COMPLETED'
    task_required TEXT,         -- e.g. 'Daily Content Research'
    trigger_value INTEGER,      -- e.g. 5 (times)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unlocked Achievements (Join Table)
CREATE TABLE public.unlocked_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, achievement_id)
);

-- Appeals & Triage
CREATE TABLE public.appeals (
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

-- System Configuration (Global Ledger & Org Settings)
CREATE TABLE public.system_configs (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlocked_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_config ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES (UPDATED FOR CUSTOM AUTH)
-- ═══════════════════════════════════════════
-- NOTE: Since Staff now use an Access ID lookup rather than Supabase Auth JWTs, 
-- auth.uid() will be null for them. For the MVP, we grant open policies for 
-- Staff-accessible tables and rely on the frontend gateway for isolation.

-- PROFILES
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Anyone can update profiles (managed by Frontend Gateway)." ON public.profiles
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can insert profiles." ON public.profiles
    FOR INSERT WITH CHECK (true);

-- TASKS
CREATE POLICY "Anyone can view tasks." ON public.tasks
    FOR SELECT USING (true);

CREATE POLICY "Anyone can manage tasks." ON public.tasks
    FOR ALL USING (true);

-- ACHIEVEMENTS
CREATE POLICY "Everyone can view achievements." ON public.achievements
    FOR SELECT USING (true);

CREATE POLICY "Anyone can manage achievements." ON public.achievements
    FOR ALL USING (true);

-- SYSTEM CONFIGS
CREATE POLICY "Everyone can view configs." ON public.system_configs
    FOR SELECT USING (true);

CREATE POLICY "Anyone can manage configs." ON public.system_configs
    FOR ALL USING (true);

-- ACTIVITY LOG
CREATE POLICY "Everyone can view activity log." ON public.activity_log
    FOR SELECT USING (true);

CREATE POLICY "Anyone can manage activity log." ON public.activity_log
    FOR ALL USING (true);

-- ORG CONFIG
CREATE POLICY "Everyone can view org config." ON public.org_config
    FOR SELECT USING (true);

CREATE POLICY "Anyone can manage org config." ON public.org_config
    FOR ALL USING (true);

-- 5. FUNCTION & TRIGGER: AUTO-PROFILE ON SIGNUP (REMOVED)
-- ═══════════════════════════════════════════
-- Staff profiles are now created specifically via the Management UI.


-- 6. SEED DATA (Achievements & Config)
-- ═══════════════════════════════════════════

INSERT INTO public.achievements (icon, title, description, trigger_type) VALUES
('star', '30-Day Streak', 'Consistent high-productivity logins sequentially over a 30 day period.', 'LOGIN_SEQ'),
('local_fire_department', 'Top 5% Quarterly', 'Ranking in the top 5% of global lifetime leaderboards at quarter end.', 'END_Q'),
('done_all', 'Module 001 Certified', 'Successful completion and verification of the primary Advanced Architecture skills accelerator.', 'MODULE_DONE');

INSERT INTO public.system_configs (key, value) VALUES
('merit_config', '{
  "basePoints": 10,
  "multiplierRoutine": 1.0,
  "multiplierStandard": 1.2,
  "multiplierComplex": 1.5,
  "multiplierCritical": 2.0
}'),
('org_config', '{
  "workspaceName": "Antigravity Core",
  "defaultDesignation": "Junior Developer",
  "autoAssignments": {
    "Intern-Marketing": {
      "tasks": ["Content Calendar Review", "Social Media Analytics", "Brand Guidelines Sync"]
    },
    "Staff-Engineering": {
      "tasks": ["Code Review", "Daily Scrum", "Infrastructure Check"]
    }
  }
}');
