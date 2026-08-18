-- CA Test: separate upload path for real past/mock exam papers, extracted
-- verbatim (no AI generation, no content-block mapping — the student picks
-- the paper at upload time since one uploaded file is virtually always one
-- paper). Deliberately its own bucket/table rather than reusing user_notes,
-- since the processing purpose is completely different from the notes
-- pipeline (verbatim transcription vs extraction + on-demand generation).
-- Run after ca-notes-pipeline-schema.sql (references processing_queue,
-- questions, ca_mock_test_attempts, all created there). Safe to re-run.

-- ============================================================
-- STORAGE — ca-test-papers bucket
-- ============================================================

insert into storage.buckets (id, name, public)
values ('ca-test-papers', 'ca-test-papers', false)
on conflict (id) do nothing;

drop policy if exists "ca_test_papers_owner_insert" on storage.objects;
create policy "ca_test_papers_owner_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ca-test-papers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ca_test_papers_owner_select" on storage.objects;
create policy "ca_test_papers_owner_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'ca-test-papers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ca_test_papers_service_all" on storage.objects;
create policy "ca_test_papers_service_all"
  on storage.objects for all to service_role
  using (bucket_id = 'ca-test-papers')
  with check (bucket_id = 'ca-test-papers');

-- ============================================================
-- CA TEST PAPERS — one row per uploaded real paper
-- No content_map/confidence fields (unlike user_notes) — there's no
-- confirmation step. paper is nullable: the student no longer picks a
-- paper at upload (a document can genuinely span more than one), so this
-- is set after processing to whichever paper most of the extracted
-- questions actually belong to (see ca-test-papers-auto-detect-paper.sql).
-- ============================================================

create table if not exists ca_test_papers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  paper text,
  title text not null,
  file_path text not null,
  mime_type text not null,
  page_count integer default 1,
  processed boolean default false,
  processing_error text,
  question_count integer default 0,
  created_at timestamptz default now()
);

alter table ca_test_papers enable row level security;

drop policy if exists "users_manage_own_test_papers" on ca_test_papers;
create policy "users_manage_own_test_papers"
  on ca_test_papers for all using (auth.uid() = user_id);

drop policy if exists "service_manage_test_papers" on ca_test_papers;
create policy "service_manage_test_papers"
  on ca_test_papers for all to service_role using (true);

create index if not exists idx_test_papers_user on ca_test_papers(user_id);

-- ============================================================
-- EXTEND processing_queue — reuse the same generic queue for test-paper
-- processing instead of a second queue table. note_id is already nullable;
-- a row now has exactly one of note_id / test_paper_id set.
-- ============================================================

alter table processing_queue add column if not exists test_paper_id uuid references ca_test_papers(id) on delete cascade;
create index if not exists idx_queue_test_paper on processing_queue(test_paper_id);

-- ============================================================
-- EXTEND questions — trace verbatim-extracted rows back to their upload,
-- keeping them distinct from notes-derived generated ones (note_id set).
-- ============================================================

alter table questions add column if not exists test_paper_id uuid references ca_test_papers(id) on delete set null;
create index if not exists idx_questions_test_paper on questions(test_paper_id);

-- Real past/mock papers are very often distributed as a question paper only
-- (no answer key bundled in the same file), and a scan can obscure a small
-- printed marks value — the original version of this constraint required
-- correct_option for every mcq row and marks for every descriptive row,
-- which meant such papers could silently extract to 0 questions (everything
-- dropped, nothing to show an obvious error for). Relaxed so a verbatim
-- row (test_paper_id set) can be inserted with correct_option/marks/
-- model_answer null: useCaMockTest.ts treats a null correct_option as
-- ungraded (answerable, excluded from scoring), and the AI evaluator
-- (lib/ca/evaluateAnswer.ts) already tolerates a missing marks/model_answer.
alter table questions drop constraint if exists questions_type_shape_check;
alter table questions add constraint questions_type_shape_check check (
  (question_type = 'mcq' and option_a is not null and option_b is not null
    and option_c is not null and option_d is not null and (correct_option is not null or test_paper_id is not null))
  or
  (question_type = 'descriptive' and (marks is not null or test_paper_id is not null)
    and (model_answer is not null or test_paper_id is not null))
);

-- ============================================================
-- EXTEND ca_mock_test_attempts — trace a real-paper attempt back to the
-- specific upload (previously only stored the paper code).
-- ============================================================

alter table ca_mock_test_attempts add column if not exists test_paper_id uuid references ca_test_papers(id) on delete set null;
create index if not exists idx_mock_attempts_test_paper on ca_mock_test_attempts(test_paper_id);

-- ============================================================
-- EXTEND ca_test_papers — paper is no longer chosen by the student at
-- upload (see ca-test-papers-auto-detect-paper.sql for the full
-- rationale) — drop the not-null constraint for anyone who already has
-- this table from before that change. A no-op if the table is being
-- created fresh from the statement above, which is already nullable.
-- ============================================================

alter table ca_test_papers alter column paper drop not null;

-- ============================================================
-- EXTEND questions — case-study passage grouping (see
-- ca-case-study-questions.sql for the full rationale). Links several
-- questions (verbatim-extracted or notes-generated) to one shared
-- case/scenario passage, stored once instead of duplicated per question or
-- lost. Both null for a normal standalone question.
-- ============================================================

alter table questions add column if not exists case_study_passage text;
alter table questions add column if not exists case_study_group_id uuid;
create index if not exists idx_questions_case_study_group on questions(case_study_group_id);
