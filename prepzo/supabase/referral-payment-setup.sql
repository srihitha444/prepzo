-- =============================================
-- PREPZO REFERRAL + PAYMENT SETUP ONLY
-- Run this in Supabase SQL Editor if you do not want
-- to paste the full sql-editor-setup.sql file.
-- Safe to run more than once.
-- =============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Admin helper used by the RLS policies below.
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

-- Replace or add your admin email here if needed.
INSERT INTO admin_users (email)
VALUES ('itssrihitha555@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- Referral codes belong to the user sharing the code.
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

-- Add referral/discount fields to the existing subscriptions table.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS original_amount INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referral_code_id UUID;

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

-- One row per referred user. Commission is valid for one year after activation.
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

-- Ledger of commission that you manually pay at month end / day 1.
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

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role can manage admin users" ON admin_users;
CREATE POLICY "Service role can manage admin users"
  ON admin_users FOR ALL TO service_role
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_subscription ON subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_referral_code ON subscriptions(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer_month ON referral_rewards(referrer_user_id, payout_month);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status_month ON referral_rewards(status, payout_month);
