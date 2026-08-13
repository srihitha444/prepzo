-- =============================================
-- PREPZO SUBSCRIPTION + REFERRAL ADDITIVE SETUP
-- Paste this in Supabase SQL Editor.
--
-- This version avoids destructive operations:
-- - No DROP POLICY
-- - No DROP TABLE
-- - No restrictive CHECK constraints on existing subscription data
-- - Keeps existing trial/creator/subscription rows untouched
--
-- Covers:
-- 1. Razorpay one-time payments
-- 2. Razorpay autopay/subscriptions
-- 3. Referral codes
-- 4. Referral commission ledger for manual payout
-- =============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- PYQ PROGRESS SUPPORT
-- =============================================

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_pyq
  ON quiz_sessions(user_id, is_pyq, completed_at DESC);

ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quiz_sessions'
      AND policyname = 'Users can manage own quiz sessions'
  ) THEN
    CREATE POLICY "Users can manage own quiz sessions"
      ON quiz_sessions FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quiz_sessions'
      AND policyname = 'Service role can manage quiz sessions'
  ) THEN
    CREATE POLICY "Service role can manage quiz sessions"
      ON quiz_sessions FOR ALL TO service_role
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;
END $$;

-- =============================================
-- ADMIN HELPER
-- =============================================

CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

INSERT INTO admin_users (email)
VALUES ('itssrihitha555@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- SUBSCRIPTIONS
-- =============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_subscription_id TEXT,
  plan TEXT,
  billing_mode TEXT,
  amount INTEGER,
  original_amount INTEGER,
  discount_amount INTEGER,
  discount_percent INTEGER,
  referral_code_id UUID,
  status TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_mode TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS original_amount INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS discount_amount INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS discount_percent INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referral_code_id UUID;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Fill only empty fields. Existing data is preserved.
UPDATE subscriptions
SET plan = COALESCE(plan, 'monthly'),
    billing_mode = COALESCE(billing_mode, 'one_time'),
    status = COALESCE(status, 'pending'),
    discount_amount = COALESCE(discount_amount, 0),
    discount_percent = COALESCE(discount_percent, 0)
WHERE plan IS NULL
   OR billing_mode IS NULL
   OR status IS NULL
   OR discount_amount IS NULL
   OR discount_percent IS NULL;

-- =============================================
-- REFERRAL CODES
-- =============================================

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  discount_percent INTEGER NOT NULL DEFAULT 10,
  commission_percent INTEGER NOT NULL DEFAULT 20,
  valid_months INTEGER NOT NULL DEFAULT 12,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_referral_code_id_fkey'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_referral_code_id_fkey
      FOREIGN KEY (referral_code_id) REFERENCES referral_codes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =============================================
-- REFERRALS
-- =============================================

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE RESTRICT,
  referrer_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  first_subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  activated_at TIMESTAMPTZ,
  commission_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- REFERRAL REWARDS / MANUAL PAYOUT LEDGER
-- =============================================

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
  status TEXT NOT NULL DEFAULT 'pending',
  payout_month DATE NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  notes TEXT
);

-- =============================================
-- RLS
-- =============================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
      AND policyname = 'Users can view own subscriptions'
  ) THEN
    CREATE POLICY "Users can view own subscriptions"
      ON subscriptions FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
      AND policyname = 'Users can create own pending subscriptions'
  ) THEN
    CREATE POLICY "Users can create own pending subscriptions"
      ON subscriptions FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
      AND policyname = 'Service role can manage subscriptions'
  ) THEN
    CREATE POLICY "Service role can manage subscriptions"
      ON subscriptions FOR ALL TO service_role
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND policyname = 'Admins can view admin users'
  ) THEN
    CREATE POLICY "Admins can view admin users"
      ON admin_users FOR SELECT TO authenticated
      USING (public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND policyname = 'Service role can manage admin users'
  ) THEN
    CREATE POLICY "Service role can manage admin users"
      ON admin_users FOR ALL TO service_role
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referral_codes'
      AND policyname = 'Users can view own referral code'
  ) THEN
    CREATE POLICY "Users can view own referral code"
      ON referral_codes FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referral_codes'
      AND policyname = 'Users can create own referral code'
  ) THEN
    CREATE POLICY "Users can create own referral code"
      ON referral_codes FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referral_codes'
      AND policyname = 'Users can update own referral code'
  ) THEN
    CREATE POLICY "Users can update own referral code"
      ON referral_codes FOR UPDATE TO authenticated
      USING (auth.uid() = user_id OR public.is_admin())
      WITH CHECK (auth.uid() = user_id OR public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referral_codes'
      AND policyname = 'Service role can manage referral codes'
  ) THEN
    CREATE POLICY "Service role can manage referral codes"
      ON referral_codes FOR ALL TO service_role
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referrals'
      AND policyname = 'Users can view own referrals'
  ) THEN
    CREATE POLICY "Users can view own referrals"
      ON referrals FOR SELECT TO authenticated
      USING (auth.uid() IN (referrer_user_id, referred_user_id) OR public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referrals'
      AND policyname = 'Admins can update referrals'
  ) THEN
    CREATE POLICY "Admins can update referrals"
      ON referrals FOR UPDATE TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referrals'
      AND policyname = 'Service role can manage referrals'
  ) THEN
    CREATE POLICY "Service role can manage referrals"
      ON referrals FOR ALL TO service_role
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referral_rewards'
      AND policyname = 'Users can view own referral rewards'
  ) THEN
    CREATE POLICY "Users can view own referral rewards"
      ON referral_rewards FOR SELECT TO authenticated
      USING (auth.uid() IN (referrer_user_id, referred_user_id) OR public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referral_rewards'
      AND policyname = 'Admins can update referral rewards'
  ) THEN
    CREATE POLICY "Admins can update referral rewards"
      ON referral_rewards FOR UPDATE TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referral_rewards'
      AND policyname = 'Service role can manage referral rewards'
  ) THEN
    CREATE POLICY "Service role can manage referral rewards"
      ON referral_rewards FOR ALL TO service_role
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;
END $$;

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_order ON subscriptions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment ON subscriptions(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_subscription ON subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_referral_code ON subscriptions(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer_month ON referral_rewards(referrer_user_id, payout_month);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status_month ON referral_rewards(status, payout_month);
