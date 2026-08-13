-- ============================================================
-- PREPZO PYQ MANUAL ENTRY + LATER ANSWER KEY
-- ============================================================
-- 1. Run this file in Supabase SQL Editor.
-- 2. Import the "PYQ Entry" CSV into public.pyq_import_staging.
-- 3. Later import the "Answer Key" CSV into public.pyq_answer_keys.
-- 4. Promote validated rows into the existing questions table:
--
--    SELECT public.promote_pyq_year('NEET', 2025, 'A');
--
-- Use paper_code 'A' for Paper 1 and 'AA' for Paper 2 in the same year.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Existing MCQs remain in public.questions. These optional columns preserve
-- text -> inline image -> text display order and image-only options.
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question_text_before_image TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question_inline_image_path TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question_text_after_image TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS option_a_image_path TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS option_b_image_path TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS option_c_image_path TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS option_d_image_path TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS chapter TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS subtopic TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_pyq BOOLEAN DEFAULT FALSE;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS pyq_year INTEGER;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS pyq_source_key TEXT;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_neet_subject_check;
ALTER TABLE public.questions
  ADD CONSTRAINT questions_neet_subject_check
  CHECK (exam <> 'NEET' OR subject IN ('Physics', 'Chemistry', 'Biology', 'Botany', 'Zoology'));

-- Answers are stored lowercase. Multi-correct questions use comma-separated
-- options such as "a,b", so Q63 can be imported without schema errors.
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_correct_option_check;
ALTER TABLE public.questions
  ALTER COLUMN correct_option TYPE TEXT USING LOWER(BTRIM(correct_option::TEXT));
ALTER TABLE public.questions
  ADD CONSTRAINT questions_correct_option_check
  CHECK (correct_option ~ '^[a-d](,[a-d]){0,3}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_pyq_source_key
  ON public.questions(pyq_source_key)
  WHERE pyq_source_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pyq_exam_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam TEXT NOT NULL,
  year INTEGER NOT NULL,
  paper_code TEXT NOT NULL DEFAULT 'A' CHECK (paper_code ~ '^[A-Z]{1,3}$'),
  total_questions INTEGER NOT NULL DEFAULT 180,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam, year, paper_code)
);

ALTER TABLE public.pyq_exam_years ADD COLUMN IF NOT EXISTS paper_code TEXT NOT NULL DEFAULT 'A';
ALTER TABLE public.pyq_exam_years DROP CONSTRAINT IF EXISTS pyq_exam_years_exam_year_key;
ALTER TABLE public.pyq_exam_years DROP CONSTRAINT IF EXISTS pyq_exam_years_paper_code_check;
ALTER TABLE public.pyq_exam_years
  ADD CONSTRAINT pyq_exam_years_paper_code_check
  CHECK (paper_code ~ '^[A-Z]{1,3}$');
CREATE UNIQUE INDEX IF NOT EXISTS idx_pyq_exam_years_unique_paper
  ON public.pyq_exam_years(exam, year, paper_code);

-- A question or option may have:
-- - text only
-- - image only
-- - both text and image
--
-- For an image inside a question, use:
-- question_text_before_image -> question_inline_image_path ->
-- question_text_after_image.
CREATE TABLE IF NOT EXISTS public.pyq_import_staging (
  import_key TEXT PRIMARY KEY,
  exam TEXT NOT NULL,
  year INTEGER NOT NULL,
  paper_code TEXT NOT NULL DEFAULT 'A' CHECK (paper_code ~ '^[A-Z]{1,3}$'),
  question_number INTEGER NOT NULL CHECK (question_number > 0),
  subject TEXT NOT NULL,
  chapter TEXT,
  topic TEXT,
  subtopic TEXT,
  question_text_before_image TEXT,
  question_inline_image_path TEXT,
  question_text_after_image TEXT,
  option_a_text TEXT,
  option_a_image_path TEXT,
  option_b_text TEXT,
  option_b_image_path TEXT,
  option_c_text TEXT,
  option_c_image_path TEXT,
  option_d_text TEXT,
  option_d_image_path TEXT,
  explanation TEXT,
  difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  marks_correct INTEGER NOT NULL DEFAULT 4,
  marks_wrong INTEGER NOT NULL DEFAULT -1,
  marks_unattempted INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  entry_status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (entry_status IN ('Draft', 'Ready', 'Needs Review')),
  notes TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam, year, paper_code, question_number)
);

