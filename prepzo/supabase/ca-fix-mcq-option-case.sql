-- ============================================================================
-- CA PLATFORM — ALLOW UPPERCASE correct_option (MCQ GENERATION FIX)
-- ============================================================================
-- Run this one file in the Supabase SQL Editor. Idempotent (drop + recreate),
-- safe to re-run, and it changes no data.
--
-- THE BUG
-- Every CA MCQ insert has always failed. "Create Practice Session" returned
-- "Failed to generate content", and the real error only appeared in the server
-- log:
--
--   new row for relation "questions" violates check constraint
--   "questions_correct_option_check"
--
-- questions_correct_option_check came from supabase/pyq-manual-entry.sql, a
-- NEET-era migration whose comment states "Answers are stored lowercase". Its
-- regex is case-SENSITIVE:
--
--   check (correct_option ~ '^[a-d](,[a-d]){0,3}$')
--
-- Every CA code path, however, produces UPPERCASE A-D, deliberately and
-- consistently: the generation prompt demands `correct_option is exactly one
-- of "A","B","C","D"`, isValidQuestion() tests /^[A-D]$/,
-- extractTestPaper.ts::normalizeCorrectOption() calls .toUpperCase(), and the
-- UI renders/compares against OPTION_KEYS = ["A","B","C","D"] (with
-- PracticeExplorer.tsx doing a case-sensitive `correct_option === key`).
--
-- So 'A' was rejected while 'a' was accepted. Confirmed live: inserting 'A'
-- returns 400 / SQLSTATE 23514, inserting 'a' returns 201.
--
-- WHY IT LOOKED LIKE "GENERATION" WAS BROKEN
-- Nothing about generation was broken. Gemini returned valid JSON
-- (finishReason STOP, parsed cleanly), and the items were even written to the
-- shared generation cache — the pool append happens BEFORE the insert. Only
-- the final insert into `questions` failed, and because it is a single batch,
-- one uppercase MCQ discarded every row in the request, descriptive questions
-- included. That is why the questions pool stayed empty while flashcard pools
-- filled up normally, and why `questions` held zero CA MCQs.
--
-- WHY FIX THE CONSTRAINT RATHER THAN THE CODE
-- Uppercase A-D is the app's convention in six places, including a
-- case-sensitive equality check in PracticeExplorer.tsx that drives answer
-- highlighting. Storing lowercase would silently break that highlighting
-- (scoring would still be right, since useCaPractice/useCaMockTest normalise
-- both sides) — a far worse failure than relaxing a legacy regex.
--
-- The replacement accepts either case and keeps NEET's comma-separated
-- multi-answer format ("a,b"), so the existing lowercase rows still satisfy it.
-- NULL continues to pass, which is what descriptive questions and
-- answer-key-less verbatim MCQs rely on.
-- ============================================================================

alter table public.questions drop constraint if exists questions_correct_option_check;

alter table public.questions
  add constraint questions_correct_option_check
  check (correct_option ~ '^[A-Da-d](,[A-Da-d]){0,3}$');
