-- Replace the placeholder single ca_group column with accurate multi-group
-- and paper-level selection, matching the real ICAI CA syllabus structure.
-- Run in Supabase SQL Editor. Safe to run even if ca_group was never
-- populated with real user data.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS ca_group;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ca_groups TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ca_papers TEXT[] NOT NULL DEFAULT '{}';
