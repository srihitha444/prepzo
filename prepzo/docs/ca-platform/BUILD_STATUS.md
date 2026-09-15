# CA Platform — Build Status & Session Context

Read this before picking up CA vertical work in a new session. It captures what's been built, why it deviates from `01_EXAM_PATTERNS.md`–`10_GOOGLE_CLOUD.md` (the original spec docs in this same folder), what's still pending, and where the bodies are buried.

**User:** Srihitha (itssrihitha555@gmail.com). Communicate results directly — she tests locally and reports back with exact error text, which has been the fastest path to root-causing bugs so far. Keep answering "which SQL do I need to run" precisely and in order when asked; it comes up often.

---

## 1. What this is

Prepzo is a CA (Chartered Accountancy) exam-prep platform. **As of 2026-09-13 it is CA-only** — see §1a. It began as a second vertical bolted onto a live NEET platform, reusing the same Next.js app, same Supabase project, and the same `profiles`/`questions`/`flashcards`/`quiz_sessions` tables (discriminated by an `exam` column) rather than being built as a separate product. That shared-table decision outlived NEET and still shapes the schema, so most of the history below is still load-bearing. `docs/ca-platform/*.md` (01–10) is the original design spec, written as if CA were a greenfield product with its own schema/GCS/Vertex AI. It doesn't match reality — every phase below reconciles the spec's intent onto the app's actual architecture, with the deviation explicitly called out.

**Routing:** CA is the app root. Every route lives at its natural path (`/dashboard`, `/practice`, `/auth/login`) and `proxy.ts` does nothing but refresh the Supabase session and bounce logged-out visitors to `/auth/login`. It used to rewrite CA-host requests to `/ca/*`, which is why older entries below name `/ca/...` paths — those were filesystem paths a CA visitor never saw in the URL bar, and the promotion in §1a moved each one to the URL it already served.


---

## 1a. The CA-only conversion (2026-09-13)

NEET was deleted and CA promoted to the app root, in three commits on the `ca-only` branch. The state before any of it is tagged **`neet-v1`** — a runnable NEET app is `git checkout neet-v1` away, so nothing here needed a folder copy.

**No user-facing URL changed.** CA was served at `ca.prepzo.study` with `proxy.ts` rewriting every path to `/ca/<path>`, so `/dashboard` was already `/dashboard` to a CA visitor. Promotion moved the filesystem to match the URLs, so the Supabase redirect allowlist, the email templates and already-sent password-reset links all kept working untouched.

- **What was deleted:** 72 files — every route, component, hook, lib and asset reachable only from NEET. The list came from a transitive import closure over the CA entrypoints, not from filenames, which is why NEET-side code CA actually depends on survived: `lib/questions.ts`, `components/flashcard/FlashCard.tsx`, `components/auth/*`, `components/profile/Ca*`, `hooks/useFlashcards.ts`, `components/ui/{Card,Badge}`, and the `/auth/callback` + `/auth/confirm` routes. `/privacy-policy` and `/terms` stayed too (CA's landing page, help section and auth forms all link them) along with `components/content/TextDocumentPage.tsx` and their markdown. Three files were already dead in *both* verticals: `components/layout/CaHeader.tsx`, `components/ui/Button.tsx`, `hooks/useAuth.ts`.
- **What moved:** `app/ca/(app)/*` → `app/(app)/*`, `app/ca/auth/{login,signup,reset-password}` → `app/auth/*`, `app/ca/{page,not-found,onboarding}` → root. `app/ca/auth/{callback,confirm}/route.ts` were **deleted, not moved** — both were one-line re-exports of the root handlers that only existed so the CA-host rewrite could reach them (see the §6 entry on `/auth/confirm` 404ing, now moot).
- **What collapsed:** `resolveVertical`, `CA_HOSTS`, the `?preview=ca` cookie, the `/ca`-prefix normalisation and the rewrite are gone from `proxy.ts` (124 lines → 58). The `isCaVertical`/`isCaHost` host sniffing in the auth forms and callback/confirm routes is gone as well — every branch had collapsed to the same path. `window.location.origin` is still preferred over `NEXT_PUBLIC_APP_URL`: the PKCE verifier is stored per origin, which was never about verticals.
- **Also dropped:** the `razorpay`, `dotenv`, `ts-node` and `tsconfig-paths` dependencies and the `seed` npm script, all orphaned. `app/robots.ts`/`app/sitemap.ts` rewritten for CA.
- **One bug found and fixed in passing:** `/robots.txt` and `/sitemap.xml` matched `proxy.ts`'s matcher but were absent from `PUBLIC_PATHS`, so every crawler got a 307 to `/auth/login` and the files were never served. Pre-existing — the old public list didn't name them either. Found by curling the routes after the promotion rather than trusting the build output.

**The database was deliberately not touched.** `profiles`/`questions`/`flashcards`/`quiz_sessions` are shared tables with CA rows tagged `exam = 'CA'`; dropping the NEET tables would break CA. NEET's rows are simply left in place, and the `exam <> 'CA'` branch in the owner-scoping RLS policy (§4) stays correct whether or not NEET code exists.

**Verified:** `tsc --noEmit` clean, `eslint` clean (one pre-existing unused-import warning in `NotesPanel.tsx`), production build clean at 34 routes with no `/ca` prefix, and a curl pass over every route against `npm start` — public pages 200, every app route 307 to `/auth/login` with the redirect preserved, landing page serving `<title>Prepzo CA`.

**Still on the `ca-only` branch, not merged or pushed.** Merging to `main` is what would deploy this; `robots.ts`/`sitemap.ts`/`metadataBase` currently point at `ca.prepzo.study`, which needs revisiting if the root domain becomes canonical. GTM/GA container ids are still NEET's (`GTM-5L3NFL4Q`, `G-YBPPDL6TQD`).

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

**Phase 7 — Cheatsheet:** A fourth thing a note produces, alongside questions/flashcards/AI Teacher — a condensed, editable revision document generated per uploaded file (`lib/ca/generateCheatsheet.ts`, `ca_cheatsheets` table, one row per `(user_id, note_id)`), reachable both from a note's action row in Upload and its own top-level nav tab (`CheatsheetWorkspace.tsx`, mirrors the AI Teacher two-pane sidebar+editor shape). Editable inline (plain textarea, no rich-text editor — matches the rest of the app's editing surfaces), with a Preview toggle (`QuestionText.tsx`, react-markdown), Save, and a client-side PDF export (`lib/ca/exportCheatsheetPdf.ts`, `jspdf`) with a clickable Prepzo logo linking to prepzo.study. **A confirm-gated "Regenerate" button existed in the editor and was deliberately removed** — the only thing it could do to a cheatsheet the student had already edited was silently destroy those edits, and there's no versioning to recover them (one row per `(user_id, note_id)`, overwritten in place). `POST /api/ca/cheatsheets/generate` is still an upsert and is still the path `useCaNotes.ts::generateCheatsheet` uses for first-time generation from a note's action row in Upload; nothing in the UI calls it against a note that already has a cheatsheet.
**Content requirement (explicit ask, 2026-08-21):** the generation prompt must reliably surface — wherever the source note actually contains them — key definitions, formulas, section/standard/act references (including specific tax section codes: Income Tax Act, GST/CGST/SGST Act, Companies Act), and monetary/numeric thresholds (exemption limits, turnover/registration thresholds, deduction caps, rate slabs, due dates, penalty amounts), exact as printed and never invented. This is Taxation/Direct Tax/Indirect Tax/Corporate Law-paper-relevant content that a first-pass prompt (definitions/formulas/section references/must-remember points) could silently omit or flatten — worth spot-checking a regenerated Tax-paper cheatsheet against its source note if this ever comes up again.

