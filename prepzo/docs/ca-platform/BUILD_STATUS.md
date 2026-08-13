# CA Platform — Build Status & Session Context

Read this before picking up CA vertical work in a new session. It captures what's been built, why it deviates from `01_EXAM_PATTERNS.md`–`10_GOOGLE_CLOUD.md` (the original spec docs in this same folder), what's still pending, and where the bodies are buried.

**User:** Srihitha (itssrihitha555@gmail.com). Communicate results directly — she tests locally and reports back with exact error text, which has been the fastest path to root-causing bugs so far. Keep answering "which SQL do I need to run" precisely and in order when asked; it comes up often.

---

## 1. What this is

Prepzo is a live NEET exam-prep platform. This session added a full second vertical — CA (Chartered Accountancy) exam prep — reusing the same Next.js app, same Supabase project, same `profiles`/`questions`/`flashcards`/`quiz_sessions` tables (discriminated by an `exam` column), rather than building CA as a separate product. `docs/ca-platform/*.md` (01–10) is the original design spec, written as if CA were a greenfield product with its own schema/GCS/Vertex AI. It doesn't match reality — every phase below reconciles the spec's intent onto the app's actual architecture, with the deviation explicitly called out.

**Routing:** `proxy.ts` rewrites requests to `/ca/*` transparently based on hostname (`ca.prepzo.study`) or a `?preview=ca` cookie. This is why CA nav links use unprefixed paths (`/practice`, `/notes`, etc.) — mirroring the existing `CaSidebar`/`CaBottomNav` convention — while `redirect()` calls in CA pages use explicit `/ca/...` paths (e.g. `/ca/auth/login`, `/ca/onboarding`), since those are real filesystem routes and need to resolve correctly regardless of host state.

---

## 2. Key architecture decisions (deviations from the spec, and why)

