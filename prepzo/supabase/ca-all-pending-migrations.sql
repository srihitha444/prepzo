-- ============================================================================
-- CA PLATFORM — ALL PENDING MIGRATIONS, COMBINED
-- ============================================================================
-- Paste this whole file into one Supabase SQL Editor query and run it once.
-- It's the concatenation of these 5 files, in the order they must run (each
-- references tables the previous one creates) — kept in sync with any later
-- in-place edits to those files (e.g. ai_teacher_sessions.note_id,
-- flashcard_sessions.topic), not just their original content:
--
--   1. ca-notes-pipeline-schema.sql        (notes upload/processing)
--   2. ca-practice-history-schema.sql      (note-scoped retake/history)
--   3. ca-evaluation-teacher-mocktest-schema.sql
--                                          (descriptive grading, AI Teacher, mock tests)
--   4. ca-test-papers-schema.sql           (real past/mock paper upload, verbatim
--                                          extraction — separate from the notes pipeline)
--   5. ca-cheatsheets-schema.sql           (per-note editable cheatsheet)
--
-- Already ran this file once and just need the newest column(s)? You don't
-- have to re-run the whole thing — every `alter table ... add column if not
-- exists` below is safe to re-run on its own, and ca-flashcard-sections.sql
-- has the flashcard_sessions.topic addition as a standalone one-statement
-- file if that's the only thing you're missing.
--
-- Prerequisite (should already be applied — CA onboarding already works,
-- which requires these): schema.sql (or sql-editor-setup.sql),
-- add-ca-exam-support.sql, update-ca-paper-taxonomy.sql. Not included here.
--
-- Every statement below is idempotent (`if not exists` / `drop policy if
-- exists` + recreate) — safe to run more than once, including re-running
-- this whole combined file.
-- ============================================================================


-- ============================================================================
-- FILE 1/5: ca-notes-pipeline-schema.sql
-- ============================================================================

-- ============================================================
-- STORAGE — ca-notes bucket
-- ============================================================

insert into storage.buckets (id, name, public)
values ('ca-notes', 'ca-notes', false)
on conflict (id) do nothing;

drop policy if exists "ca_notes_owner_insert" on storage.objects;
create policy "ca_notes_owner_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ca-notes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ca_notes_owner_select" on storage.objects;
create policy "ca_notes_owner_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'ca-notes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ca_notes_service_all" on storage.objects;
create policy "ca_notes_service_all"
  on storage.objects for all to service_role
  using (bucket_id = 'ca-notes')
  with check (bucket_id = 'ca-notes');

-- ============================================================
-- USER NOTES — one row per upload
-- ============================================================

create table if not exists user_notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  file_path text not null,
  file_type text check (file_type in ('pdf','image')),
  mime_type text not null,
  page_count integer default 1,
  processed boolean default false,
  processing_error text,
  content_map jsonb,
  created_at timestamptz default now()
);

alter table user_notes enable row level security;

drop policy if exists "users_manage_own_notes" on user_notes;
create policy "users_manage_own_notes"
  on user_notes for all using (auth.uid() = user_id);

drop policy if exists "service_manage_notes" on user_notes;
create policy "service_manage_notes"
  on user_notes for all to service_role using (true);

create index if not exists idx_user_notes_user on user_notes(user_id);

-- ============================================================
-- PROCESSING QUEUE — tracks background extraction/generation status
-- ============================================================