**Phase 8 — Case-study/scenario passage support.** A shared case/scenario passage (e.g. ICAI Final Paper 6, Integrated Business Solutions) can now be linked to several MCQs/descriptive questions that all read off it, instead of every question being extracted or generated as a fully standalone item with no shared context. Applies to both `lib/ca/extractTestPaper.ts` (verbatim, real papers) and `lib/ca/generateContent.ts`/`templates.ts` (notes-derived generation, `intermediate-mixed`/`final-mixed` scenario MCQs only — Foundation has no scenario-MCQ format at all, so this never applies there). New `questions.case_study_passage`/`case_study_group_id` columns, both null for a standalone question. **Critical design point:** the passage text and group id are computed **once per group in application code** (`randomUUID()`), never left to the model to repeat per sub-question — this is what prevents wording drift between a group's questions, which was the actual risk this whole feature exists to close (a naive "ask the model to repeat the passage on every question" approach would let the copies diverge). UI: `MockTestRunner.tsx`/`PracticeExplorer.tsx` render the passage in its own card above the question whenever `case_study_passage` is set — note that verbatim-extracted questions aren't excluded from regular Practice mode (same `questions` table, filtered only by subject), so this had to be wired into *both* components, not just Mock Test.

**Phase 9 — Mock Test paper auto-detection.** The "Your Real Papers" upload dropdown (pick a paper before uploading) is gone — it was never real ground truth: the prompt told Gemini the whole document was that one paper, and every extracted row was hardcoded to it, so a document spanning more than one paper (or the student picking wrong) silently mislabeled everything. `lib/ca/extractTestPaper.ts` now (a) classifies each question's/case-study-group's paper independently against the full 16-paper CA syllabus list, and (b) first gates on whether the document is actually a real question paper at all — a notes/study-material upload gets rejected with a specific message pointing back to Upload, instead of silently extracting garbage. `ca_test_papers.paper` is nullable now, set after processing to whichever paper the majority of extracted questions belong to (`lib/ca/processTestPaper.ts::majorityPaper()`) — used for the row's display label and to tag `ca_mock_test_attempts`.

**Phase 10 — Pricing removed from the CA vertical.** CA has no paid tier: removed the landing page's pricing section (Free/Pro cards) and the Razorpay checkout flow entirely from `app/ca/page.tsx`, the "Pro Member/Free Plan" badge from `CaSidebar.tsx`, and the free-tier flashcard session-size cap CA was silently inheriting from the shared `useFlashcards` hook via `profile.plan` — `app/ca/(app)/flashcards/page.tsx` now always passes `plan="paid"` (matching the pattern `useCaPractice.ts` already used for MCQs) so CA is unconditionally unlimited, without touching NEET's actual paid-gating logic. NEET's pricing page and payment routes are untouched — this was a CA-only removal.

