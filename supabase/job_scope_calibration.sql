-- Enhance task_calibration to support role-based job scope analysis
ALTER TABLE public.task_calibration
ADD COLUMN IF NOT EXISTS staff_role TEXT,
ADD COLUMN IF NOT EXISTS department TEXT;

-- Update RLS (already enabled, but let's be sure)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_calibration;
CREATE POLICY "Allow all for authenticated users" ON public.task_calibration FOR ALL USING (true);
