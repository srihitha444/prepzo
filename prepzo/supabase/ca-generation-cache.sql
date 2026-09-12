-- ============================================================================
-- CA PLATFORM — SHARED DERIVATION CACHE
-- ============================================================================
-- Every schema change for the caching feature, in one file. Paste the whole
-- thing into one Supabase SQL Editor query and run it once. Idempotent
-- (`create table if not exists` / `add column if not exists` / `drop policy
-- if exists` + recreate) — safe to re-run.
--
-- WHY THIS EXISTS
-- Students upload the same documents as each other — ICAI study material,
-- coaching handouts. Today each upload is derived from scratch: one Gemini
-- vision call to extract it, another to generate questions/flashcards, for
-- every student, every time, even when the file is byte-identical to one
-- already processed. This caches the derivation so the second student
-- onward reuses it.
--
-- WHAT IS CACHED, AND THE TWO LAYERS
--   1. ca_extraction_cache  — the content_map for a document at a level.
--   2. ca_generation_cache  — an accumulating POOL of generated questions
--                             or flashcards, per block, per mode.
--
-- Two layers because they have different shapes: extraction is one call
-- over the whole document, generation is per-block and open-ended in
-- quantity. The generation pool depends on the extraction cache for stable
-- block ids — block_id is a fresh randomUUID() per extraction run, so
-- without a shared content_map no two students' blocks would correspond.
--
-- THE POOL ACCUMULATES, NOTHING IS EVER DELETED
-- If student A generated 10 questions for a block and student B asks for
-- 20, B is served A's 10 and pays only for 10 more — which are appended, so
-- the pool now holds 20 and the next student asking for 20 pays nothing.
-- A later request for 5 is served from the same pool. Whoever pays to
-- deepen the pool deepens it for everyone, including retroactively.
--
-- WHY THERE IS NO USER-FACING RLS POLICY
-- Nothing in the app reads these tables as the student. On a cache hit the
-- server COPIES rows into the student's own questions/flashcards, so they
-- own their rows and their spaced-repetition progress, and the owner-scoped
-- read policy from ca-scope-questions-flashcards-by-owner.sql keeps working
-- untouched. RLS is enabled with a service-role policy only, so an
-- authenticated client cannot read the shared store directly.
--
-- RETENTION (DPDP Act 2023)
-- A cache entry is retained only while at least one live user still holds
-- that document. On account deletion the app checks whether any other
-- user_notes row still carries the same file_hash: if so the derivation
-- stays (other students legitimately depend on it), if not it is deleted
-- along with the departing user. That satisfies the erasure right without
-- destroying derivations in active use — and it is why file_hash is
-- carried on BOTH tables, so every row for a document can be found from
-- the hash alone. See app/api/account/delete/route.ts.
-- ============================================================================


-- ============================================================================
-- 1. FILE HASH ON user_notes
-- ============================================================================

-- sha256 of the uploaded file's bytes, computed in the browser before
-- upload (lib/ca/clientUpload.ts) — the cache key, and the join back from a
-- user's note to the shared derivation. Nullable: notes uploaded before
-- this feature have no hash and simply never hit the cache.
--
-- Note that in practice this only ever matches for PDFs. Photos and scans
-- of the same page differ byte-for-byte between students (different camera,
-- crop, and our own client-side image compression), so image uploads are
-- effectively always a cache miss. That is expected, not a defect — the
-- documents this feature exists for are downloaded PDFs.

alter table user_notes add column if not exists file_hash text;

create index if not exists idx_user_notes_file_hash on user_notes(file_hash);


-- ============================================================================
-- 2. EXTRACTION CACHE
-- ============================================================================

-- One row per (document, CA level). Level is part of the key because the
-- same document must map differently for Foundation vs Intermediate vs
-- Final — different papers exist at each level, and lib/ca/templates.ts
-- generates structurally different content from the same source depending
-- on level.
--
-- prompt_hash is a column, NOT part of the unique key, and that is
-- deliberate: when the extraction prompt changes, the entry is REFRESHED IN
-- PLACE (re-derived and overwritten) rather than a second row being added
-- or the old one deleted. Without it, the first extraction of a document
-- would be permanent — every future student would inherit it and no prompt
-- improvement would ever reach them, with the most popular documents
-- (cached earliest) the most stuck. See lib/ca/extractionCache.ts.

create table if not exists ca_extraction_cache (
  id uuid default gen_random_uuid() primary key,
  file_hash text not null,
  ca_level text not null,
  prompt_hash text not null,
  content_map jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (file_hash, ca_level)
);

alter table ca_extraction_cache enable row level security;

drop policy if exists "service_manage_extraction_cache" on ca_extraction_cache;
create policy "service_manage_extraction_cache"
  on ca_extraction_cache for all to service_role using (true);

create index if not exists idx_extraction_cache_hash on ca_extraction_cache(file_hash);


-- ============================================================================
-- 3. GENERATION CACHE
-- ============================================================================

-- One row per (block, mode), holding a growing JSON array of generated
-- items. block_id references a block inside a cached content_map, so this
-- table is only meaningful alongside ca_extraction_cache — when an
-- extraction entry is refreshed its blocks get new ids, and the pools keyed
-- to the old ids simply stop matching.
--
-- No foreign key to user_notes: the pool has to outlive the note (and the
-- account) that first paid for it, or the retention rule above could not
-- transfer a derivation from a departing user to a remaining one.
--
-- file_hash and ca_level are denormalised here purely so every cached row
-- for a document is reachable from the hash alone, which the deletion path
-- needs.

create table if not exists ca_generation_cache (
  id uuid default gen_random_uuid() primary key,
  file_hash text not null,
  ca_level text not null,
  block_id uuid not null,
  mode text not null check (mode in ('questions','flashcards')),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (block_id, mode)
);

alter table ca_generation_cache enable row level security;

drop policy if exists "service_manage_generation_cache" on ca_generation_cache;
create policy "service_manage_generation_cache"
  on ca_generation_cache for all to service_role using (true);

create index if not exists idx_generation_cache_hash on ca_generation_cache(file_hash);
create index if not exists idx_generation_cache_block on ca_generation_cache(block_id, mode);
