-- New migration: section-level flashcard study (topic on flashcard_sessions).
-- Run this once in Supabase SQL Editor. Safe to re-run. Also folded into
-- ca-practice-history-schema.sql and ca-all-pending-migrations.sql, so if
-- you're re-running the combined file anyway you don't need this one too —
-- it's here as a standalone, easy-to-find delta if you've already applied
-- everything up through ca-practice-history-schema.sql previously.

alter table flashcard_sessions add column if not exists topic text;
create index if not exists idx_flashcard_sessions_note_topic on flashcard_sessions(note_id, topic);
