# 08 — Database Schema

All Supabase tables for the Prepzo CA platform. Run in SQL Editor in the order shown — dependencies are respected throughout.

---

## Run This in Supabase SQL Editor

```sql
-- =========================================================
-- PREPZO CA PLATFORM — FULL SCHEMA
-- =========================================================

-- == 1. PROFILES ============================================
-- Extends Supabase auth.users
-- ca_level and target_attempt set at signup onboarding
-- These drive all question and flashcard templates downstream

CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  name TEXT,
  ca_level TEXT CHECK (ca_level IN ('Foundation','Intermediate','Final')),
  target_attempt_date DATE,
  -- target_attempt_date: the exam sitting the student is preparing for
  -- e.g. 2026-11-01 for November 2026 attempt
  streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active DATE,
  tour_completed BOOLEAN DEFAULT FALSE,
  daily_goal INTEGER DEFAULT 20,
  recall_setting TEXT DEFAULT '2days'
    CHECK (recall_setting IN ('daily','2days','weekly')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- == 2. USER NOTES (uploaded documents) ======================
-- One row per upload
-- content_map stores the full block-level mapping result
-- from 03_CONTENT_MAPPING.md
-- A single upload can map to multiple papers

CREATE TABLE user_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT CHECK (file_type IN ('pdf','image','text')),
  page_count INTEGER DEFAULT 1,
  -- page_count must not exceed 1000
  -- files above 1000 pages are rejected before this row is created
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  content_map JSONB,
  -- content_map structure:
  -- {
  --   "blocks": [
  --     {
  --       "block_id": "uuid",
  --       "page_start": 1,
  --       "page_end": 3,
  --       "ca_level": "Foundation",
  --       "paper": "Paper 1",
  --       "paper_name": "Accounting",
  --       "content_type": "table",
  --       "topic": "Depreciation",
  --       "confidence": 94,
  --       "student_confirmed": true,
  --       "raw_content": "...",
  --       "level_mismatch": false
  --     }
  --   ],
  --   "papers_detected": ["Paper 1", "Paper 2"],
  --   "unidentified_blocks": 1,
  --   "level_mismatches": 0
  -- }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- == 3. PROCESSING QUEUE =====================================
-- Background job queue for document processing
-- One row per upload, tracks status through pipeline

CREATE TABLE processing_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID REFERENCES user_notes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- == 4. GENERATED QUESTIONS ===================================
-- Questions generated from uploaded content
-- block_id links back to the specific block in content_map
-- table_generated flags questions that include a rendered table

CREATE TABLE generated_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  note_id UUID REFERENCES user_notes(id) ON DELETE CASCADE,
  block_id TEXT,
  -- block_id matches block_id in content_map
  -- used to trace which block produced this question
  ca_level TEXT CHECK (ca_level IN ('Foundation','Intermediate','Final')),
  paper TEXT,
  paper_name TEXT,
  subject TEXT,
  topic TEXT,
  question_text TEXT NOT NULL,
  question_type TEXT CHECK (question_type IN ('mcq','descriptive')),
  content_type TEXT CHECK (content_type IN ('text','table','formula','legal','diagram')),
  table_generated BOOLEAN DEFAULT FALSE,
  -- table_generated: true when the question body includes a rendered table
  -- see 04_QUESTIONS.md for rules on when this is required
  table_content JSONB,
  -- table_content: the structured table data rendered in the question
  -- null when table_generated is false
  -- MCQ fields
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_option TEXT CHECK (correct_option IN ('A','B','C','D')),
  negative_marking BOOLEAN DEFAULT FALSE,
  negative_marking_value DECIMAL DEFAULT 0,
  -- Descriptive fields
  marks INTEGER,
  model_answer TEXT,
  mark_allocation JSONB,
  -- mark_allocation structure:
  -- [{"step": "Correct debit entry", "marks": 1}, ...]
  icai_format_required BOOLEAN DEFAULT FALSE,
  -- Common fields
  difficulty TEXT CHECK (difficulty IN ('Easy','Medium','Hard')),
  explanation TEXT,
  section_references TEXT[],
  -- section_references: array of section numbers cited
  -- e.g. ["S.11 ICA 1872", "S.19 ICA 1872"]
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- == 5. QUESTION ATTEMPTS =====================================
-- One row per attempt on a generated question
-- Tracks both MCQ and descriptive attempts

CREATE TABLE question_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID REFERENCES generated_questions(id) ON DELETE CASCADE,
  -- MCQ fields
  selected_option TEXT CHECK (selected_option IN ('A','B','C','D')),
  is_correct BOOLEAN,
  -- Descriptive fields
  student_answer TEXT,
  marks_awarded INTEGER,
  marks_total INTEGER,
  ai_evaluation JSONB,
  -- ai_evaluation structure:
  -- {
  --   "marks_awarded": 6,
  --   "marks_total": 8,
  --   "percentage": 75,
  --   "what_was_correct": [...],
  --   "what_was_missed": [...],
  --   "presentation_feedback": "...",
  --   "improvement_tips": [...],
  --   "encouragement": "..."
  -- }
  -- Common fields
  time_taken_seconds INTEGER,
  deck_assignment TEXT CHECK (deck_assignment IN ('recall','review')),
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- == 6. USER QUESTION PROGRESS ================================
-- Tracks spaced repetition state per question per user

CREATE TABLE user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID REFERENCES generated_questions(id) ON DELETE CASCADE,
  deck_type TEXT DEFAULT 'unseen'
    CHECK (deck_type IN ('unseen','recall','review')),
  times_seen INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  avg_time_seconds INTEGER,
  UNIQUE(user_id, question_id)
);

-- == 7. USER FLASHCARDS (generated from uploads) ==============
-- Flashcards generated from student-uploaded content
-- block_id links back to the specific block in content_map

CREATE TABLE user_flashcards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  note_id UUID REFERENCES user_notes(id) ON DELETE CASCADE,
  block_id TEXT,
  ca_level TEXT CHECK (ca_level IN ('Foundation','Intermediate','Final')),
  paper TEXT,
  paper_name TEXT,
  subject TEXT,
  topic TEXT,
  flashcard_type TEXT CHECK (flashcard_type IN (
    'definition','section','formula',
    'accounting_rule','standard','comparison'
  )),
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  section_reference TEXT,
  -- section_reference: e.g. "S.11 ICA 1872"
  -- populated for section and legal flashcard types
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- == 8. USER FLASHCARD PROGRESS ================================
-- Tracks spaced repetition state per flashcard per user
-- recall_override: used for section flashcards which
-- always default to daily recall regardless of profile setting

CREATE TABLE user_flashcard_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  flashcard_id UUID REFERENCES user_flashcards(id) ON DELETE CASCADE,
  deck_type TEXT DEFAULT 'unseen'
    CHECK (deck_type IN ('unseen','recall','review')),
  times_seen INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  recall_override TEXT,
  -- recall_override: set to 'daily' for section flashcards
  -- overrides profile recall_setting
  UNIQUE(user_id, flashcard_id)
);

-- == 9. AI TEACHER SESSIONS =====================================
-- One row per conversation session
-- messages stored as JSONB array

CREATE TABLE ai_teacher_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ca_level TEXT,
  current_topic TEXT,
  messages JSONB DEFAULT '[]',
  -- messages structure:
  -- [{"role": "user"|"assistant", "content": "...", "timestamp": "..."}]
  messages_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- == 10. AI TEACHER RATE LIMITING ===============================
-- Tracks message rate per user per day
-- Used for spam prevention only, not plan limits

CREATE TABLE ai_teacher_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date DATE DEFAULT CURRENT_DATE,
  messages_sent INTEGER DEFAULT 0,
  blocked_attempts INTEGER DEFAULT 0,
  -- blocked_attempts: out of scope or injection attempts
  UNIQUE(user_id, usage_date)
);

-- == 11. QUIZ SESSIONS ===========================================
-- One row per completed quiz session
-- Stores aggregate results for progress analytics

CREATE TABLE quiz_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ca_level TEXT NOT NULL,
  paper TEXT,
  paper_name TEXT,
  topic TEXT,
  session_type TEXT CHECK (session_type IN ('mcq','descriptive','mixed')),
  total_questions INTEGER DEFAULT 0,
  correct INTEGER DEFAULT 0,
  wrong INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  avg_time_seconds INTEGER,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- == 12. MOCK TESTS ===============================================
-- Pre-built mock test templates per paper

CREATE TABLE ca_mock_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  ca_level TEXT CHECK (ca_level IN ('Foundation','Intermediate','Final')),
  paper_number INTEGER,
  paper_name TEXT,
  test_type TEXT CHECK (test_type IN ('full_paper','mcq_only','descriptive_only','topic')),
  duration_minutes INTEGER NOT NULL,
  total_marks INTEGER NOT NULL,
  mcq_marks INTEGER DEFAULT 0,
  descriptive_marks INTEGER DEFAULT 0,
  negative_marking BOOLEAN DEFAULT FALSE,
  negative_marking_value DECIMAL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- == 13. MOCK TEST ATTEMPTS =======================================

CREATE TABLE ca_mock_test_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  mock_test_id UUID REFERENCES ca_mock_tests(id),
  mcq_answers JSONB DEFAULT '{}',
  descriptive_answers JSONB DEFAULT '{}',
  mcq_score DECIMAL DEFAULT 0,
  descriptive_score DECIMAL DEFAULT 0,
  total_score DECIMAL DEFAULT 0,
  total_possible INTEGER DEFAULT 0,
  time_taken_minutes INTEGER,
  ai_evaluation JSONB,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- == 14. SUBSCRIPTIONS =============================================
-- Payment records — plan logic not yet defined
-- Table exists to record transactions when payment is integrated

CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  plan TEXT,
  amount INTEGER,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','active','failed','cancelled')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- == 15. ADMIN USERS ===============================================

CREATE TABLE admin_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_flashcard_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_teacher_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_teacher_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca_mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca_mock_test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "users_view_own_profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own_profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User notes
CREATE POLICY "users_manage_own_notes"
  ON user_notes FOR ALL USING (auth.uid() = user_id);

-- Processing queue
CREATE POLICY "users_view_own_queue"
  ON processing_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service_manage_queue"
  ON processing_queue FOR ALL TO service_role USING (TRUE);

-- Generated questions
CREATE POLICY "users_manage_own_questions"
  ON generated_questions FOR ALL USING (auth.uid() = user_id);

-- Question attempts
CREATE POLICY "users_manage_own_attempts"
  ON question_attempts FOR ALL USING (auth.uid() = user_id);

-- User progress
CREATE POLICY "users_manage_own_progress"
  ON user_progress FOR ALL USING (auth.uid() = user_id);

-- Flashcards
CREATE POLICY "users_manage_own_flashcards"
  ON user_flashcards FOR ALL USING (auth.uid() = user_id);

-- Flashcard progress
CREATE POLICY "users_manage_own_flashcard_progress"
  ON user_flashcard_progress FOR ALL USING (auth.uid() = user_id);

-- AI Teacher sessions
CREATE POLICY "users_manage_own_ai_sessions"
  ON ai_teacher_sessions FOR ALL USING (auth.uid() = user_id);

-- AI Teacher usage
CREATE POLICY "users_manage_own_ai_usage"
  ON ai_teacher_usage FOR ALL USING (auth.uid() = user_id);

-- Quiz sessions
CREATE POLICY "users_manage_own_quiz_sessions"
  ON quiz_sessions FOR ALL USING (auth.uid() = user_id);

-- Mock tests readable by all authenticated users
CREATE POLICY "authenticated_read_mock_tests"
  ON ca_mock_tests FOR SELECT TO authenticated USING (is_active = TRUE);

-- Mock test attempts
CREATE POLICY "users_manage_own_mock_attempts"
  ON ca_mock_test_attempts FOR ALL USING (auth.uid() = user_id);

-- Subscriptions
CREATE POLICY "users_view_own_subscriptions"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_subscriptions"
  ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "service_manage_subscriptions"
  ON subscriptions FOR ALL TO service_role USING (TRUE);

-- Admin users
CREATE POLICY "admins_view_admin_users"
  ON admin_users FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
  ));
CREATE POLICY "service_manage_admin_users"
  ON admin_users FOR ALL TO service_role USING (TRUE);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX idx_profiles_level ON profiles(ca_level);
CREATE INDEX idx_user_notes_user ON user_notes(user_id);
CREATE INDEX idx_user_notes_processed ON user_notes(user_id, processed);
CREATE INDEX idx_queue_status ON processing_queue(status);
CREATE INDEX idx_generated_questions_user ON generated_questions(user_id);
CREATE INDEX idx_generated_questions_note ON generated_questions(note_id);
CREATE INDEX idx_generated_questions_block ON generated_questions(block_id);
CREATE INDEX idx_generated_questions_type ON generated_questions(question_type);
CREATE INDEX idx_generated_questions_paper ON generated_questions(ca_level, paper);
CREATE INDEX idx_question_attempts_user ON question_attempts(user_id);
CREATE INDEX idx_user_progress_user ON user_progress(user_id);
CREATE INDEX idx_user_progress_deck ON user_progress(user_id, deck_type);
CREATE INDEX idx_user_progress_due ON user_progress(user_id, next_due_at);
CREATE INDEX idx_user_flashcards_user ON user_flashcards(user_id);
CREATE INDEX idx_user_flashcards_type ON user_flashcards(flashcard_type);
CREATE INDEX idx_user_flashcards_block ON user_flashcards(block_id);
CREATE INDEX idx_flashcard_progress_user ON user_flashcard_progress(user_id);
CREATE INDEX idx_flashcard_progress_due ON user_flashcard_progress(user_id, next_due_at);
CREATE INDEX idx_ai_sessions_user ON ai_teacher_sessions(user_id);
CREATE INDEX idx_ai_usage_user_date ON ai_teacher_usage(user_id, usage_date);
CREATE INDEX idx_quiz_sessions_user ON quiz_sessions(user_id);
CREATE INDEX idx_mock_attempts_user ON ca_mock_test_attempts(user_id);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

-- =========================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.email
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- ADMIN SETUP
-- Replace with your real admin email before running
-- =========================================================

INSERT INTO admin_users (email)
VALUES ('your-admin-email@example.com')
ON CONFLICT (email) DO NOTHING;

-- =========================================================
-- VALIDATION NOTES
-- =========================================================

-- Page count validation (1,000 page limit):
-- This check runs in the API route before the user_notes row is created.
-- The database does not enforce this directly.
-- If page_count > 1000 the upload is rejected in the API
-- and no row is inserted.
-- See 09_API_ROUTES.md for the rejection logic.

-- Mixed-paper uploads:
-- content_map in user_notes stores block-level mapping
-- where each block has its own ca_level, paper, and paper_name.
-- A single user_notes row can reference multiple papers.
-- generated_questions and user_flashcards rows each store
-- the paper they belong to individually via the paper column.
-- This allows filtering questions and flashcards by paper
-- even when they came from a mixed upload.
```
