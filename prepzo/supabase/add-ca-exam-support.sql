-- Widen exam CHECK constraints to allow 'CA' alongside 'NEET', and add
-- CA-specific onboarding columns. Run in Supabase SQL Editor before
-- deploying the CA vertical foundation.

-- Tip: if these DROP CONSTRAINT statements report "constraint does not
-- exist", find the actual names first and adjust below:
--   SELECT conname, conrelid::regclass FROM pg_constraint
--   WHERE contype = 'c' AND conrelid IN
--     ('public.profiles'::regclass, 'public.questions'::regclass, 'public.flashcards'::regclass);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_exam_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_exam_check CHECK (exam IN ('NEET', 'CA'));

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_exam_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_exam_check CHECK (exam IN ('NEET', 'CA'));

ALTER TABLE public.flashcards DROP CONSTRAINT IF EXISTS flashcards_exam_check;
ALTER TABLE public.flashcards ADD CONSTRAINT flashcards_exam_check CHECK (exam IN ('NEET', 'CA'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ca_level TEXT
  CHECK (ca_level IN ('Foundation', 'Intermediate', 'Final'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ca_group TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ca_target_attempt_date DATE;
