-- Phase 3: descriptive-answer evaluation, AI Teacher, and self-serve mock
-- tests for the CA vertical. Run after ca-notes-pipeline-schema.sql and
-- ca-practice-history-schema.sql in Supabase SQL Editor. Safe to re-run.

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