1. **Shared schema, not forked.** Added nullable CA-only columns to `questions`/`flashcards`/`quiz_sessions` instead of the spec's parallel `generated_questions`/`user_flashcards` tables. Keeps NEET's spaced-repetition code (`lib/questions.ts`, `hooks/useFlashcards.ts`) working for both exams.
2. **Supabase Storage, not GCS.** New `ca-notes` bucket, same pattern as the existing `pyq-assets` bucket.
3. **Gemini API key (Google AI Studio), not Vertex AI service account.** One env var: `GEMINI_API_KEY`. No `GOOGLE_CLOUD_*` vars, no Document AI.
4. **No Document AI OCR pass.** PDFs/images go to Gemini directly as inline data — its native multimodal understanding covers typed PDFs and images without a rasterization step.
5. **Model: `gemini-flash-latest`, not `gemini-2.5-flash`.** Confirmed live against the user's actual key: `gemini-2.5-flash` 404s ("no longer available to new users"); `gemini-flash-latest` works and currently resolves to Gemini 3.6 Flash under the hood. Set in `lib/gemini.ts`. If Gemini calls ever start failing with a 404 again, check this first — it's a rolling alias, not pinned.
6. **Serverless-safe background processing.** Production is Vercel (confirmed via `vercel.json`, region `bom1`), not a long-lived container. Note processing runs via Next.js `after()` in the upload route, not fire-and-forget `setTimeout`.
7. **PDF page counting: `pdf-lib`, not `pdf-parse`.** `pdf-parse` v2 wraps `pdfjs-dist`, which tries to spin up a worker thread — this doesn't bundle correctly under Next.js/Turbopack ("Setting up fake worker failed: Cannot find module '.../pdf.worker.mjs'"), and broke on **every** real PDF through the actual server (a plain Node script test passed, which is what made this confusing to diagnose). `pdf-lib` has no worker/canvas dependency.
8. **Generation is on-demand, not automatic.** Originally, uploading a note auto-generated both questions and flashcards immediately. Changed per explicit request: upload now only extracts + maps content; the student then clicks "Create Practice Session" or "Generate Flashcards" independently, each triggering its own scoped Gemini call. See `app/api/ca/notes/generate/route.ts`.
9. **Mock tests are self-serve, not admin-curated.** The spec's `ca_mock_tests` implies a content team authors fixed papers ahead of time — no such tooling or content exists or is coming (confirmed with user). Built instead: a self-paced mixed-pattern set assembled from the student's *own* generated questions, matching the paper's real MCQ/descriptive ratio but not a timed/fixed-quantity exam simulation.
10. **AI Teacher is English-only** (not the spec's Hinglish) — user's explicit call, made after testing.

---

## 3. What's built, by phase

**Phase 1 — Notes pipeline:** Upload → Gemini extraction/paper-mapping → `content_map` on `user_notes`. Confidence-gated (≥85% auto, 40–85% needs student confirmation via `POST /api/ca/notes/confirm-mapping`, <40% unidentified).

**Phase 2 — Practice + Flashcards, real data:** `useCaPractice` (new, NOT a reuse of NEET's `useQuiz` — that hook hardcodes 1/3 negative marking, PYQ logic, and a cross-exam-leaky daily limit that doesn't fit CA). `useFlashcards` extended in place (shared with NEET) with a `noteId` filter and session logging. Added `flashcard_sessions` table (flashcards previously had zero session history, only cumulative per-card state) — **CA-only by a DB `check` constraint**, not just app-code convention, because the hook is shared with NEET's flashcards page.

**Phase 3 — Descriptive evaluation, AI Teacher, Mock Tests:**
- Descriptive answers graded via Gemini (`lib/ca/evaluateAnswer.ts`), stored in new `question_attempts` table, still feed into the same spaced-repetition system as MCQs (`recordAnswer`, extended to accept a server-side Supabase client).
- AI Teacher: three-layer guardrails (`lib/ca/aiTeacher.ts` — topic classifier, prompt-injection detector, output filter), rate-limited (1 msg/5s, 10/60s, checked against the user's *most recent* session so starting a new session can't reset the limit), stored in `ai_teacher_sessions`.
- **AI Teacher is grounded in the student's own uploaded notes** (`lib/ca/tutorContext.ts::fetchNoteContext`) — pulls raw `content_map` block text (not the generated Q&A) into every prompt. Defaults to all of the student's notes; a per-note "Ask AI Teacher" button (on `NotesPanel`) scopes it to just that upload via `?note=`.
- Mock tests: `hooks/useCaMockTest.ts`, `components/ca/MockTestRunner.tsx`, new `ca_mock_test_attempts` table, new nav entry.

**Post-phase-3 fixes (all shipped, see §5 for what's still unverified live):**
- Gemini 503 ("high demand") handling: `lib/gemini.ts::generateWithRetry()` wraps every Gemini call (2 retries, short backoff), used everywhere; friendlier user-facing messages when retries are exhausted.
- Deferred generation (item 8 above).
- Markdown rendering in `TutorChat.tsx` (was showing raw `**bold**`/`### headers` — added `react-markdown`).

**Phase 4 — AI Teacher two-pane UI:** Rebuilt from a single chat pane into a Claude/ChatGPT-style layout — `TutorSidebar.tsx` lists chats (pinned "General" + one row per note, named after the note), `TutorWorkspace.tsx` owns which one is active and keys `TutorChat` on it so switching forces a clean remount. Each note now gets one **persistent, resumable** session instead of a fresh one per visit (`ai_teacher_sessions.note_id`, resume-by-note lookup in `tutor/message/route.ts` before falling back to insert). Evaluated a text-search/cache layer for repeated questions and **deliberately did not build it** — Gemini Flash calls are cheap enough that the engineering cost of reliable "same question" detection wouldn't pay for itself, and a cached answer risks being wrong for a different conversation context.

**Phase 5 — Real past/mock paper upload ("Mock Test" → separate verbatim pipeline):** Students can now upload an actual past/mock exam paper PDF and get the *real* questions transcribed **verbatim** — no AI generation, no content-block splitting, no confidence-gated mapping (the student picks the paper at upload since one file is virtually always one paper). Deliberately a separate table/bucket/extraction function from the Notes pipeline (`ca_test_papers`, `ca-test-papers` bucket, `lib/ca/extractTestPaper.ts`, `lib/ca/processTestPaper.ts`) rather than folding it into `user_notes` — see `ca-test-papers-schema.sql`'s header for the reasoning. `useCaMockTest`/`MockTestRunner`/`TestRunner` are shared between the notes-derived "Practice Set" and the real-paper "Your Real Papers" modes via an optional `testPaperId` — same UI, different data source, not two parallel runners. **Nav placement note:** the upload lives *inside* the Mock Test page (`TestPapersPanel.tsx`, a section of `MockTestRunner.tsx`), not a new top-level nav item — Mock Test already had its own nav slot.

**Phase 6 — CA Settings + real account management:** `app/ca/(app)/settings/page.tsx` (reachable via the profile dropdown in `CaSidebar`, not a top-level nav tab) — NEET-style sidebar-nav-with-sections layout (`CaSettingsShell.tsx`): "Account & Profile" (`CaAccountSection.tsx` — name, password reset, **real** email change, **real** account deletion), "Study Profile" (`CaSettingsForm.tsx` — edit `ca_level`/`ca_groups`/`ca_papers`/target date after onboarding, previously locked in forever), "Help & Support" (`CaHelpSection.tsx` — privacy/terms/contact links). Delete Account and Change Email were **fake** on both the pre-existing NEET settings page and the first pass of CA settings (toast-only, no actual effect) — both are now real, shared between verticals via `app/api/account/delete/route.ts` (one route, no exam branching — see §4 for how the cascade works).

---

## 4. Bugs found and fixed this session (worth knowing about, not just "done")

- **Onboarding gate too loose, on 7 files.** Every CA page checked `!profile?.exam` (any exam set) instead of `profile.exam === "CA" && profile.ca_level` — a NEET-onboarded account (or one that started but never finished CA onboarding) could reach `/notes` and upload, only failing deep inside background processing with a confusing "Student has not completed CA onboarding yet" error. Fixed in `app/ca/(app)/layout.tsx` + all 6 page-level redirects, and corrected the redirect target from the generic `/onboarding` (NEET's form) to `/ca/onboarding`.
- **`processing_queue` RLS violation on upload.** That table's RLS only grants users `SELECT` (by design — it's meant to be service-managed); the upload route was inserting the initial row with the user-scoped client. Fixed by using `createServiceClient()` for that one insert.
- **Cross-exam data leakage audit** (prompted by "will NEET and CA disturb each other"). Found and fixed unfiltered `user_progress`/`user_flashcard_progress`/`quiz_sessions` reads in `app/(app)/dashboard/page.tsx`, `app/(app)/decks/page.tsx`, `app/(app)/flashcards/page.tsx`, `hooks/useProgress.ts`, `lib/questions.ts::getTodayQuestionCount` — all pre-existing NEET code, dormant until CA started writing real rows to the same shared tables. Confirmed via the audit: every write path was already correctly exam-tagged; the gaps were all on reads.
- **`proxy.ts` sent logged-out CA visitors to NEET's login page.** The unauthenticated redirect only checked whether the *raw incoming pathname* already started with `/ca/` to decide which login page to send someone to — but a real visitor on `ca.prepzo.study` never has that prefix (the `/ca` rewrite happens later, only for requests that pass this check). So every logged-out hit on the real CA domain — confirmed live via `curl -H "Host: ca.localhost"` against the dev server — landed on `/auth/login` instead of `/ca/auth/login`. Fixed by resolving the vertical (`resolveVertical()`) *before* the auth check, not after.
- **Verbatim extraction (`extractTestPaperQuestions`) was silently dropping valid content.** Two rounds: (1) MCQs with no discoverable answer key were dropped entirely rather than kept-but-ungraded — real past papers are very often question-paper-only with no bundled answer key, so this alone could zero out an entire upload. (2) Same bug for descriptive questions with no visible marks value (a scan can obscure a small printed number as easily as an answer key). Both relaxed — `questions_type_shape_check` now allows `correct_option`/`marks`/`model_answer` null for `test_paper_id`-sourced rows (`ca-test-papers-relax-marks.sql`), and `useCaMockTest.ts` treats those as **ungraded**: answerable, but excluded from both the score numerator and denominator (a separate follow-up bug — the first fix excluded ungraded descriptive marks from the denominator but not the numerator, so a result could read e.g. "17/10").
- **Extraction prompts had no instruction for tables or multi-part sub-questions.** Both `lib/ca/extraction.ts`/`generateContent.ts` (notes-derived) and `lib/ca/extractTestPaper.ts` (verbatim) now explicitly require real markdown tables (header row + `|---|---|` separator, one data row per line) for balance sheets/ledgers, and one line per `(i)/(ii)/(iii)`-style sub-part — both were previously flattening into unreadable single-line prose. The rendering side needed a matching fix: question text was shown as plain `<p>` everywhere, so even correctly-formatted markdown wouldn't have displayed as a table — added `components/ca/QuestionText.tsx` (`react-markdown` + `remark-gfm`) and wired it into both `MockTestRunner.tsx` and `PracticeExplorer.tsx`. Fixes only apply to newly-extracted content — already-uploaded papers need a re-upload.
- **AI Teacher's output filter was blocking correct answers.** `filterOutput()` re-scanned the AI's *response* using the same keyword list used to classify a student's incoming *question* as off-topic — but that list includes ordinary CA vocabulary ("buy shares", "investment advice", "stock market tips" — exactly what a correct Financial Management answer says). Any legitimately correct answer touching investments got discarded and replaced with a generic failure message. Fixed by giving the output filter its own much smaller list (just prompt-leak signals like "non-negotiable", "your role:") instead of reusing the input classifier.
- **Answer-key-less descriptive/MCQ carry-over bug in the Mock Test answer box.** `DescriptiveAnswerForm` kept its React state across "Next question" navigation (no `key` prop tied to the question), so a student's typed answer for question 2 would still be sitting in the textarea for question 3. Fixed with `key={question.id}` to force a remount per question, in both `MockTestRunner.tsx` and `PracticeExplorer.tsx`.
- **`/api/ca/questions/evaluate` hard-required `model_answer`.** Rejected any descriptive question with "This question is not a descriptive question" — a misleading message — whenever `model_answer` was null, even though that's now a legitimate state for a verbatim test-paper question (see above). The AI grader already tolerates a missing model answer/marks (grades off its own subject knowledge); the route just needed to stop blocking on it.
- **Notes generate route couldn't ever pick up newly-confirmed blocks.** Once a note's `questions_count`/`flashcards_count` went above 0, `NotesPanel.tsx`'s generate button permanently became a plain link with no way back — so a block confirmed *after* the first "Create Practice Session"/"Generate Flashcards" click could never be generated for. Fixed in `app/api/ca/notes/generate/route.ts`: it now checks which `block_id`s already have generated rows and only processes new ones (safe to call repeatedly, no duplicate content), and `NotesPanel.tsx` shows a small "generate more" refresh icon alongside the link once content exists.
- **`quiz_sessions` couldn't distinguish MCQ from Descriptive practice.** `hooks/useCaPractice.ts` logs both modes to the same table with no column recording which — History always displayed "MCQ" even for Descriptive sessions. Added `quiz_sessions.question_type` (nullable — old rows and NEET rows, which are MCQ-only, stay null and are treated as MCQ).
- **CA Dashboard had no way to discover Mock Test.** The 5 quick-action tiles (Upload, Practice, Flashcards, AI Teacher, History) never included it despite it being one of the largest feature areas. Added a 6th tile.

---

## 5. Database migrations — exact list, exact order

This gets asked repeatedly — answer precisely. **Convention for any future schema change: always add it as a new standalone file (`ca-<short-name>.sql`), not just an in-place edit to an already-existing file** — the user runs migrations by pasting one file at a time into the Supabase SQL Editor and wants a clear, discrete thing to run each time. Still also fold the same statement into the source `ca-*-schema.sql` file it thematically belongs to AND into the combined file below, for anyone re-running from scratch — the standalone file is the primary deliverable, the other two are kept in sync as a courtesy.

**Presumed already applied** (CA onboarding already works, which requires these):
1. `supabase/schema.sql` (or `supabase/sql-editor-setup.sql` — a consolidated alternative; whichever was actually used originally, not both)
2. `supabase/add-ca-exam-support.sql`
3. `supabase/update-ca-paper-taxonomy.sql`

**Must be run for anything built this session to work.** Easiest path: **`supabase/ca-all-pending-migrations.sql`** is the exact concatenation of the 4 core files below (in required order) *plus* every standalone delta folded in — ready to paste into one SQL Editor query. Use that instead of running files separately unless you need to debug one in isolation:

4. `supabase/ca-notes-pipeline-schema.sql` — `user_notes`, `processing_queue`, `ca-notes` storage bucket, extends `questions`/`flashcards` with CA columns
5. `supabase/ca-practice-history-schema.sql` — `quiz_sessions.note_id` + `question_type`, `flashcard_sessions` (CA-only via check constraint, incl. `topic`) — see standalone deltas below for the two later additions
6. `supabase/ca-evaluation-teacher-mocktest-schema.sql` — `question_attempts`, `ai_teacher_sessions` (incl. `note_id`, added for the two-pane AI Teacher sidebar — one persistent chat per note), `ca_mock_test_attempts`
7. `supabase/ca-test-papers-schema.sql` — `ca_test_papers`, `ca-test-papers` storage bucket, extends `processing_queue`/`questions`/`ca_mock_test_attempts` with `test_paper_id`, relaxes `questions_type_shape_check` for verbatim rows (see next item — this file already has the fully-relaxed version, the standalone delta below is only needed if you ran this file before the second relaxation round)

**Standalone deltas** (each is also folded into the file above it thematically belongs to, and into the combined file — these exist as single-purpose files you can run on their own if you already ran everything through a certain point and just need to catch up):
- `supabase/ca-flashcard-sections.sql` — `flashcard_sessions.topic` (belongs with #5)
- `supabase/ca-test-papers-relax-marks.sql` — relaxes `questions_type_shape_check` further so a verbatim **descriptive** question with no visible marks value doesn't get dropped either (belongs with #7; the first relaxation in #7 only covered MCQ `correct_option`)
- `supabase/ca-quiz-sessions-question-type.sql` — `quiz_sessions.question_type`, so History can tell MCQ practice from Descriptive practice (belongs with #5)

To check whether 4–7 have been run: Table Editor → look for `user_notes`; Storage → look for a `ca-notes` bucket. If either's missing, run `ca-all-pending-migrations.sql`. If `user_notes` already exists but `ai_teacher_sessions`/`flashcard_sessions`/`questions` predate their newer columns (`note_id`, `topic`, `test_paper_id`), re-running the relevant file (or the combined file, or the standalone `ca-flashcard-sections.sql`) is still safe — the column adds are `if not exists`.

If any of 4–7 changes in a future session, `ca-all-pending-migrations.sql` must be regenerated to match — it's a snapshot, not a live include.

All migration files are idempotent (`if not exists` / `drop policy if exists` + recreate) — safe to re-run.

---

## 6. Environment

`prepzo/.env.local` needs `GEMINI_API_KEY` (Google AI Studio key). User has added one — confirmed live-working against the actual `generateContent` endpoint (tested via curl during this session, including JSON mode). Also needs adding to Vercel's project env vars for production (not yet confirmed done).

No other new env vars — deliberately avoided the spec's `GOOGLE_CLOUD_PROJECT_ID`/`GOOGLE_CLOUD_PRIVATE_KEY`/`GCS_*`/`DOCUMENT_AI_PROCESSOR_ID` (see §2.2–2.4).

---

## 7. What's been verified live vs still open

Everything compiles clean (`tsc`, `eslint`, `npm run build` all pass as of end of session, re-checked after every change). Beyond that static check, the user has been testing locally against a running dev server and reporting exact error text/screenshots — that loop is how essentially every bug in §4 was actually found (not from reasoning about the code alone), and it's the most effective way to keep debugging this: ask for the exact error/screenshot before proposing a fix, don't guess from symptoms.

**Confirmed working live** (real testing, not just compiling): notes upload → extraction → on-demand question/flashcard generation; a real scanned past-paper upload → verbatim extraction → Mock Test attempt against it, including hitting and fixing the "0 questions extracted" failure mode twice (answer-key-less MCQs, then marks-less descriptive questions); descriptive answer grading through the Mock Test flow.

**Still open / worth re-confirming after this session's later fixes**, since they landed after the live-testing loop moved on to other things:
- Re-upload of a paper with a table/multi-part-sub-question layout, to confirm the markdown table + `(i)/(ii)/(iii)` line-break prompt fixes actually produce a readable result now (the paper tested against these bugs hasn't been re-uploaded since).
- AI Teacher conversation quality on a Financial Management / investment-related question, to confirm the output-filter fix actually stopped the false-positive blocking (found via code audit, not yet reproduced live before or after the fix).
- Confirm-mapping flow for low-confidence blocks, and the new "generate more" flow for blocks confirmed after an initial generation.
- History's Descriptive-vs-MCQ session labeling and the Dashboard's new Mock Test tile — both simple enough not to expect issues, but not yet clicked through by the user.
- Change Email / Delete Account on a real (ideally disposable) account — the code path is confirmed correct (RLS policies checked, FK cascade chain traced through `schema.sql`), but neither has been exercised against a real account in either vertical yet.

---

## 8. File map

```
lib/gemini.ts                          Gemini client singleton, generateWithRetry(), model = "gemini-flash-latest"
lib/ca-syllabus.ts                     CA_SYLLABUS data (papers/levels/groups), getPaperByCode, getPapersForLevel
lib/ca/
  extraction.ts                        Gemini extraction + paper-mapping -> ContentMap/ContentBlock
  templates.ts                         Question/flashcard generation rules per format-class (not per-paper)
  generateContent.ts                   generateForBlocks({mode: "questions"|"flashcards"}) — on-demand generation
  processNote.ts                       Background orchestrator (extraction only, no auto-generation)
  extractTestPaper.ts                  Verbatim question transcription from a real uploaded paper — NOT generation;
                                        the paper/subject is already known (student picked it at upload), so this
                                        just transcribes exactly what's on the page. Separate from extraction.ts +
                                        generateContent.ts on purpose (see ca-test-papers-schema.sql header).
  processTestPaper.ts                  Background orchestrator for test papers (transcribe -> insert questions, no
                                        content_map, no on-demand generation step — mirrors processNote.ts's shape)
  evaluateAnswer.ts                    Descriptive answer grading prompt + Gemini call
  aiTeacher.ts                         Topic classifier, injection detector, output filter, system prompt
  tutorContext.ts                      fetchNoteContext() — pulls uploaded note content for AI Teacher grounding

app/api/ca/
  notes/upload/route.ts                POST — validate, store, insert user_notes+processing_queue, trigger processNote via after()
  notes/confirm-mapping/route.ts       POST — student confirms/skips a low-confidence block (no generation)
  notes/generate/route.ts              POST — on-demand question/flashcard generation, note_id + mode
  test-papers/upload/route.ts          POST — validate, store, insert ca_test_papers+processing_queue (paper code
                                        chosen by student, required), trigger processTestPaper via after()
  questions/evaluate/route.ts          POST — descriptive answer grading
  tutor/message/route.ts               POST — AI Teacher chat turn

app/api/account/delete/route.ts        POST — shared NEET+CA (no exam branching). Deletes storage files under the
                                        user's ID in ca-notes/ca-test-papers, then auth.admin.deleteUser() — cascades
                                        through every table via profiles(id) references auth.users(id) on delete
                                        cascade, and every user-owned table references profiles(id) on delete cascade.

app/ca/(app)/                          dashboard, notes, practice, flashcards, mock-test, tutor, history, settings pages
  layout.tsx                           Auth + CA-onboarding gate for the whole route group

hooks/
  useCaNotes.ts                        Notes list/upload/confirm/generate, polling
  useCaPractice.ts                     CA MCQ+descriptive practice (NOT shared with NEET's useQuiz)
  useCaMockTest.ts                     Mixed-pattern question set assembly + scoring; accepts an optional testPaperId
                                        to instead pull ALL questions for that specific uploaded real paper (no pool
                                        cap, original order) — same hook, same TestRunner UI, different data source
  useCaTestPapers.ts                   Real-paper uploads list/upload, polling (mirrors useCaNotes.ts, no confirm/
                                        generate step — nothing to confirm or generate on demand for a verbatim paper)
  useAiTeacherChat.ts                  Single chat's messages + send, note-scoped or general, onSessionCreated callback
  useAiTeacherSessions.ts              Lists a user's chats (id/noteId/title/topic/updatedAt) for the sidebar

components/ca/
  TutorWorkspace.tsx                   Two-pane shell: owns activeNoteId, keys TutorChat to force remount on switch
  TutorSidebar.tsx                     Chat list — pinned "General" + one row per note-scoped session
  NotesPanel.tsx, NotesUploadZone.tsx  Upload UI, per-note action buttons (generate/practice/flashcards/tutor)
  PracticeExplorer.tsx                 MCQ + descriptive practice UI (exports DescriptiveAnswerForm, EvaluationResult — reused by MockTestRunner)
  CaFlashcardsPanel.tsx                Deck list (grouped by note, sortable) -> sections (grouped by block topic within
                                        a note). Each section has two actions, side by side: Study/Retake (StudySession
                                        — draws a fresh/due batch via useFlashcards) and, once there's been at least one
                                        session, Review & Recall (SectionReviewSession — browses/re-marks exactly the
                                        cards currently sitting in that section's Recall/Review decks, i.e. the live
                                        result of the student's last session(s) for that section, not a fixed replay).
                                        Attempt history is per-section, not per-note (flashcard_sessions.topic).
                                        NOTE: there is deliberately no separate "Recall & Review" nav item/page for CA
                                        — an earlier pass added app/ca/(app)/decks/page.tsx + a CaSidebar/CaBottomNav
                                        link pointing at the shared cross-subject DecksPanel (see below), which was the
                                        wrong shape for what was asked (review/recall belongs inline per-section,
                                        alongside Retake) and was removed.
  MockTestRunner.tsx                   Two sections: "Practice Set" (existing paper picker -> mixed AI-generated
                                        question set from notes, unchanged) and "Your Real Papers" (TestPapersPanel
                                        below). Both funnel into the same TestRunner, switched via an optional
                                        testPaperId — practice mode omits it (pool-sampled), real-paper mode sets it
                                        (fixed set, exact paper contents, no cap).
  TestPapersPanel.tsx                  Real-paper upload (paper-select + NotesUploadZone, reused as-is — it's already
                                        generic) + list with status/question-count/attempt-history, "Attempt" button
  TutorChat.tsx                        Chat UI, Markdown rendering, note-grounding banner
  ScoreTrendChart.tsx                  Real score-over-time chart (History page)
  QuestionText.tsx                     Markdown+GFM question-text renderer (react-markdown + remark-gfm, custom
                                        table/list styling) — used anywhere a question is shown (MockTestRunner,
                                        PracticeExplorer), since question_text can contain a real markdown table
  ResizableSplit.tsx                   IELTS-style draggable divider between two panels (question left, answer right)
                                        — Mock Test only, deliberately NOT applied to PracticeExplorer (asked for,
                                        then explicitly reverted there — regular Practice keeps its original single-
                                        column layout). Panels size to content with a max-height/scroll cap, not a
                                        forced fixed height — that was tried first and left a wall of empty space
                                        under short questions.
  CaSettingsShell.tsx                  NEET-style settings layout: left nav (Account & Profile / Study Profile /
                                        Help & Support) + content panel, mirrors app/(app)/settings/page.tsx's shape
  CaSettingsForm.tsx                   "Study Profile" tab — edit ca_level/ca_groups/ca_papers/target date after
                                        onboarding (reuses components/profile/CaProfileFields.tsx + CaPaperSelector.tsx,
                                        the same pieces onboarding uses). Editing preserves already-cleared papers
                                        where still valid instead of resetting to "all selected" like onboarding does.
  CaAccountSection.tsx                 "Account & Profile" tab — name, password reset, real Change Email
                                        (supabase.auth.updateUser), real Delete Account (POST /api/account/delete)
  CaHelpSection.tsx                    "Help & Support" tab — Privacy Policy/Terms/Contact Support links

components/decks/DecksPanel.tsx        NEET-only. Recall/Review spaced-repetition browser (MCQ + flashcard, merged,
                                        exam-aware) at app/(app)/decks/page.tsx. Extracted from that page into a shared
                                        component this session, but nothing CA-side links to it — CA's equivalent is
                                        the per-section Review & Recall inside CaFlashcardsPanel above, not a page.

supabase/*.sql                         See §5 for exact list and order
```
