-- ============================================================================
-- CA PLATFORM — THIS SESSION'S SCHEMA ADDITIONS, COMBINED
-- ============================================================================
-- Everything schema-related built in this session, in one file — separate
-- from ca-all-pending-migrations.sql (which is the full CA-platform history
-- from the start of the project, already applied). Paste this whole file
-- into one Supabase SQL Editor query and run it once.
--
-- Covers 3 features:
--   1. CA Cheatsheets        (per-note editable cheatsheet)
--   2. Case-Study Questions  (shared passage linking several MCQs/descriptive
--                             questions — verbatim-extracted from a real
--                             paper, or generated from notes)
--   3. Test Papers Auto-Detect Paper (paper is no longer chosen by the
--                             student at upload — ca_test_papers.paper is
--                             now nullable, set after processing)
--
-- Every statement below is idempotent (`create table if not exists`,
-- `add column if not exists`, `drop policy if exists` + recreate, `alter
-- column drop not null`) — safe to run even if you already ran one or more
-- of these individually (ca-cheatsheets-schema.sql /
-- ca-case-study-questions.sql / ca-test-papers-auto-detect-paper.sql).
-- ============================================================================


-- ============================================================================
-- 1. CA CHEATSHEETS
-- ============================================================================

-- One editable, persistent condensed-reference document per uploaded note
-- (key definitions/formulas/section references), separate from
-- questions/flashcards/AI Teacher — a fourth thing a note produces. One row
-- per (user, note): editing overwrites content in place rather than
-- creating versions, and "Regenerate" is the same upsert path as first-time
-- generation.

create table if not exists ca_cheatsheets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  note_id uuid references user_notes(id) on delete cascade,
  content text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, note_id)
);

alter table ca_cheatsheets enable row level security;

drop policy if exists "users_manage_own_cheatsheets" on ca_cheatsheets;
create policy "users_manage_own_cheatsheets"
  on ca_cheatsheets for all using (auth.uid() = user_id);

create index if not exists idx_cheatsheets_user on ca_cheatsheets(user_id);
create index if not exists idx_cheatsheets_note on ca_cheatsheets(note_id);


-- ============================================================================
-- 2. CASE-STUDY QUESTIONS
-- ============================================================================

-- Links questions (verbatim-extracted from a real paper, or generated from
-- notes) that share a single case/scenario passage (e.g. ICAI Final Paper
-- 6, Integrated Business Solutions, whose Case Study MCQs/descriptive
-- questions all read off one shared case; also used for
-- intermediate-mixed/final-mixed scenario MCQs generated from notes) so the
-- passage is stored once and shown once, instead of being duplicated into
-- every sub-question's question_text (with wording drift between copies) or
-- lost entirely. See lib/ca/extractTestPaper.ts and lib/ca/generateContent.ts
-- — the passage text and group id are computed once per case-study group in
-- code, never re-derived per question, so they can't drift between a
-- group's sub-questions. Both columns are null for a normal standalone
-- question.

alter table questions add column if not exists case_study_passage text;
alter table questions add column if not exists case_study_group_id uuid;

create index if not exists idx_questions_case_study_group on questions(case_study_group_id);


-- ============================================================================
-- 3. TEST PAPERS AUTO-DETECT PAPER
-- ============================================================================

-- The student no longer picks a paper at upload — a document can genuinely
-- span more than one CA paper, so lib/ca/extractTestPaper.ts now classifies
-- each question's paper from content itself, and
-- lib/ca/processTestPaper.ts sets ca_test_papers.paper afterward to
-- whichever paper most of the extracted questions actually belong to.

alter table ca_test_papers alter column paper drop not null;
