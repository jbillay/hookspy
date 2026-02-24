-- Create plan_config table
CREATE TABLE public.plan_config (
  plan text PRIMARY KEY,
  max_endpoints integer NOT NULL,
  requests_per_min integer NOT NULL,
  max_body_bytes integer NOT NULL,
  log_retention_hours integer NOT NULL,
  max_timeout_seconds integer NOT NULL,
  can_replay boolean NOT NULL,
  can_search boolean NOT NULL,
  can_inject_headers boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_config ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated users can read plan config
CREATE POLICY plan_config_select_authenticated ON public.plan_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS: Only admins can update plan config
CREATE POLICY plan_config_update_admins ON public.plan_config
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed Free and Pro plan limits
INSERT INTO public.plan_config (plan, max_endpoints, requests_per_min, max_body_bytes, log_retention_hours, max_timeout_seconds, can_replay, can_search, can_inject_headers)
VALUES
  ('free', 3, 30, 262144, 6, 30, false, false, false),
  ('pro', 25, 120, 5242880, 168, 55, true, true, true);
