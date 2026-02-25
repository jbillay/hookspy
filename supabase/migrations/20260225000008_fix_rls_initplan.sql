-- Migration 8: Fix RLS initplan performance issue
-- Wraps auth.uid() in (select ...) to prevent per-row re-evaluation.
-- This is recommended by Supabase advisors (lint 0003) and improves
-- Realtime postgres_changes RLS evaluation performance.

-- webhook_logs policies
DROP POLICY IF EXISTS "Users can view logs for own endpoints" ON public.webhook_logs;
CREATE POLICY "Users can view logs for own endpoints" ON public.webhook_logs
  FOR SELECT TO authenticated
  USING (endpoint_id IN (SELECT endpoints.id FROM endpoints WHERE endpoints.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can update logs for own endpoints" ON public.webhook_logs;
CREATE POLICY "Users can update logs for own endpoints" ON public.webhook_logs
  FOR UPDATE TO authenticated
  USING (endpoint_id IN (SELECT endpoints.id FROM endpoints WHERE endpoints.user_id = (select auth.uid())))
  WITH CHECK (endpoint_id IN (SELECT endpoints.id FROM endpoints WHERE endpoints.user_id = (select auth.uid())));

-- endpoints policies
DROP POLICY IF EXISTS "Users can view own endpoints" ON public.endpoints;
CREATE POLICY "Users can view own endpoints" ON public.endpoints
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own endpoints" ON public.endpoints;
CREATE POLICY "Users can create own endpoints" ON public.endpoints
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own endpoints" ON public.endpoints;
CREATE POLICY "Users can update own endpoints" ON public.endpoints
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own endpoints" ON public.endpoints;
CREATE POLICY "Users can delete own endpoints" ON public.endpoints
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
