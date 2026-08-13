-- =============================================
-- PREPZO DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- PROFILES (extends auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  exam TEXT CHECK (exam IN ('NEET', 'CA')),
  survey_current_stage TEXT CHECK (survey_current_stage IN ('11th Class', '12th Class', 'Dropper')),
  survey_target_exams TEXT[] NOT NULL DEFAULT '{}',
  survey_completed_at TIMESTAMPTZ,
  ca_level TEXT CHECK (ca_level IN ('Foundation', 'Intermediate', 'Final')),
  ca_groups TEXT[] NOT NULL DEFAULT '{}',
  ca_papers TEXT[] NOT NULL DEFAULT '{}',
  ca_target_attempt_date DATE,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','paid')),
  daily_goal INTEGER DEFAULT 20,
  streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  recall_setting TEXT DEFAULT 'spaced-repetition' CHECK (recall_setting IN ('spaced-repetition','immediate','custom')),
  last_active DATE,
  tour_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- QUESTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exam TEXT NOT NULL CHECK (exam IN ('NEET', 'CA')),
  subject TEXT NOT NULL,
  topic TEXT,
  chapter TEXT,
  subtopic TEXT,
  is_pyq BOOLEAN DEFAULT FALSE,
  pyq_year INTEGER,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option ~ '^[a-d](,[a-d]){0,3}$'),
  explanation TEXT,
  difficulty TEXT CHECK (difficulty IN ('Easy','Medium','Hard')),
  is_active BOOLEAN DEFAULT TRUE,
  added_week DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read questions"
  ON questions FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Service role can manage questions"
  ON questions FOR ALL TO service_role USING (true);

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_questions_exam_subject ON questions(exam, subject);
CREATE INDEX IF NOT EXISTS idx_questions_pyq ON questions(is_pyq, pyq_year);
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter);
CREATE INDEX IF NOT EXISTS idx_questions_subtopic ON questions(subtopic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(is_active);
CREATE INDEX IF NOT EXISTS idx_questions_added_week ON questions(added_week);

-- =============================================
-- FLASHCARDS
-- =============================================
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exam TEXT NOT NULL CHECK (exam IN ('NEET', 'CA')),
  subject TEXT NOT NULL,
  topic TEXT,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  added_week DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read flashcards"
  ON flashcards FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Service role can manage flashcards"
  ON flashcards FOR ALL TO service_role USING (true);

CREATE INDEX IF NOT EXISTS idx_flashcards_exam_subject ON flashcards(exam, subject);
CREATE INDEX IF NOT EXISTS idx_flashcards_added_week ON flashcards(added_week);

-- =============================================
-- USER PROGRESS (per question)
-- =============================================
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  deck_type TEXT CHECK (deck_type IN ('unseen','recall','review')),
  times_seen INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  avg_time_seconds INTEGER,
  UNIQUE(user_id, question_id)
);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress"
  ON user_progress FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_due ON user_progress(user_id, next_due_at);

-- =============================================
-- USER FLASHCARD PROGRESS
-- =============================================
CREATE TABLE IF NOT EXISTS user_flashcard_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
  deck_type TEXT CHECK (deck_type IN ('unseen','recall','review')),
  times_seen INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  UNIQUE(user_id, flashcard_id)
);

ALTER TABLE user_flashcard_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own flashcard progress"
  ON user_flashcard_progress FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ufp_user ON user_flashcard_progress(user_id);

-- =============================================
-- QUIZ SESSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  exam TEXT NOT NULL,
  subject TEXT,
  topic TEXT,
  is_pyq BOOLEAN NOT NULL DEFAULT FALSE,
  pyq_year INTEGER,
  total_questions INTEGER,
  correct INTEGER,
  wrong INTEGER,
  skipped INTEGER DEFAULT 0,
  avg_time_seconds INTEGER,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS is_pyq BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS pyq_year INTEGER;

ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own quiz sessions"
  ON quiz_sessions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_pyq ON quiz_sessions(user_id, is_pyq, completed_at DESC);

-- =============================================
-- SUBSCRIPTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_subscription_id TEXT,
  plan TEXT CHECK (plan IN ('monthly')),
  amount INTEGER,
  original_amount INTEGER,
  discount_amount INTEGER DEFAULT 0,
  discount_percent INTEGER DEFAULT 0,
  referral_code_id UUID,
  status TEXT CHECK (status IN ('pending','active','failed','cancelled')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{4,24}$'),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','disabled')),
  discount_percent INTEGER DEFAULT 10,
  commission_percent INTEGER DEFAULT 20,
  valid_months INTEGER DEFAULT 12,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID REFERENCES referral_codes(id) ON DELETE RESTRICT,
  referrer_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  first_subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','expired','cancelled')),
  activated_at TIMESTAMPTZ,
  commission_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (referrer_user_id <> referred_user_id)
);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_id UUID REFERENCES referrals(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE UNIQUE,
  referrer_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount_paid INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  commission_percent INTEGER DEFAULT 20,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','void')),
  payout_month DATE NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  notes TEXT
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL TO service_role USING (true);

CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own referral code"
  ON referral_codes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT USING (auth.uid() IN (referrer_user_id, referred_user_id));

CREATE POLICY "Users can view own referral rewards"
  ON referral_rewards FOR SELECT USING (auth.uid() IN (referrer_user_id, referred_user_id));

CREATE POLICY "Service role can manage referral codes"
  ON referral_codes FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can manage referrals"
  ON referrals FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can manage referral rewards"
  ON referral_rewards FOR ALL TO service_role USING (true);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_order ON subscriptions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_subscription ON subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status_month ON referral_rewards(status, payout_month);
