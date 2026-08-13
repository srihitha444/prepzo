-- CA notes upload -> Gemini extraction -> question/flashcard generation pipeline.
-- Run in Supabase SQL Editor after add-ca-exam-support.sql and
-- update-ca-paper-taxonomy.sql. Extends the existing shared `questions` and
-- `flashcards` tables (used by both NEET and CA) rather than forking them,
-- and adds two new CA-only tables for tracking uploads and their processing
-- status. Safe to re-run — every statement is idempotent.

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