create table if not exists processing_queue (
  id uuid default gen_random_uuid() primary key,
  note_id uuid references user_notes(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','processing','completed','failed')),
  attempts integer default 0,
  error_message text,
  queued_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

alter table processing_queue enable row level security;

drop policy if exists "users_view_own_queue" on processing_queue;
create policy "users_view_own_queue"
  on processing_queue for select using (auth.uid() = user_id);

drop policy if exists "service_manage_queue" on processing_queue;
create policy "service_manage_queue"
  on processing_queue for all to service_role using (true);

create index if not exists idx_queue_status on processing_queue(status);
create index if not exists idx_queue_user on processing_queue(user_id);
create index if not exists idx_queue_note on processing_queue(note_id);

-- ============================================================
-- EXTEND questions — add CA generation fields, allow descriptive shape
-- ============================================================

alter table questions add column if not exists question_type text default 'mcq'
  check (question_type in ('mcq','descriptive'));
alter table questions add column if not exists paper text;
alter table questions add column if not exists content_type text
  check (content_type in ('text','table','formula','legal','diagram'));
alter table questions add column if not exists marks integer;
alter table questions add column if not exists model_answer text;
alter table questions add column if not exists mark_allocation jsonb;
alter table questions add column if not exists negative_marking_value decimal default 0;
alter table questions add column if not exists section_references text[];
alter table questions add column if not exists note_id uuid references user_notes(id) on delete set null;
alter table questions add column if not exists block_id text;

-- Descriptive questions have no options/correct_option — relax NOT NULL.
alter table questions alter column option_a drop not null;
alter table questions alter column option_b drop not null;
alter table questions alter column option_c drop not null;
alter table questions alter column option_d drop not null;
alter table questions alter column correct_option drop not null;

-- correct_option's existing CHECK only fires when non-null, so no change
-- needed there. Add a shape-integrity constraint: mcq rows must carry all
-- 4 options + an answer; descriptive rows must carry marks + a model answer.
alter table questions drop constraint if exists questions_type_shape_check;
alter table questions add constraint questions_type_shape_check check (
  (question_type = 'mcq' and option_a is not null and option_b is not null
    and option_c is not null and option_d is not null and correct_option is not null)
  or
  (question_type = 'descriptive' and marks is not null and model_answer is not null)
);

create index if not exists idx_questions_note on questions(note_id);
create index if not exists idx_questions_paper on questions(paper);
create index if not exists idx_questions_type on questions(question_type);

-- ============================================================
-- EXTEND flashcards — add CA generation fields
-- ============================================================

alter table flashcards add column if not exists flashcard_type text
  check (flashcard_type in ('definition','section','formula','accounting_rule','standard','comparison'));
alter table flashcards add column if not exists paper text;
alter table flashcards add column if not exists section_reference text;
alter table flashcards add column if not exists note_id uuid references user_notes(id) on delete set null;
alter table flashcards add column if not exists block_id text;

create index if not exists idx_flashcards_note on flashcards(note_id);
create index if not exists idx_flashcards_paper on flashcards(paper);


-- ============================================================================
-- FILE 2/5: ca-practice-history-schema.sql
-- ============================================================================

-- Ties an MCQ session back to the upload it was practiced from (nullable —
-- NEET sessions and unscoped CA practice both leave this null).
alter table quiz_sessions add column if not exists note_id uuid references user_notes(id) on delete set null;
create index if not exists idx_quiz_sessions_note on quiz_sessions(note_id);

-- hooks/useCaPractice.ts logs to this same table for BOTH MCQ and
-- Descriptive practice — without this, History had no way to tell which
-- mode a session was and always displayed "MCQ". Null = a session logged
-- before this column existed, or a NEET row (MCQ-only, no other concept) —
-- the app treats null as "MCQ" for backward compatibility.
alter table quiz_sessions add column if not exists question_type text check (question_type in ('mcq','descriptive'));

-- Flashcard study sessions previously left no history at all — only the
-- cumulative per-card state in user_flashcard_progress (overwritten on
-- every review). This gives "when did I study this upload's flashcards,
-- and how did it go" a place to live.
-- CA-only by construction (check constraint below), not just by convention —
-- hooks/useFlashcards.ts is shared with NEET's flashcards page, so without
-- this the DB would silently start accepting NEET rows here too.
create table if not exists flashcard_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  exam text not null check (exam = 'CA'),
  subject text,
  note_id uuid references user_notes(id) on delete set null,
  total_cards integer default 0,
  recall_count integer default 0,
  review_count integer default 0,
  completed_at timestamptz default now()
);

-- A note's flashcards are generated per content block, each carrying its
-- own topic — a multi-block upload produces several distinct sections a
-- student studies (and retakes) independently, not one shuffled deck. This
-- lets attempt history be scoped per section instead of per whole note.
-- Null = a session logged before this column existed, or an unscoped one.
alter table flashcard_sessions add column if not exists topic text;

alter table flashcard_sessions enable row level security;

drop policy if exists "users_manage_own_flashcard_sessions" on flashcard_sessions;
create policy "users_manage_own_flashcard_sessions"
  on flashcard_sessions for all using (auth.uid() = user_id);

create index if not exists idx_flashcard_sessions_user on flashcard_sessions(user_id);
create index if not exists idx_flashcard_sessions_note on flashcard_sessions(note_id);
create index if not exists idx_flashcard_sessions_note_topic on flashcard_sessions(note_id, topic);


-- ============================================================================
-- FILE 3/5: ca-evaluation-teacher-mocktest-schema.sql
-- ============================================================================

-- ============================================================
-- QUESTION ATTEMPTS — descriptive answer submissions + AI evaluation
-- MCQ attempts stay on the existing user_progress/quiz_sessions path;
-- this only covers descriptive questions, which need the full evaluation
-- payload (marks, what was missed, presentation feedback, etc) kept.
-- ============================================================

create table if not exists question_attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  student_answer text not null,
  marks_awarded integer,
  marks_total integer,
  ai_evaluation jsonb,
  time_taken_seconds integer,
  attempted_at timestamptz default now()
);

