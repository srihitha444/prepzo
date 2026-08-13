-- CA practice sessions (hooks/useCaPractice.ts) log to the same quiz_sessions
-- table for both MCQ and Descriptive practice — there was no column to tell
-- which mode a session was, so History always displayed "MCQ" even for
-- Descriptive sessions. Nullable, no default: existing rows (NEET, which is
-- MCQ-only and has no other concept, and any pre-existing CA rows) stay
-- null and the app treats null as "MCQ" for backward compatibility — only
-- new Descriptive CA sessions get tagged going forward.
-- Run this once in Supabase SQL Editor. Safe to re-run. Also folded into
-- ca-all-pending-migrations.sql.

alter table quiz_sessions add column if not exists question_type text check (question_type in ('mcq','descriptive'));
