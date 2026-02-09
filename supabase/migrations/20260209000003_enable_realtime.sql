-- Migration 3: Enable Supabase Realtime on webhook_logs
-- Adds webhook_logs to the supabase_realtime publication so that
-- browser clients receive instant push notifications on INSERT and UPDATE.
-- Realtime events are automatically filtered by RLS policies.

ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_logs;
