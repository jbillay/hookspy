-- Migration 2: Enable Row Level Security + Policies
-- Enforces user data isolation on both tables.
-- Authenticated users can only access their own data.
-- Service role (used by serverless functions) bypasses RLS.

-- Enable RLS on both tables
ALTER TABLE public.endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- endpoints policies (direct user_id check)
-- ==========================================================================

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

-- ==========================================================================
-- webhook_logs policies (inverted subquery through endpoints for performance)
-- No INSERT policy: logs are created by serverless functions via service role
-- No DELETE policy: logs are removed only by the automated cleanup job
-- ==========================================================================

CREATE POLICY "Users can view logs for own endpoints"
  ON public.webhook_logs FOR SELECT TO authenticated
  USING (endpoint_id IN (SELECT id FROM public.endpoints WHERE user_id = auth.uid()));

CREATE POLICY "Users can update logs for own endpoints"
  ON public.webhook_logs FOR UPDATE TO authenticated
  USING (endpoint_id IN (SELECT id FROM public.endpoints WHERE user_id = auth.uid()))
  WITH CHECK (endpoint_id IN (SELECT id FROM public.endpoints WHERE user_id = auth.uid()));
