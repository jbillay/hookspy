-- Add request_subpath column to store sub-path segments from catch-all webhook URLs
-- e.g. /api/hook/{slug}/stripe/events → request_subpath = '/stripe/events'
ALTER TABLE public.webhook_logs ADD COLUMN request_subpath text;
