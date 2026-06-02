-- =============================================
-- PREPZO SUPABASE SQL EDITOR SETUP
-- =============================================
-- Run this whole file in Supabase Dashboard > SQL Editor.
-- It is safe to run more than once.
--
-- After running it, add your admin email near the bottom where marked.
-- =============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- CORE TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  exam TEXT CHECK (exam IN ('NEET')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'paid')),
  daily_goal INTEGER NOT NULL DEFAULT 20,
  streak INTEGER NOT NULL DEFAULT 0,
  last_active DATE,
  tour_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS exam TEXT CHECK (exam IN ('NEET'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'paid'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_goal INTEGER NOT NULL DEFAULT 20;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam TEXT NOT NULL CHECK (exam IN ('NEET')),
  subject TEXT NOT NULL,
  topic TEXT,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  explanation TEXT,
  difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam TEXT NOT NULL CHECK (exam IN ('NEET')),
  subject TEXT NOT NULL,
  topic TEXT,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  deck_type TEXT CHECK (deck_type IN ('unseen', 'recall', 'review')),
  times_seen INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  avg_time_seconds INTEGER,
  UNIQUE (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS user_flashcard_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  deck_type TEXT CHECK (deck_type IN ('unseen', 'recall', 'review')),
  times_seen INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  UNIQUE (user_id, flashcard_id)
);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam TEXT NOT NULL CHECK (exam IN ('NEET')),
  subject TEXT,
  total_questions INTEGER,
  correct INTEGER,
  wrong INTEGER,
  skipped INTEGER NOT NULL DEFAULT 0,
  avg_time_seconds INTEGER,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  plan TEXT CHECK (plan IN ('monthly', 'yearly')),
  amount INTEGER,
  status TEXT CHECK (status IN ('pending', 'active', 'failed', 'cancelled')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- HELPERS
-- =============================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- RLS
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_flashcard_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated users can read questions" ON questions;
CREATE POLICY "Authenticated users can read questions"
  ON questions FOR SELECT TO authenticated
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage questions" ON questions;
CREATE POLICY "Admins can manage questions"
  ON questions FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role can manage questions" ON questions;
CREATE POLICY "Service role can manage questions"
  ON questions FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read flashcards" ON flashcards;
CREATE POLICY "Authenticated users can read flashcards"
  ON flashcards FOR SELECT TO authenticated
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage flashcards" ON flashcards;
CREATE POLICY "Admins can manage flashcards"
  ON flashcards FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role can manage flashcards" ON flashcards;
CREATE POLICY "Service role can manage flashcards"
  ON flashcards FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can manage own progress" ON user_progress;
CREATE POLICY "Users can manage own progress"
  ON user_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can manage own flashcard progress" ON user_flashcard_progress;
CREATE POLICY "Users can manage own flashcard progress"
  ON user_flashcard_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can manage own quiz sessions" ON quiz_sessions;
CREATE POLICY "Users can manage own quiz sessions"
  ON quiz_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can create own pending subscriptions" ON subscriptions;
CREATE POLICY "Users can create own pending subscriptions"
  ON subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role can manage admin users" ON admin_users;
CREATE POLICY "Service role can manage admin users"
  ON admin_users FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);
CREATE INDEX IF NOT EXISTS idx_questions_exam_subject ON questions(exam, subject);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_active_created ON questions(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flashcards_exam_subject ON flashcards(exam, subject);
CREATE INDEX IF NOT EXISTS idx_flashcards_active ON flashcards(is_active);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_due ON user_progress(user_id, deck_type, next_due_at);
CREATE INDEX IF NOT EXISTS idx_user_progress_seen ON user_progress(user_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_ufp_user ON user_flashcard_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_ufp_due ON user_flashcard_progress(user_id, deck_type, next_due_at);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_completed ON quiz_sessions(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_order ON subscriptions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- =============================================
-- ADMIN SETUP
-- =============================================
-- Replace this with your real admin email, then run the file.
-- The app also checks NEXT_PUBLIC_ADMIN_EMAILS in Vercel/local env,
-- but Supabase RLS needs this row too for admin inserts/updates/counts.

INSERT INTO admin_users (email)
VALUES ('your-admin-email@example.com')
ON CONFLICT (email) DO NOTHING;

