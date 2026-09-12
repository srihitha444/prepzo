-- Fix cross-user data exposure: questions/flashcards are shared tables
-- between NEET and CA. NEET's blanket "any authenticated user can read any
-- active row" policy is correct there (a single curated shared bank every
-- NEET student is meant to see) — but CA has no shared bank at all: every
-- CA row is AI-generated from ONE student's own privately uploaded note
-- (note_id -> user_notes) or their own uploaded real paper (test_paper_id ->
-- ca_test_papers, questions only). Under the old blanket policy, any CA
-- student's Practice/Flashcards session could pull in every other CA
-- student's generated content — confirmed live: a student saw Accounting
-- questions in Practice despite never uploading anything in that subject,
-- because a different account had generated Accounting content earlier.
--
-- No new column / backfill needed: note_id and test_paper_id are already
-- set on every CA row at insert time (lib/ca/generateContent.ts,
-- lib/ca/extractTestPaper.ts) and already reference the uploading user via
-- user_notes.user_id / ca_test_papers.user_id — ownership can be checked
-- with a join instead of denormalizing a user_id column onto questions/
-- flashcards. This only tightens the SELECT policy; all writes already go
-- through the service_role "manage" policy and are unaffected.
--
-- Safe to re-run.

drop policy if exists "Authenticated users can read questions" on questions;
create policy "Authenticated users can read questions"
  on questions for select to authenticated
  using (
    is_active = true
    and (
      exam <> 'CA'
      or (note_id is not null and exists (
        select 1 from user_notes un where un.id = questions.note_id and un.user_id = auth.uid()
      ))
      or (test_paper_id is not null and exists (
        select 1 from ca_test_papers tp where tp.id = questions.test_paper_id and tp.user_id = auth.uid()
      ))
    )
  );

drop policy if exists "Authenticated users can read flashcards" on flashcards;
create policy "Authenticated users can read flashcards"
  on flashcards for select to authenticated
  using (
    is_active = true
    and (
      exam <> 'CA'
      or (note_id is not null and exists (
        select 1 from user_notes un where un.id = flashcards.note_id and un.user_id = auth.uid()
      ))
    )
  );
