-- Store PYQ question attempts separately from normal MCQ recall/review progress.
-- Run this in Supabase SQL Editor before using PYQ not-attempted tracking.

CREATE TABLE IF NOT EXISTS public.pyq_question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  pyq_year INTEGER,
  selected_option TEXT CHECK (selected_option IS NULL OR selected_option ~ '^[a-d](,[a-d]){0,3}$'),
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  time_seconds INTEGER NOT NULL DEFAULT 0,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_pyq_question_attempts_user_year
  ON public.pyq_question_attempts(user_id, pyq_year, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_pyq_question_attempts_question
  ON public.pyq_question_attempts(question_id);

ALTER TABLE public.pyq_question_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own PYQ attempts" ON public.pyq_question_attempts;
CREATE POLICY "Users can manage own PYQ attempts"
  ON public.pyq_question_attempts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage PYQ attempts" ON public.pyq_question_attempts;
CREATE POLICY "Service role can manage PYQ attempts"
  ON public.pyq_question_attempts FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