alter table question_attempts enable row level security;

drop policy if exists "users_manage_own_question_attempts" on question_attempts;
create policy "users_manage_own_question_attempts"
  on question_attempts for all using (auth.uid() = user_id);

create index if not exists idx_question_attempts_user on question_attempts(user_id);
create index if not exists idx_question_attempts_question on question_attempts(question_id);

-- ============================================================
-- AI TEACHER SESSIONS
-- Rate limiting (max 1 msg/5s, max 10 msgs/60s) is derived from the
-- timestamps already stored in `messages` rather than a second usage
-- table, so no separate ai_teacher_usage table is created here.
-- ============================================================

create table if not exists ai_teacher_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  ca_level text,
  current_topic text,
  messages jsonb default '[]',
  messages_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ties a chat to the note it's grounded in, so each note gets one persistent,
-- resumable conversation (the AI Teacher's two-pane sidebar groups by this).
-- Null = the general, not-note-scoped chat. `alter ... add column if not
-- exists` rather than only the create-table shape above, since this table
-- may already exist from an earlier run of this file without the column.
alter table ai_teacher_sessions add column if not exists note_id uuid references user_notes(id) on delete set null;

alter table ai_teacher_sessions enable row level security;

drop policy if exists "users_manage_own_ai_sessions" on ai_teacher_sessions;
create policy "users_manage_own_ai_sessions"
  on ai_teacher_sessions for all using (auth.uid() = user_id);

create index if not exists idx_ai_sessions_user on ai_teacher_sessions(user_id);
create index if not exists idx_ai_sessions_note on ai_teacher_sessions(note_id);

-- ============================================================
-- MOCK TEST ATTEMPTS
-- Self-serve mixed-pattern sets assembled from the student's own
-- generated questions (see hooks/useCaMockTest.ts) — no ca_mock_tests
-- template table, since there is no admin-authored content to template.
-- ============================================================

create table if not exists ca_mock_test_attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  paper text not null,
  mcq_answers jsonb default '{}',
  descriptive_answers jsonb default '{}',
  mcq_score decimal default 0,
  descriptive_score decimal default 0,
  total_score decimal default 0,
  total_possible integer default 0,
  completed_at timestamptz default now()
);

alter table ca_mock_test_attempts enable row level security;

drop policy if exists "users_manage_own_mock_attempts" on ca_mock_test_attempts;
create policy "users_manage_own_mock_attempts"
  on ca_mock_test_attempts for all using (auth.uid() = user_id);

create index if not exists idx_mock_attempts_user on ca_mock_test_attempts(user_id);


-- ============================================================================
-- FILE 4/5: ca-test-papers-schema.sql
-- ============================================================================

-- CA Test: separate upload path for real past/mock exam papers, extracted
-- verbatim (no AI generation, no content-block mapping — the student picks
-- the paper at upload time since one uploaded file is virtually always one
-- paper). Deliberately its own bucket/table rather than reusing user_notes,
-- since the processing purpose is completely different from the notes
-- pipeline (verbatim transcription vs extraction + on-demand generation).

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
-- classification step, the paper code is chosen by the student at upload.
-- ============================================================

create table if not exists ca_test_papers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  paper text not null,
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


-- ============================================================================
-- FILE 5/5: ca-cheatsheets-schema.sql
-- ============================================================================

-- CA Cheatsheet: one editable, persistent condensed-reference document per
-- uploaded note (key definitions/formulas/section references), separate
-- from questions/flashcards/AI Teacher — a fourth thing a note produces.
-- One row per (user, note): editing overwrites content in place rather than
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
-- DONE. Verify: Table Editor should now show user_notes, processing_queue,
-- flashcard_sessions, question_attempts, ai_teacher_sessions,
-- ca_mock_test_attempts, ca_test_papers, ca_cheatsheets. Storage should show
-- ca-notes and ca-test-papers buckets.
-- ============================================================================
