-- Update log cleanup to be plan-aware
-- Replace flat 24h retention with per-plan retention using plan_config

-- Unschedule the existing flat cleanup job
SELECT cron.unschedule('cleanup-old-webhook-logs');

-- Create plan-aware cleanup job
-- Runs every 15 minutes: deletes webhook_logs older than the owning user's plan retention
SELECT cron.schedule(
  'cleanup-logs-plan-aware',
  '*/15 * * * *',
  $$
  DELETE FROM public.webhook_logs wl
  WHERE wl.id IN (
    SELECT wl2.id
    FROM public.webhook_logs wl2
    JOIN public.endpoints e ON e.id = wl2.endpoint_id
    JOIN public.profiles p ON p.id = e.user_id
    JOIN public.plan_config pc ON pc.plan = p.plan
    WHERE wl2.received_at < now() - (pc.log_retention_hours || ' hours')::interval
  )
  $$
);
