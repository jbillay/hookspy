-- Migration 4: Setup pg_cron for Automatic Log Cleanup
-- Enables the pg_cron extension and schedules an hourly job
-- to delete webhook_logs older than 24 hours.
-- The job runs as superuser, bypassing RLS.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
  'cleanup-old-webhook-logs',
  '0 * * * *',
  $$DELETE FROM public.webhook_logs WHERE received_at < now() - interval '24 hours'$$
);
