-- Migration 1: Create Tables, Indexes, Trigger
-- Creates endpoints and webhook_logs tables with all constraints,
-- performance indexes, and an auto-updating updated_at trigger.

-- Reusable trigger function for updated_at columns
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- endpoints table: user's webhook receiving URL with forwarding configuration
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

-- webhook_logs table: single webhook request/response lifecycle
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

-- Indexes for performance
CREATE INDEX idx_endpoints_slug ON public.endpoints(slug);
CREATE INDEX idx_endpoints_user_id ON public.endpoints(user_id);
CREATE INDEX idx_webhook_logs_endpoint_received ON public.webhook_logs(endpoint_id, received_at DESC);

-- Auto-update updated_at on endpoints modification
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.endpoints
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();
