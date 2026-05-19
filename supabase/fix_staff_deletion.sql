-- Fix staff deletion blocking by adding ON DELETE CASCADE to tasks table
ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_staff_id_fkey;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_staff_id_fkey
FOREIGN KEY (staff_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Add DELETE policy for profiles table
DROP POLICY IF EXISTS "Anyone can delete profiles." ON public.profiles;
CREATE POLICY "Anyone can delete profiles." ON public.profiles
    FOR DELETE USING (true);
