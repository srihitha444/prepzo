-- =============================================
-- PYQ PAPER QUESTION MAPPING
-- Run this in Supabase SQL Editor.
--
-- Keeps paper-specific fields out of the unique question bank.
-- Do not remove legacy columns from pyq_questions yet.
-- =============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

CREATE INDEX IF NOT EXISTS idx_pyq_paper_questions_paper
  ON pyq_paper_questions(paper_id, question_number);

CREATE INDEX IF NOT EXISTS idx_pyq_paper_questions_question
  ON pyq_paper_questions(question_id);

ALTER TABLE pyq_paper_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read pyq paper questions" ON pyq_paper_questions;
CREATE POLICY "Authenticated users can read pyq paper questions"
  ON pyq_paper_questions FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage pyq paper questions" ON pyq_paper_questions;
CREATE POLICY "Admins can manage pyq paper questions"
  ON pyq_paper_questions FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role can manage pyq paper questions" ON pyq_paper_questions;
CREATE POLICY "Service role can manage pyq paper questions"
  ON pyq_paper_questions FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