-- Compatibility with an earlier draft of this setup.
ALTER TABLE public.pyq_import_staging ADD COLUMN IF NOT EXISTS question_text_before_image TEXT;
ALTER TABLE public.pyq_import_staging ADD COLUMN IF NOT EXISTS question_inline_image_path TEXT;
ALTER TABLE public.pyq_import_staging ADD COLUMN IF NOT EXISTS question_text_after_image TEXT;
ALTER TABLE public.pyq_import_staging ADD COLUMN IF NOT EXISTS option_a_text TEXT;
ALTER TABLE public.pyq_import_staging ADD COLUMN IF NOT EXISTS option_a_image_path TEXT;
ALTER TABLE public.pyq_import_staging ADD COLUMN IF NOT EXISTS option_b_text TEXT;
ALTER TABLE public.pyq_import_staging ADD COLUMN IF NOT EXISTS option_b_image_path TEXT;
ALTER TABLE public.pyq_import_staging ADD COLUMN IF NOT EXISTS option_c_text TEXT;
ALTER TABLE public.pyq_import_staging ADD COLUMN IF NOT EXISTS option_c_image_path TEXT;
ALTER TABLE public.pyq_import_staging ADD COLUMN IF NOT EXISTS option_d_text TEXT;
ALTER TABLE public.pyq_import_staging ADD COLUMN IF NOT EXISTS option_d_image_path TEXT;
ALTER TABLE public.pyq_import_staging ADD COLUMN IF NOT EXISTS paper_code TEXT NOT NULL DEFAULT 'A';
ALTER TABLE public.pyq_import_staging DROP CONSTRAINT IF EXISTS pyq_import_staging_exam_year_question_number_key;
ALTER TABLE public.pyq_import_staging DROP CONSTRAINT IF EXISTS pyq_import_staging_paper_code_check;
ALTER TABLE public.pyq_import_staging
  ADD CONSTRAINT pyq_import_staging_paper_code_check
  CHECK (paper_code ~ '^[A-Z]{1,3}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_pyq_import_unique_question
  ON public.pyq_import_staging(exam, year, paper_code, question_number);

CREATE TABLE IF NOT EXISTS public.pyq_answer_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam TEXT NOT NULL,
  year INTEGER NOT NULL,
  paper_code TEXT NOT NULL DEFAULT 'A' CHECK (paper_code ~ '^[A-Z]{1,3}$'),
  question_number INTEGER NOT NULL CHECK (question_number > 0),
  correct_option TEXT NOT NULL CHECK (correct_option ~ '^[a-d](,[a-d]){0,3}$'),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam, year, paper_code, question_number)
);

ALTER TABLE public.pyq_answer_keys ADD COLUMN IF NOT EXISTS paper_code TEXT NOT NULL DEFAULT 'A';
ALTER TABLE public.pyq_answer_keys DROP COLUMN IF EXISTS answer_code;
ALTER TABLE public.pyq_answer_keys
  ALTER COLUMN correct_option TYPE TEXT USING LOWER(correct_option::TEXT);
ALTER TABLE public.pyq_answer_keys DROP CONSTRAINT IF EXISTS pyq_answer_keys_exam_year_question_number_key;
ALTER TABLE public.pyq_answer_keys DROP CONSTRAINT IF EXISTS pyq_answer_keys_paper_code_check;
ALTER TABLE public.pyq_answer_keys
  ADD CONSTRAINT pyq_answer_keys_paper_code_check
  CHECK (paper_code ~ '^[A-Z]{1,3}$');
