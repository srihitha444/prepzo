-- ============================================================================
-- CA PLATFORM — RENAME THE 'mid' PLAN TO 'pro'
-- ============================================================================
-- Run this ONE file in the Supabase SQL Editor. Do NOT re-run
-- ca-plans-and-metering.sql: it has already been applied, and this file
-- carries the delta. Idempotent and safe to re-run.
--
-- The middle tier was named "Mid" and is now "Pro". Everything else about the
-- rename lives in lib/ca/plans.ts; this file only moves the stored values and
-- the CHECK constraints that would otherwise reject them.
--
-- Order matters here. Each constraint is widened to accept BOTH the old and
-- new value, the data is migrated, and only then is the constraint narrowed to
-- the new value alone. Dropping straight to ('pro','premium') while rows still
-- said 'mid' would fail the constraint and abort the whole script.
--
-- Note on lib/ca/plans.ts::getPlan(): it fails closed, so any row still
-- holding 'mid' after this runs is treated as Free rather than being granted
-- paid limits. A missed row costs a user their paid access — visible and
-- fixable — rather than silently handing out entitlements.
-- ============================================================================


-- ============================================================================
-- 1. profiles.plan
-- ============================================================================

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'mid', 'pro', 'premium', 'paid'));

update public.profiles set plan = 'pro' where plan = 'mid';

-- 'paid' stays permitted only so pre-existing NEET-era rows remain valid;
-- getPlan() treats it as Free. 'mid' is now gone for good.
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'premium', 'paid'));


-- ============================================================================
-- 2. ca_subscriptions.plan
-- ============================================================================

alter table public.ca_subscriptions drop constraint if exists ca_subscriptions_plan_check;
alter table public.ca_subscriptions
  add constraint ca_subscriptions_plan_check
  check (plan in ('mid', 'pro', 'premium'));

update public.ca_subscriptions set plan = 'pro' where plan = 'mid';

alter table public.ca_subscriptions drop constraint if exists ca_subscriptions_plan_check;
alter table public.ca_subscriptions
  add constraint ca_subscriptions_plan_check
  check (plan in ('pro', 'premium'));


-- ============================================================================
-- 3. ca_razorpay_plans.plan
-- ============================================================================

-- Cached Razorpay plan objects are keyed by (plan, billing_cycle, amount).
-- Renaming the tier here keeps an already-created Razorpay plan reusable
-- instead of orphaning it and creating a duplicate at the same price.

alter table public.ca_razorpay_plans drop constraint if exists ca_razorpay_plans_plan_check;
alter table public.ca_razorpay_plans
  add constraint ca_razorpay_plans_plan_check
  check (plan in ('mid', 'pro', 'premium'));

update public.ca_razorpay_plans set plan = 'pro' where plan = 'mid';

alter table public.ca_razorpay_plans drop constraint if exists ca_razorpay_plans_plan_check;
alter table public.ca_razorpay_plans
  add constraint ca_razorpay_plans_plan_check
  check (plan in ('pro', 'premium'));


-- ============================================================================
-- 4. CHECK NOTHING WAS LEFT BEHIND
-- ============================================================================
-- Should return three rows, all with remaining = 0.

select 'profiles' as table_name, count(*) as remaining from public.profiles where plan = 'mid'
union all
select 'ca_subscriptions', count(*) from public.ca_subscriptions where plan = 'mid'
union all
select 'ca_razorpay_plans', count(*) from public.ca_razorpay_plans where plan = 'mid';
