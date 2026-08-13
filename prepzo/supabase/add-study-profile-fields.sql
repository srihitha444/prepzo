-- Add one-time survey fields used by onboarding and the existing-user profile prompt.
-- Run this in Supabase SQL Editor before deploying the app change.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS survey_current_stage TEXT
    CHECK (survey_current_stage IN ('11th Class', '12th Class', 'Dropper'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS survey_target_exams TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS survey_completed_at TIMESTAMPTZ;
