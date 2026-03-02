-- Add onboarding_completed_at to profiles table for guided tour state persistence
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;
