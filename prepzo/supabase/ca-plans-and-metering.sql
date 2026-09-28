-- ============================================================================
-- CA PLATFORM — PAID TIERS, USAGE METERING, SUBSCRIPTIONS
-- ============================================================================
-- Every schema change for pricing in one file. Paste into one Supabase SQL
-- Editor query and run once. Idempotent throughout — safe to re-run.
--
-- CA shipped free on purpose (Phase 10 stripped the pricing section and the
-- Razorpay checkout, and made limits unconditional). This reintroduces paid
-- tiers: three plans, a metered allowance per feature, and subscriptions.
--
-- Read lib/ca/plans.ts alongside this — that file holds the actual numbers.
-- Nothing here encodes a limit, deliberately: caps live in application code so
-- changing a price or an allowance never needs a migration.
-- ============================================================================


-- ============================================================================
-- 1. THREE PLANS
-- ============================================================================

-- profiles.plan was CHECK (plan IN ('free','paid')) from the NEET era. CA needs
-- 'mid' and 'premium'. 'paid' is kept in the allowed set ONLY so existing rows
-- don't violate the constraint — lib/ca/plans.ts::getPlan() treats any
-- unrecognised value (including 'paid') as Free, so nobody is silently granted
-- paid limits by a legacy value.

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'mid', 'premium', 'paid'));


-- ============================================================================
-- 2. USAGE METERING
-- ============================================================================

-- One row per (user, feature, period). `period_start` is the first instant of
-- the window — the first of the month for monthly features, midnight for the
-- daily one (AI Teacher messages) — so a new window simply creates a new row
-- and old rows become an audit trail rather than something to reset.
--
-- Feature keys and their windows are defined in lib/ca/plans.ts
-- (MeteredFeature / FEATURE_PERIOD). Not constrained here on purpose: adding a
-- metered feature shouldn't require a migration.

create table if not exists ca_usage_counters (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  feature text not null,
  period_start timestamptz not null,
  used integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, feature, period_start)
);

alter table ca_usage_counters enable row level security;

-- Students may READ their own usage (the UI shows "3 of 15 uploads used") but
-- may never write it — quota is consumed server-side through the function
-- below, running as the service role.
drop policy if exists "users_read_own_usage" on ca_usage_counters;
create policy "users_read_own_usage"
  on ca_usage_counters for select using (auth.uid() = user_id);

drop policy if exists "service_manage_usage" on ca_usage_counters;
create policy "service_manage_usage"
  on ca_usage_counters for all to service_role using (true);

create index if not exists idx_usage_user_feature on ca_usage_counters(user_id, feature, period_start);


-- Atomic check-and-increment. This must be a single statement, not a read
-- followed by a write: two uploads fired at the same moment would both read
-- "1 used" and both proceed, letting a student past their cap. The INSERT ..
-- ON CONFLICT .. DO UPDATE with a WHERE clause performs the comparison inside
-- the same statement that increments, so exactly one of the two wins.
--
-- Returns the row's new `used` value on success, or NULL when the cap is
-- already reached — the caller treats NULL as "quota exhausted".