ALTER TABLE public.pyq_answer_keys DROP CONSTRAINT IF EXISTS pyq_answer_keys_correct_option_check;
ALTER TABLE public.pyq_answer_keys
  ADD CONSTRAINT pyq_answer_keys_correct_option_check
  CHECK (correct_option ~ '^[a-d](,[a-d]){0,3}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_pyq_answer_unique_question
  ON public.pyq_answer_keys(exam, year, paper_code, question_number);

CREATE TABLE IF NOT EXISTS public.pyq_year_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_year_id UUID NOT NULL REFERENCES public.pyq_exam_years(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option ~ '^[a-d](,[a-d]){0,3}$'),
  marks_correct INTEGER NOT NULL DEFAULT 4,
  marks_wrong INTEGER NOT NULL DEFAULT -1,
  marks_unattempted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_year_id, question_number),
  UNIQUE (exam_year_id, question_id)
);

ALTER TABLE public.pyq_year_items DROP COLUMN IF EXISTS answer_code;
ALTER TABLE public.pyq_year_items
  ALTER COLUMN correct_option TYPE TEXT USING LOWER(correct_option::TEXT);
ALTER TABLE public.pyq_year_items DROP CONSTRAINT IF EXISTS pyq_year_items_correct_option_check;
ALTER TABLE public.pyq_year_items
  ADD CONSTRAINT pyq_year_items_correct_option_check
  CHECK (correct_option ~ '^[a-d](,[a-d]){0,3}$');

CREATE INDEX IF NOT EXISTS idx_pyq_import_year
  ON public.pyq_import_staging(exam, year, paper_code, question_number);
CREATE INDEX IF NOT EXISTS idx_pyq_answer_key
  ON public.pyq_answer_keys(exam, year, paper_code, question_number);
CREATE INDEX IF NOT EXISTS idx_pyq_year_items
  ON public.pyq_year_items(exam_year_id, question_number);

