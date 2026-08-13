-- Prepzo subject/progress repair migration
-- Run this once in Supabase SQL Editor after deploying the app changes.
-- Purpose:
-- 1. Normalize old/imported subject values so dashboard/progress group correctly.
-- 2. Ensure progress upserts have the required unique constraints.
-- 3. Keep the new Pro-session columns/indexes in place.

BEGIN;

-- Existing imports may contain lowercase values, trailing spaces, "Zology", or "Biology".
-- Prepzo's current NEET subject taxonomy is: Physics, Chemistry, Botany, Zoology.
UPDATE questions
SET subject = CASE
  WHEN lower(trim(subject)) = 'physics' THEN 'Physics'
  WHEN lower(trim(subject)) = 'chemistry' THEN 'Chemistry'
  WHEN lower(trim(subject)) = 'botany' THEN 'Botany'
  WHEN lower(trim(subject)) IN ('zoology', 'zology', 'zoo', 'biology') THEN 'Zoology'
  ELSE trim(subject)
END
WHERE subject IS DISTINCT FROM CASE
  WHEN lower(trim(subject)) = 'physics' THEN 'Physics'
  WHEN lower(trim(subject)) = 'chemistry' THEN 'Chemistry'
  WHEN lower(trim(subject)) = 'botany' THEN 'Botany'
  WHEN lower(trim(subject)) IN ('zoology', 'zology', 'zoo', 'biology') THEN 'Zoology'
  ELSE trim(subject)
END;

UPDATE flashcards
SET subject = CASE
  WHEN lower(trim(subject)) = 'physics' THEN 'Physics'
  WHEN lower(trim(subject)) = 'chemistry' THEN 'Chemistry'
  WHEN lower(trim(subject)) = 'botany' THEN 'Botany'
  WHEN lower(trim(subject)) IN ('zoology', 'zology', 'zoo', 'biology') THEN 'Zoology'
  ELSE trim(subject)
END
WHERE subject IS DISTINCT FROM CASE
  WHEN lower(trim(subject)) = 'physics' THEN 'Physics'
  WHEN lower(trim(subject)) = 'chemistry' THEN 'Chemistry'
  WHEN lower(trim(subject)) = 'botany' THEN 'Botany'
  WHEN lower(trim(subject)) IN ('zoology', 'zology', 'zoo', 'biology') THEN 'Zoology'
  ELSE trim(subject)
END;

UPDATE quiz_sessions
SET subject = CASE
  WHEN subject IS NULL THEN NULL
  WHEN lower(trim(subject)) = 'physics' THEN 'Physics'
  WHEN lower(trim(subject)) = 'chemistry' THEN 'Chemistry'
  WHEN lower(trim(subject)) = 'botany' THEN 'Botany'
  WHEN lower(trim(subject)) IN ('zoology', 'zology', 'zoo', 'biology') THEN 'Zoology'
  ELSE trim(subject)
END
WHERE subject IS NOT NULL;

-- Required for Pro "new this week" priority.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS added_week DATE DEFAULT CURRENT_DATE;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS added_week DATE DEFAULT CURRENT_DATE;

-- Required for PYQ filters and weightage analysis.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS chapter TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subtopic TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_pyq BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS pyq_year INTEGER;

UPDATE questions SET added_week = CURRENT_DATE WHERE added_week IS NULL;
UPDATE flashcards SET added_week = CURRENT_DATE WHERE added_week IS NULL;

-- Required for .upsert(..., { onConflict: "user_id,question_id" }).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_progress_user_id_question_id_key'
      AND conrelid = 'public.user_progress'::regclass
  ) THEN
    ALTER TABLE user_progress
      ADD CONSTRAINT user_progress_user_id_question_id_key UNIQUE (user_id, question_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_flashcard_progress_user_id_flashcard_id_key'
      AND conrelid = 'public.user_flashcard_progress'::regclass
  ) THEN
    ALTER TABLE user_flashcard_progress
      ADD CONSTRAINT user_flashcard_progress_user_id_flashcard_id_key UNIQUE (user_id, flashcard_id);
  END IF;
END $$;

-- Match app-supported NEET subjects going forward.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_neet_subject_check'
      AND conrelid = 'public.questions'::regclass
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT questions_neet_subject_check
      CHECK (exam <> 'NEET' OR subject IN ('Physics', 'Chemistry', 'Botany', 'Zoology'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flashcards_neet_subject_check'
      AND conrelid = 'public.flashcards'::regclass
  ) THEN
    ALTER TABLE flashcards
      ADD CONSTRAINT flashcards_neet_subject_check
      CHECK (exam <> 'NEET' OR subject IN ('Physics', 'Chemistry', 'Botany', 'Zoology'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_exam_subject ON questions(exam, subject);
CREATE INDEX IF NOT EXISTS idx_questions_pyq ON questions(is_pyq, pyq_year);
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter);
CREATE INDEX IF NOT EXISTS idx_questions_subtopic ON questions(subtopic);
CREATE INDEX IF NOT EXISTS idx_questions_added_week ON questions(added_week);
CREATE INDEX IF NOT EXISTS idx_questions_active_created ON questions(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flashcards_exam_subject ON flashcards(exam, subject);
CREATE INDEX IF NOT EXISTS idx_flashcards_added_week ON flashcards(added_week);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_due ON user_progress(user_id, deck_type, next_due_at);
CREATE INDEX IF NOT EXISTS idx_user_progress_seen ON user_progress(user_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_ufp_user ON user_flashcard_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_ufp_due ON user_flashcard_progress(user_id, deck_type, next_due_at);
CREATE INDEX IF NOT EXISTS idx_ufp_seen ON user_flashcard_progress(user_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_completed ON quiz_sessions(user_id, completed_at DESC);

-- Required for duplicate-safe PYQ paper imports.
CREATE TABLE IF NOT EXISTS pyq_paper_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID REFERENCES pyq_papers(id) ON DELETE CASCADE,
  question_id UUID REFERENCES pyq_questions(id) ON DELETE CASCADE,
  question_number INT NOT NULL,
  correct_option TEXT CHECK (correct_option ~ '^[a-d](,[a-d]){0,3}$'),
  marks_correct INT DEFAULT 4,
  marks_wrong INT DEFAULT -1,
  marks_unattempted INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(paper_id, question_number),
  UNIQUE(paper_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_pyq_paper_questions_paper ON pyq_paper_questions(paper_id, question_number);
CREATE INDEX IF NOT EXISTS idx_pyq_paper_questions_question ON pyq_paper_questions(question_id);

COMMIT;

-- Optional verification queries:
-- SELECT subject, count(*) FROM questions GROUP BY subject ORDER BY subject;
-- SELECT q.subject, sum(up.times_seen) AS attempts, sum(up.times_correct) AS correct
-- FROM user_progress up
-- JOIN questions q ON q.id = up.question_id
-- GROUP BY q.subject
-- ORDER BY q.subject;