create or replace function ca_consume_quota(
  p_user_id uuid,
  p_feature text,
  p_period_start timestamptz,
  p_cap integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  insert into ca_usage_counters (user_id, feature, period_start, used)
  values (p_user_id, p_feature, p_period_start, 1)
  on conflict (user_id, feature, period_start) do update
    set used = ca_usage_counters.used + 1,
        updated_at = now()
    where ca_usage_counters.used < p_cap
  returning used into v_used;

  -- No row returned means the ON CONFLICT WHERE filtered it out: already at
  -- or over the cap. (A fresh INSERT always succeeds, so a cap of 0 is
  -- handled by the caller refusing before it ever calls this.)
  return v_used;
end;
$$;

-- Refund a consumed unit when the action it paid for failed afterwards (an
-- upload whose processing died, a cancelled note). Never drops below zero.
create or replace function ca_release_quota(
  p_user_id uuid,
  p_feature text,
  p_period_start timestamptz
)
returns void
language sql
security definer
set search_path = public
as $$
  update ca_usage_counters
     set used = greatest(0, used - 1), updated_at = now()
   where user_id = p_user_id and feature = p_feature and period_start = p_period_start;
$$;


-- ============================================================================
-- 3. SUBSCRIPTIONS
-- ============================================================================

-- Deliberately a new table rather than reusing the NEET-era `subscriptions`,
-- whose CHECK (plan IN ('monthly')) and referral columns describe a different
-- product. That table is left untouched.
--
-- One row per purchase. Renewal inserts a new row rather than mutating the old
-- one, so billing history survives — profiles.plan is the fast path for "what
-- can this user do right now", and this table is the record of why.

create table if not exists ca_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  plan text not null check (plan in ('mid', 'premium')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  -- Paise, as charged. Stored so a later price change never rewrites history.
  amount integer not null,
  -- 'halted' is Razorpay's state after it has retried a failed renewal and
  -- given up: the mandate still exists but is no longer charging, so access
  -- ends while the row stays distinguishable from a deliberate cancellation.
  status text not null default 'pending'
    check (status in ('pending', 'active', 'failed', 'cancelled', 'expired', 'halted')),
  razorpay_subscription_id text,
  razorpay_plan_id text,
  razorpay_payment_id text,
  -- Set when the student cancels. Access continues to current_period_end —
  -- they paid for that period — and resolvePlan() expires them after it.
  cancel_requested_at timestamptz,
  -- Proof that the student accepted the Terms at the moment they authorised a
  -- recurring mandate. For an auto-renewing plan this is the acceptance most
  -- worth being able to evidence later, so it is recorded per purchase rather
  -- than once per account, along with which version was shown.
  terms_accepted_at timestamptz,
  terms_version text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table ca_subscriptions enable row level security;

drop policy if exists "users_read_own_subscriptions" on ca_subscriptions;
create policy "users_read_own_subscriptions"
  on ca_subscriptions for select using (auth.uid() = user_id);

-- No user INSERT/UPDATE policy: a student must never be able to write their
-- own subscription row. Only the payment-verification and webhook routes do,
-- through the service role, after checking Razorpay's signature.
drop policy if exists "service_manage_subscriptions" on ca_subscriptions;
create policy "service_manage_subscriptions"
  on ca_subscriptions for all to service_role using (true);

alter table ca_subscriptions add column if not exists terms_accepted_at timestamptz;
alter table ca_subscriptions add column if not exists terms_version text;

create index if not exists idx_ca_subs_user on ca_subscriptions(user_id);
create index if not exists idx_ca_subs_rzp on ca_subscriptions(razorpay_subscription_id);
create index if not exists idx_ca_subs_expiry on ca_subscriptions(status, current_period_end);


-- ============================================================================
-- 4. RAZORPAY PLAN CACHE
-- ============================================================================

-- Recurring billing needs a Razorpay "plan" object per price point, and those
-- are immutable once created — changing a price means creating a new one.
-- Rather than four hand-managed dashboard plans and four more env vars, the
-- app creates each plan on first use and remembers its id here, keyed by the
-- amount as well as the tier, so raising a price transparently creates a new
-- Razorpay plan instead of silently charging the old one.

create table if not exists ca_razorpay_plans (
  id uuid default gen_random_uuid() primary key,
  plan text not null check (plan in ('mid', 'premium')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  amount integer not null,
  razorpay_plan_id text not null,
  created_at timestamptz default now(),
  unique (plan, billing_cycle, amount)
);

alter table ca_razorpay_plans enable row level security;

-- Internal billing plumbing; no student ever reads it.
drop policy if exists "service_manage_razorpay_plans" on ca_razorpay_plans;
create policy "service_manage_razorpay_plans"
  on ca_razorpay_plans for all to service_role using (true);


-- ============================================================================
-- 5. MOCK TEST ATTEMPTS — CLOSE THE METER BYPASS
-- ============================================================================

-- ca_mock_test_attempts was created with a single `for all using (auth.uid()
-- = user_id)` policy, so the browser could INSERT its own attempt rows
-- directly. That made the mock-test allowance unenforceable: a student could
-- skip /api/ca/mock-tests/start (which charges the quota) and still record
-- attempts by writing to the table.
--
-- Now the server owns the whole lifecycle. /start consumes the quota AND
-- creates the row; /finish fills in the score. An attempt therefore cannot
-- exist unless the server created it, and creating it costs quota. Students
-- keep SELECT so History and the papers list still work.

alter table ca_mock_test_attempts add column if not exists started_at timestamptz default now();

-- completed_at is left null by /start and set by /finish, so an abandoned
-- test is distinguishable from a finished one. Readers filter on it.
create index if not exists idx_mock_attempts_user_completed
  on ca_mock_test_attempts(user_id, completed_at);

drop policy if exists "users_manage_own_mock_attempts" on ca_mock_test_attempts;

drop policy if exists "users_read_own_mock_attempts" on ca_mock_test_attempts;
create policy "users_read_own_mock_attempts"
  on ca_mock_test_attempts for select using (auth.uid() = user_id);

drop policy if exists "service_manage_mock_attempts" on ca_mock_test_attempts;
create policy "service_manage_mock_attempts"
  on ca_mock_test_attempts for all to service_role using (true);