-- Excel stores paths relative to this private bucket:
-- pyq/neet/2025/A/q006/question-inline.png
-- pyq/neet/2016/AA/q006/question-inline.png
INSERT INTO storage.buckets (id, name, public)
VALUES ('pyq-assets', 'pyq-assets', FALSE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

ALTER TABLE public.pyq_exam_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pyq_import_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pyq_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pyq_year_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read PYQ years" ON public.pyq_exam_years;
CREATE POLICY "Authenticated users can read PYQ years"
  ON public.pyq_exam_years FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read PYQ year items" ON public.pyq_year_items;
CREATE POLICY "Authenticated users can read PYQ year items"
  ON public.pyq_year_items FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage PYQ years" ON public.pyq_exam_years;
CREATE POLICY "Admins can manage PYQ years"
  ON public.pyq_exam_years FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage PYQ staging" ON public.pyq_import_staging;
CREATE POLICY "Admins can manage PYQ staging"
  ON public.pyq_import_staging FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage PYQ answer keys" ON public.pyq_answer_keys;
CREATE POLICY "Admins can manage PYQ answer keys"
  ON public.pyq_answer_keys FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage PYQ year items" ON public.pyq_year_items;
CREATE POLICY "Admins can manage PYQ year items"
  ON public.pyq_year_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role can manage PYQ years" ON public.pyq_exam_years;
CREATE POLICY "Service role can manage PYQ years"
  ON public.pyq_exam_years FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role can manage PYQ staging" ON public.pyq_import_staging;
CREATE POLICY "Service role can manage PYQ staging"
  ON public.pyq_import_staging FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role can manage PYQ answer keys" ON public.pyq_answer_keys;
CREATE POLICY "Service role can manage PYQ answer keys"
  ON public.pyq_answer_keys FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role can manage PYQ year items" ON public.pyq_year_items;
CREATE POLICY "Service role can manage PYQ year items"
  ON public.pyq_year_items FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read PYQ assets" ON storage.objects;
CREATE POLICY "Authenticated users can read PYQ assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pyq-assets');

DROP POLICY IF EXISTS "Admins can manage PYQ assets" ON storage.objects;
CREATE POLICY "Admins can manage PYQ assets"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'pyq-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'pyq-assets' AND public.is_admin());

CREATE OR REPLACE FUNCTION public.promote_pyq_year(
  p_exam TEXT,
  p_year INTEGER,
  p_paper_code TEXT DEFAULT 'A'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_year_id UUID;
  v_ready_count INTEGER;
  v_answer_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_ready_count
  FROM public.pyq_import_staging
  WHERE exam = p_exam
    AND year = p_year
    AND paper_code = p_paper_code
    AND entry_status = 'Ready';

  IF v_ready_count = 0 THEN
    RAISE EXCEPTION 'No Ready rows found for % % paper %', p_exam, p_year, p_paper_code;
  END IF;

  SELECT COUNT(*) INTO v_answer_count
  FROM public.pyq_answer_keys
  WHERE exam = p_exam
    AND year = p_year
    AND paper_code = p_paper_code;

  IF v_answer_count <> v_ready_count THEN
    RAISE EXCEPTION
      'Answer key count (%) does not match Ready question count (%)',
      v_answer_count, v_ready_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pyq_import_staging s
    WHERE s.exam = p_exam
      AND s.year = p_year
      AND s.paper_code = p_paper_code
      AND s.entry_status = 'Ready'
      AND (
        (
          NULLIF(BTRIM(s.question_text_before_image), '') IS NULL
          AND NULLIF(BTRIM(s.question_inline_image_path), '') IS NULL
          AND NULLIF(BTRIM(s.question_text_after_image), '') IS NULL
        )
        OR (
          NULLIF(BTRIM(s.option_a_text), '') IS NULL
          AND NULLIF(BTRIM(s.option_a_image_path), '') IS NULL
        )
        OR (
          NULLIF(BTRIM(s.option_b_text), '') IS NULL
          AND NULLIF(BTRIM(s.option_b_image_path), '') IS NULL
        )
        OR (
          NULLIF(BTRIM(s.option_c_text), '') IS NULL
          AND NULLIF(BTRIM(s.option_c_image_path), '') IS NULL
        )
        OR (
          NULLIF(BTRIM(s.option_d_text), '') IS NULL
          AND NULLIF(BTRIM(s.option_d_image_path), '') IS NULL
        )
      )
  ) THEN
    RAISE EXCEPTION 'A Ready row is missing question or option content';
  END IF;

  INSERT INTO public.pyq_exam_years (exam, year, paper_code, total_questions)
  VALUES (p_exam, p_year, p_paper_code, v_ready_count)
  ON CONFLICT (exam, year, paper_code)
  DO UPDATE SET total_questions = EXCLUDED.total_questions
  RETURNING id INTO v_exam_year_id;

  INSERT INTO public.questions (
    exam, subject, topic, chapter, subtopic,
    is_pyq, pyq_year,
    question_text,
    question_text_before_image,
    question_inline_image_path,
    question_text_after_image,
    option_a, option_a_image_path,
    option_b, option_b_image_path,
    option_c, option_c_image_path,
    option_d, option_d_image_path,
    correct_option, explanation, difficulty, is_active, pyq_source_key
  )
  SELECT
    s.exam,
    s.subject,
    NULLIF(BTRIM(s.topic), ''),
    NULLIF(BTRIM(s.chapter), ''),
    NULLIF(BTRIM(s.subtopic), ''),
    TRUE,
    s.year,
    COALESCE(
      NULLIF(BTRIM(CONCAT_WS(
        ' ',
        NULLIF(BTRIM(s.question_text_before_image), ''),
        NULLIF(BTRIM(s.question_text_after_image), '')
      )), ''),
      '[See question image]'
    ),
    NULLIF(BTRIM(s.question_text_before_image), ''),
    NULLIF(BTRIM(s.question_inline_image_path), ''),
    NULLIF(BTRIM(s.question_text_after_image), ''),
    COALESCE(NULLIF(BTRIM(s.option_a_text), ''), '[See option image]'),
    NULLIF(BTRIM(s.option_a_image_path), ''),
    COALESCE(NULLIF(BTRIM(s.option_b_text), ''), '[See option image]'),
    NULLIF(BTRIM(s.option_b_image_path), ''),
    COALESCE(NULLIF(BTRIM(s.option_c_text), ''), '[See option image]'),
    NULLIF(BTRIM(s.option_c_image_path), ''),
    COALESCE(NULLIF(BTRIM(s.option_d_text), ''), '[See option image]'),
    NULLIF(BTRIM(s.option_d_image_path), ''),
    a.correct_option,
    NULLIF(BTRIM(s.explanation), ''),
    s.difficulty,
    s.is_active,
    s.import_key
  FROM public.pyq_import_staging s
  JOIN public.pyq_answer_keys a
    ON a.exam = s.exam
   AND a.year = s.year
   AND a.paper_code = s.paper_code
   AND a.question_number = s.question_number
  WHERE s.exam = p_exam
    AND s.year = p_year
    AND s.paper_code = p_paper_code
    AND s.entry_status = 'Ready'
  ON CONFLICT (pyq_source_key) WHERE pyq_source_key IS NOT NULL
  DO UPDATE SET
    subject = EXCLUDED.subject,
    topic = EXCLUDED.topic,
    chapter = EXCLUDED.chapter,
    subtopic = EXCLUDED.subtopic,
    question_text = EXCLUDED.question_text,
    question_text_before_image = EXCLUDED.question_text_before_image,
    question_inline_image_path = EXCLUDED.question_inline_image_path,
    question_text_after_image = EXCLUDED.question_text_after_image,
    option_a = EXCLUDED.option_a,
    option_a_image_path = EXCLUDED.option_a_image_path,
    option_b = EXCLUDED.option_b,
    option_b_image_path = EXCLUDED.option_b_image_path,
    option_c = EXCLUDED.option_c,
    option_c_image_path = EXCLUDED.option_c_image_path,
    option_d = EXCLUDED.option_d,
    option_d_image_path = EXCLUDED.option_d_image_path,
    correct_option = EXCLUDED.correct_option,
    explanation = EXCLUDED.explanation,
    difficulty = EXCLUDED.difficulty,
    is_active = EXCLUDED.is_active;

  INSERT INTO public.pyq_year_items (
    exam_year_id, question_id, question_number, correct_option,
    marks_correct, marks_wrong, marks_unattempted
  )
  SELECT
    v_exam_year_id,
    q.id,
    s.question_number,
    a.correct_option,
    s.marks_correct,
    s.marks_wrong,
    s.marks_unattempted
  FROM public.pyq_import_staging s
  JOIN public.questions q ON q.pyq_source_key = s.import_key
  JOIN public.pyq_answer_keys a
    ON a.exam = s.exam
   AND a.year = s.year
   AND a.paper_code = s.paper_code
   AND a.question_number = s.question_number
  WHERE s.exam = p_exam
    AND s.year = p_year
    AND s.paper_code = p_paper_code
    AND s.entry_status = 'Ready'
  ON CONFLICT (exam_year_id, question_number)
  DO UPDATE SET
    question_id = EXCLUDED.question_id,
    correct_option = EXCLUDED.correct_option,
    marks_correct = EXCLUDED.marks_correct,
    marks_wrong = EXCLUDED.marks_wrong,
    marks_unattempted = EXCLUDED.marks_unattempted;

  RETURN v_ready_count;
END;
$$;
