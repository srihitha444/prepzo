-- CA Cheatsheet: one editable, persistent condensed-reference document per
-- uploaded note (key definitions/formulas/section references), separate
-- from questions/flashcards/AI Teacher — a fourth thing a note produces.
-- One row per (user, note): editing overwrites content in place rather than
-- creating versions, and "Regenerate" is the same upsert path as first-time
-- generation. Run after ca-notes-pipeline-schema.sql. Safe to re-run.

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