**Phase 11 — Auth reliability fixes.**
- **Onboarding redirect wasn't vertical-aware.** A brand-new user with no profile yet, completing sign-up/sign-in via Google OAuth, email/password login, or the signup form, was sent to `/onboarding` (NEET's form) unconditionally — even on the CA host. Fixed in all three places (`app/auth/callback/route.ts`, `LoginForm.tsx`, `SignupForm.tsx`) to check `isCaHost`/`isCaVertical`. Distinct from the Phase 4-era "onboarding gate too loose" bug in §4 — that one was about the *page-level* gate rejecting already-onboarded users; this one is about where a *never-onboarded* user's very first redirect sends them.
- **Show/hide password toggle** added to Login, Signup, and the new Reset Password form.
- **Forgot-password flow was entirely missing a destination.** Settings' "Update Password" button already called `resetPasswordForEmail` but with no `redirectTo` — the email led nowhere. Built the missing piece: a "Forgot password?" link on Login, a new `ResetPasswordForm.tsx` + `/auth/reset-password` (`/ca/auth/reset-password`) page.
- **That flow then hit a real PKCE cross-device bug**: routing the reset email through `/auth/callback`'s PKCE code exchange (the same path Google OAuth uses) requires completing the flow in the *same browser* that requested it — which breaks by design for an emailed link, routinely opened from a different device/browser than the one that requested it. Fixed per Supabase's documented pattern: new `app/auth/confirm/route.ts` using `token_hash` + `verifyOtp()` instead, which verifies server-side with no browser-stored secret needed. **This requires a manual, one-time change only the user can make**: the "Reset Password" email template in the Supabase Dashboard (Authentication → Email Templates) must be updated to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}` instead of the default `{{ .ConfirmationURL }}` — **not confirmed done as of this writing**. Without it, the code path is correct but unreachable; the reset email will keep using the old link shape.

- **`/auth/confirm` 404'd on the CA host** — found by smoke-testing the running dev server, not from the code. It was the only auth route with no `/ca` counterpart (`callback`/`login`/`signup`/`reset-password` all had one), and `proxy.ts` rewrites every CA-host path to `/ca/<path>` — so a reset link opened on `ca.prepzo.study` hit `/ca/auth/confirm` and 404'd, even though the handler itself already branches on `isCaHost` and was clearly written expecting to run there. Whether this actually broke the live flow depended entirely on the project's Supabase **Site URL** (one project-wide value): with `prepzo.study` the confirm hop happens on the NEET host and bounces to the absolute CA `redirectTo`, so it worked by luck; with the CA domain every reset link 404'd. Fixed with `app/ca/auth/confirm/route.ts`, a one-line `export { GET } from "@/app/auth/confirm/route"` mirroring `app/ca/auth/callback/route.ts` — so the flow is now correct regardless of which Site URL is configured. Verified on the CA host: no token → bounces to `/ca/auth/login` with "Missing or invalid confirmation link"; a bogus `token_hash` reaches Supabase and returns its real "Email link is invalid or has expired", confirming `verifyOtp()` actually runs.

**Phase 12 — Upload/processing reliability.** Several compounding fixes, in the order they were found:
- **Vercel's hard ~4.5MB serverless function request-body limit** (not configurable via Next.js — infrastructure-level, confirmed via Vercel's own docs) was silently breaking any Notes/Test Paper upload over that size, even though the app advertised 20MB — the platform's plain-text 413 response crashed on the client's unconditional `res.json()` call with a confusing raw `SyntaxError`. Fixed by uploading the file **directly from the browser to Supabase Storage** (new `lib/ca/clientUpload.ts`, using the existing owner-scoped storage RLS policies — no schema change needed), bypassing the function entirely for the file bytes; the upload routes now only ever receive small JSON metadata (`file_path`/`mime_type`/`page_count`) to register the row and trigger processing. `processNote.ts`/`processTestPaper.ts` were unaffected — they already download by `file_path`.
- **Background processing could hang or get silently killed** by Vercel's `maxDuration` cutoff with zero chance for the existing catch block (or anything else) to run, leaving a note/test-paper stuck on "Processing" forever with nothing ever recorded — first found via a real 5MB PDF that consistently timed out. New `lib/ca/processingTimeout.ts` races the actual Gemini extraction call against an app-level timeout (raised 45s → 165s across this fix's iterations) comfortably inside `maxDuration` (60 → 180, raised in lockstep), so the code gets a chance to record a specific reason before the platform would otherwise kill it outright. **Requires Vercel Fluid Compute to actually honor `maxDuration=180`** on a Hobby-plan project (default Hobby without it caps at 60s regardless of what's configured) — not confirmed enabled as of this writing; check Vercel → Project Settings → Functions.
- **Cancel**: a background job triggered via `after()` can't be reached and interrupted from a later, separate request, so "cancel" deletes the row/storage file instead (new `POST /api/ca/notes/cancel`, `/api/ca/test-papers/cancel`) — the still-running job cooperatively checks whether its row still exists (right before, and right after, the expensive Gemini call) before doing further work or writing results.
- **`ProcessingHint.tsx`**: live elapsed-time readout while queued/processing, switching past a threshold to a breakdown of specific likely causes as a real bulleted list (not one run-on sentence, per explicit feedback) plus the Cancel button — Mock Test's list explicitly calls out uploading notes by mistake and points back to Upload.
- **Raw Gemini SDK errors were leaking to the UI** from `processNote.ts`/`processTestPaper.ts` specifically — every *other* Gemini call site in the app (chat, cheatsheet/question generation, evaluation) already translates a 503/429 into a friendly "high demand" message via `isRetryableGeminiError`; these two background-processing files were the one place that had never gotten that treatment. Fixed, and extraction calls (`extraction.ts`/`extractTestPaper.ts`) now also use a more patient retry schedule (`PATIENT_RETRY_DELAYS_MS` in `lib/gemini.ts` — up to 4 retries over ~37s, vs. the default 2 over ~3s used everywhere else) since they now have a large time budget and aren't a synchronous request a student is staring at.
- **Client-side image compression** for JPG/PNG/WEBP uploads over 1.5MB (`compressImageIfWorthwhile` in `clientUpload.ts`, Canvas API, downscale >2600px + re-encode as JPEG q0.85, falls back to the original untouched if compression doesn't actually help) — genuinely speeds up processing for image-heavy uploads, not just tolerates slowness. PDF compression was explicitly scoped out (no solid lightweight browser-side library; the one viable path — render-to-image-then-rebuild via `pdfjs-dist` — was rejected as bigger/riskier and would degrade scanned text).
- **"This file could not be opened" was swallowing the real reason.** `countPdfPages()`'s catch block discarded the actual `pdf-lib` parse error entirely and always showed the same generic message, with no `console.error` either — impossible to diagnose a specific bad file. Now logs and surfaces the real error text, and `PDFDocument.load()` also gets `throwOnInvalidObject: false`, which tolerates the kind of slightly-non-standard PDF structure that scan/export tools routinely produce (opens fine in any real PDF viewer, but strict parsing rejected it outright).

Also fixed this stretch, smaller: **CA syllabus data errors** in `lib/ca-syllabus.ts`, verified against ICAI's current published scheme via web search — N3's name was truncated to "Advanced Auditing" (should be "Advanced Auditing, Assurance and Professional Ethics"), and N6 (Integrated Business Solutions)'s `objectivePercent` was wrongly hardcoded to 30 like every other paper, when it's actually 40 (open-book, 5 case studies pick 4 of 5, 40% MCQ/60% descriptive — structurally different from the other 30/70-split papers). Everything else (Foundation, all of Intermediate, rest of Final) checked out accurate.

---

**Phase 13 — Notes-extraction table quality + re-extract.** Three related changes, after auditing all four Gemini prompts against each other (`extraction.ts`, `extractTestPaper.ts`, `generateContent.ts`, `generateCheatsheet.ts`):
- **`extraction.ts`'s table instruction was the weakest of the four**, despite being the only one whose output is permanent — the other three read `content_map` out of Postgres and can be re-run freely, while extraction reads the file and writes `content_map` exactly once. Brought its table clause up to the same explicit spec the others use (header row + `|---|---|` separator + one data row per line), plus an explicit "never emit the cells as a plain list of values" — a flat list of values is a distinct failure mode from a run-on `|`-separated line, and none of the prompts previously forbade it. Deliberately kept in the existing bullet rather than restructured into a separate rules block, and the `(i)/(ii)/(iii)` sub-part rule the other prompts have was **not** added here — a scoped choice, not an oversight.
- **The defect is now detected, not just hoped against.** `findFlattenedTableBlocks()` in `extraction.ts` flags blocks the model itself labelled `table` that came back with no `|---` separator; `processNote.ts` logs one warning per affected note with the block topics. It deliberately does **not** downgrade the block to `needs_confirmation` — that status means "student, confirm which paper this maps to", and overloading it would put a formatting problem in front of a student as a mapping question. The same defect is queryable retroactively over existing notes, since `content_map` is stored jsonb: select blocks where `content_type = 'table'` and `raw_content` has no `|---`.
- **`POST /api/ca/notes/reextract`** re-runs `processNote()` over an already-uploaded note using the original file still in the `ca-notes` bucket. Before this, a prompt improvement could only ever help *new* uploads and the sole remedy for an existing note was delete + re-upload. Two hazards it has to handle: (1) re-extraction assigns fresh `block_id`s, and `notes/generate/route.ts` decides what to generate by diffing block_ids — so content generated from the old blocks can neither be matched nor replaced, and the next "Create Practice Session" would silently add a full duplicate set. The route therefore 409s with the counts unless called with `discard_generated: true`, and then **retires rather than deletes** (`is_active = false`, which every read path already filters on) so the spaced-repetition progress in `user_progress`/`user_flashcard_progress` survives and the change is reversible. (2) `processing_queue` has no unique constraint on `note_id`, so it reads the most recent row and updates it in place rather than inserting a second one, and 409s outright if a run is already `pending`/`processing` (two runs would race to write `content_map`). `content_map` is left untouched until the new extraction succeeds, so a failed re-extract leaves the note with its previous working map rather than nothing. **No UI yet** — the endpoint is callable but nothing in the app links to it.

**Phase 14 — Student-chosen generation + shared derivation cache.** Two features that landed together because the second depends on the first's block-level granularity.

**14a — the student picks topics and quantity.** Upload already only extracted (§2.8); now generation is scoped too. `GenerateSelector.tsx` shows "Found N topics" from `content_map.blocks`, the student ticks the ones they want and types how many items to produce, and only then is Gemini called. `notes/generate/route.ts` takes `block_ids[]` + `count`; both optional, so the old whole-note call still works. **`templates.ts` no longer fixes counts** — every `"Generate exactly 2 MCQs"` became a `count` parameter, split across the selected blocks by source length (`splitCountAcrossBlocks`, minimum one each). What deliberately stayed: mark bands, the 30/70 MCQ-descriptive split (`splitQuestionCount`), ILAC and journal-entry formats, and the shared case-study passage at Inter/Final — those encode the real ICAI paper shape, and only quantity was ever meant to be the platform's call.

**14b — topic expansion when the source runs dry.** A block's text supports only so many distinct questions; asking for 20 from a short block used to mean near-duplicates. `generateContent.ts` now instructs the model to exhaust the source first, then keep going from the block's *topic* using standard Indian CA knowledge at the student's level. **Guarded**, because this necessarily relaxes the "never invent section numbers" rule: expanded items must test concepts, application, classification and reasoning, and must **not** hinge on a specific threshold, exemption limit, rate, slab, due date or penalty amount unless that figure appeared in the source. Those change with each Finance Act and a stale figure actively teaches the student something false — structure is safe to draw from model knowledge, current-year numbers are not.

**14c — the shared derivation cache.** Students upload the same documents as each other (ICAI modules, coaching handouts) and every upload was re-derived from scratch. Now keyed on `sha256(file bytes)` computed in the browser (`clientUpload.ts`), stored as `user_notes.file_hash`. Two layers, because extraction and generation have different shapes:
- **`ca_extraction_cache`** — one `content_map` per `(file_hash, ca_level)`. A hit in `processNote.ts` skips the storage download *and* the Gemini vision call entirely. Level is in the key because the same document must map and generate differently at Foundation vs Intermediate vs Final.
- **`ca_generation_cache`** — an **append-only pool** per `(block_id, mode)`. If A generated 10 questions for a block and B asks for 20, B is served A's 10 and pays for 10 more, which are appended — so the pool holds 20 and the next student asking for 20 pays nothing, while a later request for 5 is served free. Whoever deepens the pool deepens it for everyone, retroactively. Pool items are **copied** into each student's own `questions`/`flashcards` rows, never shared as rows, so ownership and spaced-repetition progress stay per-student and the owner-scoped RLS from §5 needs no change. A student's existing row count for a block is the offset into the pool, which is what stops a repeat request handing them items they already hold.

**Two design points that are easy to get wrong later:**
- **Why the generation pool needs the extraction cache.** `block_id` is a fresh `randomUUID()` per extraction run, and Gemini won't split a document identically twice — so without a shared `content_map`, no two students' blocks would correspond and a per-block pool would have nothing stable to key on.
- **Prompt changes invalidate automatically, and nothing is ever deleted.** `EXTRACTION_PROMPT_HASH` hashes the static half of the extraction prompt (`EXTRACTION_RULES_HEAD`/`TAIL` in `extraction.ts`). A cached entry records the hash that produced it; if it no longer matches, the entry is treated as a miss and **overwritten in place** with a fresh derivation. Without this the first extraction of a document would be permanent — every later student would inherit it and no prompt improvement (the Phase 13 table fix, for instance) would ever reach them, with the most-uploaded documents the most stuck. It requires no manual step, which matters because the failure mode of forgetting one is silent.

**Retention — DPDP Act 2023.** A cached derivation is kept only while at least one live user still holds that document. `api/account/delete/route.ts` reads the departing user's `file_hash` values *before* deleting them (`user_notes` cascades away), then checks whether anyone else still has each hash: if so the derivation stays and effectively transfers to them; if not it is deleted with its only holder. That satisfies the erasure right without destroying derivations other students legitimately depend on, and it is what keeps a private document — handwritten notes, which nobody else will ever upload byte-identically — out of the shared store once its owner leaves.

**Known limits, by design:** only PDFs realistically hit the cache (photos and scans of the same page differ byte-for-byte between students, and our own image compression changes them further); an un-hashable upload silently never caches; `ca_test_papers` is excluded entirely from all of the above; and pool appends are read-modify-write, so two students generating for the same block in the same instant can duplicate a little work — never produce wrong content.

## 4. Bugs found and fixed this session (worth knowing about, not just "done")

- **Onboarding gate too loose, on 7 files.** Every CA page checked `!profile?.exam` (any exam set) instead of `profile.exam === "CA" && profile.ca_level` — a NEET-onboarded account (or one that started but never finished CA onboarding) could reach `/notes` and upload, only failing deep inside background processing with a confusing "Student has not completed CA onboarding yet" error. Fixed in `app/ca/(app)/layout.tsx` + all 6 page-level redirects, and corrected the redirect target from the generic `/onboarding` (NEET's form) to `/ca/onboarding`.
- **`processing_queue` RLS violation on upload.** That table's RLS only grants users `SELECT` (by design — it's meant to be service-managed); the upload route was inserting the initial row with the user-scoped client. Fixed by using `createServiceClient()` for that one insert.
- **Cross-exam data leakage audit** (prompted by "will NEET and CA disturb each other"). Found and fixed unfiltered `user_progress`/`user_flashcard_progress`/`quiz_sessions` reads in `app/(app)/dashboard/page.tsx`, `app/(app)/decks/page.tsx`, `app/(app)/flashcards/page.tsx`, `hooks/useProgress.ts`, `lib/questions.ts::getTodayQuestionCount` — all pre-existing NEET code, dormant until CA started writing real rows to the same shared tables. Confirmed via the audit: every write path was already correctly exam-tagged; the gaps were all on reads.
- **`proxy.ts` sent logged-out CA visitors to NEET's login page.** The unauthenticated redirect only checked whether the *raw incoming pathname* already started with `/ca/` to decide which login page to send someone to — but a real visitor on `ca.prepzo.study` never has that prefix (the `/ca` rewrite happens later, only for requests that pass this check). So every logged-out hit on the real CA domain — confirmed live via `curl -H "Host: ca.localhost"` against the dev server — landed on `/auth/login` instead of `/ca/auth/login`. Fixed by resolving the vertical (`resolveVertical()`) *before* the auth check, not after.
- **Verbatim extraction (`extractTestPaperQuestions`) was silently dropping valid content.** Two rounds: (1) MCQs with no discoverable answer key were dropped entirely rather than kept-but-ungraded — real past papers are very often question-paper-only with no bundled answer key, so this alone could zero out an entire upload. (2) Same bug for descriptive questions with no visible marks value (a scan can obscure a small printed number as easily as an answer key). Both relaxed — `questions_type_shape_check` now allows `correct_option`/`marks`/`model_answer` null for `test_paper_id`-sourced rows (`ca-test-papers-relax-marks.sql`), and `useCaMockTest.ts` treats those as **ungraded**: answerable, but excluded from both the score numerator and denominator (a separate follow-up bug — the first fix excluded ungraded descriptive marks from the denominator but not the numerator, so a result could read e.g. "17/10").
- **Extraction prompts had no instruction for tables or multi-part sub-questions.** `lib/ca/generateContent.ts` (notes-derived generation) and `lib/ca/extractTestPaper.ts` (verbatim) now explicitly require real markdown tables (header row + `|---|---|` separator, one data row per line) for balance sheets/ledgers, and one line per `(i)/(ii)/(iii)`-style sub-part — both were previously flattening into unreadable single-line prose. **Correction (2026-09-06):** this bullet used to also claim `lib/ca/extraction.ts` got the same treatment. It did not — it kept a weak `"preserve table structure as markdown"` parenthetical until the fix logged below, which is the worst file to have missed, since it's the sole irreversible producer of `content_map` while the three prompts that *did* get the strong wording are all downstream consumers of it. The rendering side needed a matching fix: question text was shown as plain `<p>` everywhere, so even correctly-formatted markdown wouldn't have displayed as a table — added `components/ca/QuestionText.tsx` (`react-markdown` + `remark-gfm`) and wired it into both `MockTestRunner.tsx` and `PracticeExplorer.tsx`. Fixes only apply to newly-extracted content — already-uploaded papers need a re-upload.
- **AI Teacher's output filter was blocking correct answers.** `filterOutput()` re-scanned the AI's *response* using the same keyword list used to classify a student's incoming *question* as off-topic — but that list includes ordinary CA vocabulary ("buy shares", "investment advice", "stock market tips" — exactly what a correct Financial Management answer says). Any legitimately correct answer touching investments got discarded and replaced with a generic failure message. Fixed by giving the output filter its own much smaller list (just prompt-leak signals like "non-negotiable", "your role:") instead of reusing the input classifier.
- **Answer-key-less descriptive/MCQ carry-over bug in the Mock Test answer box.** `DescriptiveAnswerForm` kept its React state across "Next question" navigation (no `key` prop tied to the question), so a student's typed answer for question 2 would still be sitting in the textarea for question 3. Fixed with `key={question.id}` to force a remount per question, in both `MockTestRunner.tsx` and `PracticeExplorer.tsx`.
- **`/api/ca/questions/evaluate` hard-required `model_answer`.** Rejected any descriptive question with "This question is not a descriptive question" — a misleading message — whenever `model_answer` was null, even though that's now a legitimate state for a verbatim test-paper question (see above). The AI grader already tolerates a missing model answer/marks (grades off its own subject knowledge); the route just needed to stop blocking on it.
- **Notes generate route couldn't ever pick up newly-confirmed blocks.** Once a note's `questions_count`/`flashcards_count` went above 0, `NotesPanel.tsx`'s generate button permanently became a plain link with no way back — so a block confirmed *after* the first "Create Practice Session"/"Generate Flashcards" click could never be generated for. Fixed in `app/api/ca/notes/generate/route.ts`: it now checks which `block_id`s already have generated rows and only processes new ones (safe to call repeatedly, no duplicate content), and `NotesPanel.tsx` shows a small "generate more" refresh icon alongside the link once content exists.
- **`quiz_sessions` couldn't distinguish MCQ from Descriptive practice.** `hooks/useCaPractice.ts` logs both modes to the same table with no column recording which — History always displayed "MCQ" even for Descriptive sessions. Added `quiz_sessions.question_type` (nullable — old rows and NEET rows, which are MCQ-only, stay null and are treated as MCQ).
- **CA Dashboard had no way to discover Mock Test.** The 5 quick-action tiles (Upload, Practice, Flashcards, AI Teacher, History) never included it despite it being one of the largest feature areas. Added a 6th tile.
- **"Create Practice Session" always failed for notes-derived questions, silently.** `lib/ca/generateContent.ts` built each generated question row with a `negative_marking: boolean` field that was never an actual column on `questions` (only `negative_marking_value` — the numeric one — was ever added, in `ca-notes-pipeline-schema.sql`). Every insert therefore failed with `Could not find the 'negative_marking' column of 'questions' in the schema cache`, caught, and surfaced as a generic `toast.error`— easy to miss since the button just flashes an error and resets rather than obviously breaking. Flashcards generation was unaffected (no such field on that row), which is why a note could show "8 flashcards" but stay stuck at "0 questions" no matter how many times Practice was generated. Found via the dev server's own error log (`CA notes generate error: ...`), not guessed — fixed by deleting the dead field (it was never read anywhere downstream either; only `negative_marking_value` is).
- **Cross-user data exposure in `questions`/`flashcards` RLS.** Both tables are shared between NEET and CA and had one blanket policy — `FOR SELECT TO authenticated USING (is_active = true)` — with no ownership check at all. Correct for NEET (a single curated shared bank every student is meant to see); wrong for CA, where every row is AI-generated from one specific student's own private upload and there is no shared/official CA bank (confirmed: the admin panel that inserts rows directly is NEET-only, `scripts/seed.ts` never touches CA). Any CA student's Practice/Flashcards session could pull in — and have their spaced-repetition progress polluted by — every other CA student's generated content. Found from a live report: a student saw Accounting questions in Practice despite never uploading anything in that subject; traced to a different test account having generated Accounting content earlier in this same session. Fixed with a join-based RLS policy (`supabase/ca-scope-questions-flashcards-by-owner.sql`) instead of a denormalized `user_id` column — `questions`/`flashcards` already carry `note_id`/`test_paper_id` on every CA row, which already trace back to `user_notes.user_id`/`ca_test_papers.user_id`, so no backfill was needed. `lib/questions.ts`'s query functions needed no code change — they already run through the user-scoped client, so tightening RLS alone closes the gap for every existing call site.

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

**This session's additions (Phases 7–9 above), bundled in one file** — `supabase/ca-session-schema-updates.sql` (paste this one file, covers all three; each is also its own standalone file below if you need just one):
- `supabase/ca-cheatsheets-schema.sql` — `ca_cheatsheets` table (Phase 7)
- `supabase/ca-case-study-questions.sql` — `questions.case_study_passage`/`case_study_group_id` (Phase 8)
- `supabase/ca-test-papers-auto-detect-paper.sql` — `ca_test_papers.paper` made nullable (Phase 9)

`ca-all-pending-migrations.sql` has also been kept in sync with all three (folded into their thematically-relevant sections) — if you're running that combined file fresh, you don't also need `ca-session-schema-updates.sql`. Only use the session-bundle file if you already ran `ca-all-pending-migrations.sql` before this session and just need to catch up.

**Phase 14 (shared derivation cache) — one new standalone file, not yet run:**
- `supabase/ca-generation-cache.sql` — `user_notes.file_hash`, `ca_extraction_cache`, `ca_generation_cache`. Every schema change for the caching feature is in this one file. Service-role RLS only: nothing reads these tables as the student, since a cache hit *copies* rows into the student's own `questions`/`flashcards`. **Until this is run, the cache code is inert** — `file_hash` writes silently no-op and every lookup misses, so uploads and generation keep working exactly as before, just without caching.

**Not yet folded into `ca-all-pending-migrations.sql`** — security-relevant, exists as a standalone file:
- `supabase/ca-scope-questions-flashcards-by-owner.sql` — replaces the blanket `questions`/`flashcards` read policy with an owner-scoped one for CA rows (see §4). Only touches policies, no new tables/columns — safe and cheap to run against a live database.

**Status: every migration file listed in this section has been run against the live database** — the bulk confirmed by the user 2026-09-05, and `ca-generation-cache.sql` plus `ca-scope-questions-flashcards-by-owner.sql` confirmed 2026-09-13. So the caching code is live, not inert. Anything added *after* this line is what a future session actually needs to ask about.

All migration files are idempotent (`if not exists` / `drop policy if exists` + recreate / `alter column drop not null`) — safe to re-run.

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

**Push status as of this writing** (check `git log`/`git status` in `prepzo/` — this drifts fast and is the one thing most likely to be stale by the time this is read again):
- **Pushed and confirmed live** (`ca.prepzo.study`, verified via curl after each deploy): pricing removal (Phase 10), syllabus data fix, case-study support (Phase 8), Mock Test auto-detect (Phase 9), the onboarding-redirect vertical-aware fix, show/hide password, the `/auth/confirm` route + direct-to-storage upload + Cancel feature + the timeout raise to 3 minutes (Phase 11–12, all of it *except* the items below).
- **Pushed but NOT deployed** (as of 2026-09-16 everything is on `origin/main` or `origin/ca-only`, but no build has succeeded since Aug 18 — see the Fluid Compute item below, and note that "pushed" and "live" have meant different things for the last month): image compression, the `pdf-lib` leniency (`throwOnInvalidObject: false`) + real-reason surfacing for "This file could not be opened", the patient Gemini retry schedule for extraction, the friendly-error fix in `processNote.ts`/`processTestPaper.ts`, and the Cheatsheet tax-codes/thresholds prompt strengthening (Phase 7's content requirement).
- **Vercel Fluid Compute is OFF, and it has been silently blocking every deploy since ~2026-08-21** (found 2026-09-16 from a build log, correcting this file's earlier claim that it was enabled as of 2026-09-05). On the Hobby plan, functions cap at 60s without it, so the builder rejects the three routes that declare `maxDuration = 180` — `notes/upload`, `test-papers/upload`, `notes/reextract` — with *"Builder returned invalid maxDuration value ... must have a maxDuration between 1 and 60 for plan hobby"*. Proof it is a settings change and not a code regression: commit `4900448` (the one that raised maxDuration to 180) built **Ready** on Aug 18 and the **same commit** failed on redeploy Aug 21. Production has served Aug-18 code ever since; failed builds never replace the last good deployment, which is why nothing looked broken. **Fix: Vercel → Settings → Functions → enable Fluid Compute, then redeploy.** Do NOT lower `maxDuration` to 60 instead — `PROCESSING_TIMEOUT_MS` is 165s, so a 60s cap kills the function 105s before the app-level timeout can record a reason, reintroducing the stuck-on-"Processing" bug Phase 12 exists to fix. If Fluid Compute is genuinely unavailable, both numbers have to come down together.
- **Manual steps only the user can do**: every SQL migration in §5 has been **run** against the live database. Still **pending, the one remaining manual step**: update the Supabase Dashboard's "Reset Password" email template (Authentication → Email Templates) to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}` — until that's done, `/auth/confirm` is unreachable no matter what's deployed and password reset stays broken across devices (see Phase 11).
- **Live user report, not yet re-confirmed**: a real ICAI Business Laws PDF (clean, 16 pages, nothing structurally unusual about it) failed Notes upload with the old generic "This file could not be opened" message on the live site — since that fix is local-only (see above), this specific file hasn't been retested against the fixed code yet. Worth prioritizing once pushed.

