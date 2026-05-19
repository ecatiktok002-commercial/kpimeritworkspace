-- Update task_calibration table to support richer data for manager review
ALTER TABLE public.task_calibration
ADD COLUMN IF NOT EXISTS task_note TEXT,
ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS staff_role TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS points_awarded INTEGER,
ADD COLUMN IF NOT EXISTS tier_val NUMERIC;

-- Ensure RLS policies are up to date
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_calibration;
CREATE POLICY "Allow all for authenticated users" ON public.task_calibration FOR ALL USING (true); -- Allow all for testing, restrict later
