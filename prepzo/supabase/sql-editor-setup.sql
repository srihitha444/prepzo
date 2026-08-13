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
  exam TEXT CHECK (exam IN ('NEET', 'CA')),
  survey_current_stage TEXT CHECK (survey_current_stage IN ('11th Class', '12th Class', 'Dropper')),
  survey_target_exams TEXT[] NOT NULL DEFAULT '{}',
  survey_completed_at TIMESTAMPTZ,
  ca_level TEXT CHECK (ca_level IN ('Foundation', 'Intermediate', 'Final')),
  ca_groups TEXT[] NOT NULL DEFAULT '{}',
  ca_papers TEXT[] NOT NULL DEFAULT '{}',
  ca_target_attempt_date DATE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'paid')),
  daily_goal INTEGER NOT NULL DEFAULT 20,
  streak INTEGER NOT NULL DEFAULT 0,
  last_active DATE,
  tour_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS exam TEXT CHECK (exam IN ('NEET', 'CA'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS survey_current_stage TEXT CHECK (survey_current_stage IN ('11th Class', '12th Class', 'Dropper'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS survey_target_exams TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS survey_completed_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ca_level TEXT CHECK (ca_level IN ('Foundation', 'Intermediate', 'Final'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ca_groups TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ca_papers TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ca_target_attempt_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'paid'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_goal INTEGER NOT NULL DEFAULT 20;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam TEXT NOT NULL CHECK (exam IN ('NEET', 'CA')),
  subject TEXT NOT NULL,
  topic TEXT,
  chapter TEXT,
  subtopic TEXT,
  is_pyq BOOLEAN NOT NULL DEFAULT FALSE,
  pyq_year INTEGER,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option ~ '^[a-d](,[a-d]){0,3}$'),
  explanation TEXT,
  difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE questions ADD COLUMN IF NOT EXISTS chapter TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subtopic TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_pyq BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS pyq_year INTEGER;

CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam TEXT NOT NULL CHECK (exam IN ('NEET', 'CA')),
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
  exam TEXT NOT NULL CHECK (exam IN ('NEET', 'CA')),
  subject TEXT,
  topic TEXT,
  is_pyq BOOLEAN NOT NULL DEFAULT FALSE,
  pyq_year INTEGER,
  total_questions INTEGER,
  correct INTEGER,
  wrong INTEGER,
  skipped INTEGER NOT NULL DEFAULT 0,
  avg_time_seconds INTEGER,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS is_pyq BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS pyq_year INTEGER;

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_subscription_id TEXT,
  plan TEXT CHECK (plan IN ('monthly', 'yearly')),
  amount INTEGER,
  original_amount INTEGER,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  referral_code_id UUID,
  status TEXT CHECK (status IN ('pending', 'active', 'failed', 'cancelled')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS original_amount INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referral_code_id UUID;

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{4,24}$'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  discount_percent INTEGER NOT NULL DEFAULT 10,
  commission_percent INTEGER NOT NULL DEFAULT 20,
  valid_months INTEGER NOT NULL DEFAULT 12,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE RESTRICT,
  referrer_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  first_subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  activated_at TIMESTAMPTZ,
  commission_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (referrer_user_id <> referred_user_id)
);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL UNIQUE REFERENCES subscriptions(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_paid INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  commission_percent INTEGER NOT NULL DEFAULT 20,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'void')),
  payout_month DATE NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  notes TEXT
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_referral_code_id_fkey'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_referral_code_id_fkey
      FOREIGN KEY (referral_code_id) REFERENCES referral_codes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pyq_paper_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID REFERENCES pyq_papers(id) ON DELETE CASCADE,
  question_id UUID REFERENCES pyq_questions(id) ON DELETE CASCADE,
  question_number INT NOT NULL,
  correct_option TEXT CHECK (correct_option ~ '^[a-d](,[a-d]){0,3}$'),
  marks_correct INT DEFAULT 4,
  marks_wrong INT DEFAULT -1,
  marks_unattempted INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(paper_id, question_number),
  UNIQUE(paper_id, question_id)
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
ALTER TABLE pyq_paper_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Users can view own referral code" ON referral_codes;
CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can create own referral code" ON referral_codes;
CREATE POLICY "Users can create own referral code"
  ON referral_codes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own referral code" ON referral_codes;
CREATE POLICY "Users can update own referral code"
  ON referral_codes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Service role can manage referral codes" ON referral_codes;
CREATE POLICY "Service role can manage referral codes"
  ON referral_codes FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT TO authenticated
  USING (auth.uid() IN (referrer_user_id, referred_user_id) OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update referrals" ON referrals;
CREATE POLICY "Admins can update referrals"
  ON referrals FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role can manage referrals" ON referrals;
CREATE POLICY "Service role can manage referrals"
  ON referrals FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can view own referral rewards" ON referral_rewards;
CREATE POLICY "Users can view own referral rewards"
  ON referral_rewards FOR SELECT TO authenticated
  USING (auth.uid() IN (referrer_user_id, referred_user_id) OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update referral rewards" ON referral_rewards;
CREATE POLICY "Admins can update referral rewards"
  ON referral_rewards FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role can manage referral rewards" ON referral_rewards;
CREATE POLICY "Service role can manage referral rewards"
  ON referral_rewards FOR ALL TO service_role
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

DROP POLICY IF EXISTS "Authenticated users can read pyq paper questions" ON pyq_paper_questions;
CREATE POLICY "Authenticated users can read pyq paper questions"
  ON pyq_paper_questions FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage pyq paper questions" ON pyq_paper_questions;
CREATE POLICY "Admins can manage pyq paper questions"
  ON pyq_paper_questions FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role can manage pyq paper questions" ON pyq_paper_questions;
CREATE POLICY "Service role can manage pyq paper questions"
  ON pyq_paper_questions FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);
CREATE INDEX IF NOT EXISTS idx_questions_exam_subject ON questions(exam, subject);
CREATE INDEX IF NOT EXISTS idx_questions_pyq ON questions(is_pyq, pyq_year);
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter);
CREATE INDEX IF NOT EXISTS idx_questions_subtopic ON questions(subtopic);
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
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_pyq ON quiz_sessions(user_id, is_pyq, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_order ON subscriptions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_subscription ON subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_referral_code ON subscriptions(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer_month ON referral_rewards(referrer_user_id, payout_month);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status_month ON referral_rewards(status, payout_month);
CREATE INDEX IF NOT EXISTS idx_pyq_paper_questions_paper ON pyq_paper_questions(paper_id, question_number);
CREATE INDEX IF NOT EXISTS idx_pyq_paper_questions_question ON pyq_paper_questions(question_id);

-- =============================================
-- ADMIN SETUP
-- =============================================
-- Replace this with your real admin email, then run the file.
-- The app also checks NEXT_PUBLIC_ADMIN_EMAILS in Vercel/local env,
-- but Supabase RLS needs this row too for admin inserts/updates/counts.

INSERT INTO admin_users (email)
VALUES ('itssrihitha555@gmail.com')
ON CONFLICT (email) DO NOTHING;
