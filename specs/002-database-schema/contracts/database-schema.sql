-- ============================================================================
-- Database Schema Contract: 002-database-schema
--
-- This file documents the expected SQL contracts for the migration files.
-- It is NOT a migration file itself — see supabase/migrations/ for actual SQL.
-- ============================================================================

-- ==========================================================================
-- Migration 1: Create Tables, Indexes, Trigger
-- File: supabase/migrations/20260209000001_create_tables.sql
-- ==========================================================================

-- Trigger function (reusable)
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- endpoints table
CREATE TABLE public.endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text,
  slug text UNIQUE NOT NULL,
  target_url text DEFAULT 'http://localhost',
  target_port integer DEFAULT 3000,
  target_path text DEFAULT '/',
  timeout_seconds integer DEFAULT 30 CHECK (timeout_seconds BETWEEN 1 AND 55),
  custom_headers jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- webhook_logs table
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid REFERENCES public.endpoints(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'forwarding', 'responded', 'timeout', 'error')),
  request_method text NOT NULL,
  request_url text,
  request_headers jsonb,
  request_body text,
  response_status integer,
  response_headers jsonb,
  response_body text,
  error_message text,
  received_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  duration_ms integer
);

-- Indexes
CREATE INDEX idx_endpoints_slug ON public.endpoints(slug);
CREATE INDEX idx_endpoints_user_id ON public.endpoints(user_id);
CREATE INDEX idx_webhook_logs_endpoint_received ON public.webhook_logs(endpoint_id, received_at DESC);

-- Trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.endpoints
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ==========================================================================
-- Migration 2: Enable RLS + Policies
-- File: supabase/migrations/20260209000002_enable_rls.sql
-- ==========================================================================

-- Enable RLS
ALTER TABLE public.endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- endpoints policies (direct user_id check)
CREATE POLICY "Users can view own endpoints"
  ON public.endpoints FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own endpoints"
  ON public.endpoints FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own endpoints"
  ON public.endpoints FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own endpoints"
  ON public.endpoints FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- webhook_logs policies (inverted subquery through endpoints)
CREATE POLICY "Users can view logs for own endpoints"
  ON public.webhook_logs FOR SELECT TO authenticated
  USING (endpoint_id IN (SELECT id FROM public.endpoints WHERE user_id = auth.uid()));

CREATE POLICY "Users can update logs for own endpoints"
  ON public.webhook_logs FOR UPDATE TO authenticated
  USING (endpoint_id IN (SELECT id FROM public.endpoints WHERE user_id = auth.uid()))
  WITH CHECK (endpoint_id IN (SELECT id FROM public.endpoints WHERE user_id = auth.uid()));

-- No INSERT policy (service role only)
-- No DELETE policy (cleanup job only)

-- ==========================================================================
-- Migration 3: Enable Realtime
-- File: supabase/migrations/20260209000003_enable_realtime.sql
-- ==========================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_logs;

-- ==========================================================================
-- Migration 4: Setup pg_cron Cleanup
-- File: supabase/migrations/20260209000004_setup_cron_cleanup.sql
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
  'cleanup-old-webhook-logs',
  '0 * * * *',
  $$DELETE FROM public.webhook_logs WHERE received_at < now() - interval '24 hours'$$
);
