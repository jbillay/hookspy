-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  plan_changed_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for admin filtering and search
CREATE INDEX idx_profiles_plan ON public.profiles(plan);
CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS: Users can read their own profile; admins can read all
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- RLS: Users can update their own profile; admins can update all
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: auto-create profile on auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
