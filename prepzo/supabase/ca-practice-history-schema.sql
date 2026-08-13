-- Note-scoped practice/flashcard retake + attempt history for the CA
-- vertical. Run after ca-notes-pipeline-schema.sql in Supabase SQL Editor.
-- Safe to re-run.

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
