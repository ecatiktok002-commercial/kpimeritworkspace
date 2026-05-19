-- Add tier_val to activity_log
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS tier_val INTEGER;

-- Create ORG Health View
CREATE OR REPLACE VIEW public.org_daily_health AS
SELECT 
    DATE(completed_at) as log_date,
    AVG(efficiency_score) as avg_efficiency,
    SUM(points) as total_points_earned,
    COUNT(id) as tasks_completed,
    ((AVG(efficiency_score) * 100) * 0.6) + (LEAST(SUM(points) / 500.0, 1.0) * 40.0) as health_score
FROM public.tasks
WHERE status = 'completed'
GROUP BY DATE(completed_at);
