-- CA Case-Study Questions: links questions (verbatim-extracted from a real
-- paper, or generated from notes) that share a single case/scenario passage
-- (e.g. ICAI Final Paper 6, Integrated Business Solutions, whose Case Study
-- MCQs/descriptive questions all read off one shared case; also used for
-- intermediate-mixed/final-mixed scenario MCQs generated from notes) so the
-- passage is stored once and shown once, instead of being duplicated into
-- every sub-question's question_text (with wording drift between copies) or
-- lost entirely. See lib/ca/extractTestPaper.ts and lib/ca/generateContent.ts
-- — the passage text and group id are computed once per case-study group in
-- code, never re-derived per question, so they can't drift between a
-- group's sub-questions. Both columns are null for a normal standalone
-- question. Run after ca-test-papers-schema.sql. Safe to re-run.

alter table questions add column if not exists case_study_passage text;
alter table questions add column if not exists case_study_group_id uuid;

create index if not exists idx_questions_case_study_group on questions(case_study_group_id);
