-- Create rate_limits table (no RLS - accessed via service role only)
CREATE TABLE public.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL
);

-- pg_cron: clean up stale rate limit entries hourly (older than 5 minutes)
SELECT cron.schedule(
  'cleanup-rate-limits',
  '15 * * * *',
  $$DELETE FROM public.rate_limits WHERE window_start < now() - interval '5 minutes'$$
);
