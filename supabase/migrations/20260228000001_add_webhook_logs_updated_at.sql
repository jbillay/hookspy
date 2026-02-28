-- Add updated_at column to webhook_logs for polling fallback support
-- This enables efficient change detection when HTTP polling replaces WebSocket

-- Add updated_at column
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows: use responded_at if available, else received_at
UPDATE public.webhook_logs
  SET updated_at = COALESCE(responded_at, received_at, now());

-- Create or replace the trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on webhook_logs
DROP TRIGGER IF EXISTS set_webhook_logs_updated_at ON public.webhook_logs;
CREATE TRIGGER set_webhook_logs_updated_at
  BEFORE UPDATE ON public.webhook_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- Add index for polling queries (UPDATE detection)
CREATE INDEX IF NOT EXISTS idx_webhook_logs_endpoint_updated
  ON public.webhook_logs (endpoint_id, updated_at DESC);