---

## 8. File map

```
lib/gemini.ts                          Gemini client singleton, generateWithRetry() (accepts an optional retry-delay
                                        schedule; PATIENT_RETRY_DELAYS_MS for extraction's large time budget vs the
                                        default short schedule everywhere else), model = "gemini-flash-latest"
lib/ca-syllabus.ts                     CA_SYLLABUS data (papers/levels/groups), getPaperByCode, getPapersForLevel
lib/ca/
  extraction.ts                        Gemini extraction + paper-mapping -> ContentMap/ContentBlock. The only
                                        prompt whose output is permanent (content_map is written once, the file is
                                        never re-read), so its table-formatting rule matters most — see Phase 13.
                                        Also exports findFlattenedTableBlocks() for detecting when that rule failed.
  templates.ts                         Question/flashcard generation rules per format-class (not per-paper)
  generateContent.ts                   generateForBlocks({mode: "questions"|"flashcards"}) — on-demand generation;
                                        questions mode also handles case_studies groups (Phase 8). Takes
                                        countByBlock (student-chosen quantity) and existingByBlock (pool items to
                                        not duplicate on a top-up run); splitCountAcrossBlocks divides the
                                        student's total by block size (Phase 14)
  extractionCache.ts                   Shared content_map cache, keyed (file_hash, ca_level). A prompt_hash
                                        mismatch is treated as a miss and the entry overwritten in place, so
                                        editing the extraction rules refreshes stale entries automatically and
                                        nothing is ever deleted (Phase 14)
  generationCache.ts                   Append-only pools of generated items per (block_id, mode). Callers COPY
                                        pool items into the student's own rows — pools are never shared as rows,
                                        so RLS and spaced-repetition progress stay per-student (Phase 14)
  generateCheatsheet.ts                Condensed per-note revision doc generation (Phase 7) — prompt explicitly
                                        requires tax section codes and monetary/numeric thresholds where present
  processNote.ts                       Background orchestrator (extraction only, no auto-generation) — wraps the
                                        Gemini call in withProcessingTimeout, checks the note still exists (cancel)
                                        before and after it, friendly-messages a persistent Gemini 503/429
  extractTestPaper.ts                  Verbatim question transcription from a real uploaded paper — NOT generation.
                                        Classifies each question's/case-study-group's paper itself against the full
                                        syllabus (Phase 9 — the student no longer picks one at upload), and gates on
                                        whether the document is a real question paper at all before extracting.
                                        Separate from extraction.ts + generateContent.ts on purpose (see
                                        ca-test-papers-schema.sql header).
  processTestPaper.ts                  Background orchestrator for test papers (transcribe -> insert questions, no
                                        content_map step — mirrors processNote.ts's shape, incl. the timeout/cancel/
                                        friendly-error handling); majorityPaper() sets ca_test_papers.paper afterward
  processingTimeout.ts                 withProcessingTimeout() — races extraction against an app-level timeout
                                        (165s) comfortably inside the upload routes' maxDuration (180s), so the code
                                        can record a specific reason before Vercel would otherwise kill the function
                                        outright with nothing recorded (Phase 12)
  clientUpload.ts                      Browser-side: validates + uploads a file DIRECTLY to Supabase Storage
                                        (bypasses Vercel's ~4.5MB function body limit entirely, Phase 12),
                                        client-side PDF page counting, image compression for JPG/PNG/WEBP over
                                        1.5MB, safeParseJson() (a non-JSON error response shouldn't crash res.json())
  evaluateAnswer.ts                    Descriptive answer grading prompt + Gemini call
  aiTeacher.ts                         Topic classifier, injection detector, output filter, system prompt
  tutorContext.ts                      fetchNoteContext() — pulls uploaded note content for AI Teacher grounding

app/api/ca/
  notes/upload/route.ts                POST — JSON metadata only (file already in storage, see clientUpload.ts) —
                                        insert user_notes+processing_queue, trigger processNote via after()
  notes/cancel/route.ts                POST — deletes a not-yet-processed note's row + storage file (Phase 12); this
                                        is also the mechanism processNote.ts polls to know a job was cancelled
  notes/reextract/route.ts             POST — re-runs processNote() over an already-uploaded note using the file
                                        still in ca-notes (Phase 13). 409s if a run is in flight, or if the note has
                                        generated content, unless discard_generated:true — which retires it via
                                        is_active=false rather than deleting, preserving spaced-repetition progress.
                                        No UI links to this yet.
  notes/confirm-mapping/route.ts       POST — student confirms/skips a low-confidence block (no generation)
  notes/generate/route.ts              POST — on-demand generation: note_id + mode, plus optional block_ids[]
                                        (which topics) and count (how many). Serves from the shared pool first,
                                        generates only the shortfall, appends what it generated back to the pool
                                        (Phase 14). Both new fields optional — omitting them is the old
                                        whole-note behaviour.
  test-papers/upload/route.ts          POST — JSON metadata only, same shape as notes/upload/route.ts; no paper code
                                        (auto-detected during processing, Phase 9)
  test-papers/cancel/route.ts          POST — same as notes/cancel/route.ts, for ca_test_papers
  cheatsheets/generate/route.ts        POST — generate/regenerate a note's cheatsheet (Phase 7)
  questions/evaluate/route.ts          POST — descriptive answer grading
  tutor/message/route.ts               POST — AI Teacher chat turn

app/auth/confirm/route.ts              GET — token_hash + verifyOtp() email-link verification (password recovery,
                                        magic link, signup confirmation) — separate from /auth/callback's PKCE code
                                        exchange (OAuth only), specifically because email links are routinely opened
                                        on a different browser/device than the one that requested them, which PKCE's
                                        code_verifier requirement can't tolerate (Phase 11). Requires the Supabase
                                        Dashboard's "Reset Password" email template to actually point here — see §7.

app/api/account/delete/route.ts        POST — no exam branching (was shared NEET+CA). Deletes storage files under the
                                        user's ID in ca-notes/ca-test-papers, then auth.admin.deleteUser() — cascades
                                        through every table via profiles(id) references auth.users(id) on delete
                                        cascade, and every user-owned table references profiles(id) on delete cascade.

app/(app)/                             dashboard, notes, practice, flashcards, mock-test, tutor, cheatsheet, history,
                                        settings pages
  layout.tsx                           Auth + CA-onboarding gate for the whole route group

hooks/
  useCaNotes.ts                        Notes list/upload/confirm/generate/cancel, polling
  useCaCheatsheets.ts                  Cheatsheets list for the CheatsheetSidebar (Phase 7)
  useCaPractice.ts                     CA MCQ+descriptive practice (NOT shared with NEET's useQuiz)
  useCaMockTest.ts                     Mixed-pattern question set assembly + scoring; accepts an optional testPaperId
                                        to instead pull ALL questions for that specific uploaded real paper (no pool
                                        cap, original order) — same hook, same TestRunner UI, different data source
  useCaTestPapers.ts                   Real-paper uploads list/upload/cancel, polling (mirrors useCaNotes.ts, no
                                        confirm/generate step — nothing to confirm/generate for a verbatim paper)
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
                                        link pointing at NEET's shared cross-subject DecksPanel (deleted with NEET), which was the
                                        wrong shape for what was asked (review/recall belongs inline per-section,
                                        alongside Retake) and was removed.
  MockTestRunner.tsx                   Two sections: "Practice Set" (existing paper picker -> mixed AI-generated
                                        question set from notes, unchanged) and "Your Real Papers" (TestPapersPanel
                                        below). Both funnel into the same TestRunner, switched via an optional
                                        testPaperId — practice mode omits it (pool-sampled), real-paper mode sets it
                                        (fixed set, exact paper contents, no cap).
  TestPapersPanel.tsx                  Real-paper upload (NotesUploadZone, reused as-is) + list with status/
                                        question-count/attempt-history, "Attempt" button. No paper-select dropdown
                                        as of Phase 9 — the paper is auto-detected during processing, not chosen at
                                        upload; copy here explicitly tells students what Mock Test does and doesn't
                                        accept (real papers only, not notes) and links to Upload.
  ProcessingHint.tsx                   Shown under a note/test-paper's status badge while queued/processing (Phase
                                        12) — live elapsed-time readout, switching past a threshold to a bulleted
                                        breakdown of context-specific likely causes (passed in per caller — Notes
                                        and Mock Test show different reasons) plus a Cancel button
  CheatsheetWorkspace.tsx              Two-pane shell for Cheatsheet (Phase 7), mirrors TutorWorkspace.tsx's shape
  CheatsheetSidebar.tsx                Cheatsheet list — one row per note that already has a generated cheatsheet
  CheatsheetEditor.tsx                 Heading = note title, edit/Preview toggle (QuestionText.tsx), Save,
                                        Download PDF (exportCheatsheetPdf.ts). No Regenerate — deliberately
                                        removed (see Phase 7): it could only wipe the student's own edits,
                                        with no versioning to get them back.
  TutorChat.tsx                        Chat UI, Markdown rendering, note-grounding banner
  ScoreTrendChart.tsx                  Real score-over-time chart (History page)
  QuestionText.tsx                     Markdown+GFM question-text renderer (react-markdown + remark-gfm, custom
                                        table/list styling, headings/hr/code added for Cheatsheet's heavier markdown
                                        use) — used anywhere a question/cheatsheet is shown, since the text can
                                        contain a real markdown table
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

components/auth/                       LoginForm.tsx/SignupForm.tsx — originally NEET's, kept at the CA-only
                                        conversion. The isCaVertical host sniffing that picked a callback/onboarding
                                        path is gone (§1a); both have a show/hide password toggle. ResetPasswordForm.tsx
                                        (Phase 11) — reached via /auth/confirm after a token_hash verification,
                                        collects + sets a new password (supabase.auth.updateUser).

supabase/*.sql                         See §5 for exact list and order
```
