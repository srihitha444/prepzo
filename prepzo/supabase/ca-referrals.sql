-- Referral discounts and manual commission payouts for CA recurring subscriptions.
-- Run this in Supabase SQL Editor after ca-plans-and-metering.sql.

create table if not exists public.ca_referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z]{3,5}$'),
  status text not null default 'active' check (status in ('active','disabled')),
  discount_percent integer not null default 10 check (discount_percent = 10),
  commission_percent integer not null default 10 check (commission_percent = 10),
  valid_months integer not null default 12 check (valid_months > 0),
  created_at timestamptz not null default now()
);

alter table public.ca_referral_codes add column if not exists valid_months integer not null default 12 check (valid_months > 0);

create table if not exists public.ca_referrals (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.ca_referral_codes(id) on delete restrict,
  referrer_user_id uuid not null references public.profiles(id) on delete restrict,
  referred_user_id uuid not null unique references public.profiles(id) on delete restrict,
  referred_email text not null unique,
  ca_subscription_id uuid unique references public.ca_subscriptions(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','active','cancelled')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  commission_ends_at timestamptz,
  check (referrer_user_id <> referred_user_id)
);

alter table public.ca_referrals add column if not exists commission_ends_at timestamptz;

create table if not exists public.ca_referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.ca_referrals(id) on delete restrict,
  referrer_user_id uuid not null references public.profiles(id) on delete restrict,
  referred_user_id uuid not null references public.profiles(id) on delete restrict,
  ca_subscription_id uuid not null references public.ca_subscriptions(id) on delete restrict,
  razorpay_payment_id text not null,
  amount_paid integer not null,
  commission_amount integer not null,
  commission_percent integer not null default 10 check (commission_percent = 10),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending','approved','paid','void')),
  earned_at timestamptz not null default now(),
  paid_at timestamptz,
  payout_reference text,
  notes text
);

-- Keep this migration safe if the earlier version of this setup was already run.
alter table public.ca_referral_rewards drop constraint if exists ca_referral_rewards_referral_id_key;
alter table public.ca_referral_rewards drop constraint if exists ca_referral_rewards_ca_subscription_id_key;
alter table public.ca_referral_rewards add column if not exists razorpay_payment_id text;
create unique index if not exists ca_referral_rewards_payment_once
  on public.ca_referral_rewards(razorpay_payment_id);

alter table public.ca_subscriptions
  add column if not exists referral_code_id uuid references public.ca_referral_codes(id) on delete set null,
  add column if not exists original_first_amount integer,
  add column if not exists discount_amount integer not null default 0,
  add column if not exists first_payment_order_id text unique,
  add column if not exists first_payment_id text,
  add column if not exists referral_email text,
  add column if not exists referral_discount_percent integer not null default 0,
  add column if not exists referral_commission_percent integer not null default 0,
  add column if not exists mandate_authorized boolean not null default false;

-- App pricing offers these intervals; the original CA migration only allowed monthly/yearly.
do $$ begin
  if exists (select 1 from pg_constraint where conrelid = 'public.ca_subscriptions'::regclass and conname = 'ca_subscriptions_billing_cycle_check') then
    alter table public.ca_subscriptions drop constraint ca_subscriptions_billing_cycle_check;
  end if;
  alter table public.ca_subscriptions add constraint ca_subscriptions_billing_cycle_check
    check (billing_cycle in ('monthly','quarterly','half_yearly','yearly'));
end $$;

create unique index if not exists ca_subscriptions_referral_email_once
  on public.ca_subscriptions (lower(referral_email)) where referral_code_id is not null;
create index if not exists ca_referral_rewards_payable on public.ca_referral_rewards(status, earned_at);

alter table public.ca_referral_codes enable row level security;
alter table public.ca_referrals enable row level security;
alter table public.ca_referral_rewards enable row level security;

drop policy if exists "service manages CA referral codes" on public.ca_referral_codes;
create policy "service manages CA referral codes" on public.ca_referral_codes
  for all to service_role using (true) with check (true);
drop policy if exists "service manages CA referrals" on public.ca_referrals;
create policy "service manages CA referrals" on public.ca_referrals
  for all to service_role using (true) with check (true);
drop policy if exists "service manages CA referral rewards" on public.ca_referral_rewards;
create policy "service manages CA referral rewards" on public.ca_referral_rewards
  for all to service_role using (true) with check (true);

-- Manual code creation: replace the code, creator email, and validity months.
-- The creator must already have a profile (sign in once first).
-- A code can be redeemed by multiple different email addresses until it expires.
-- INSERT INTO public.ca_referral_codes (user_id, code, valid_months)
-- SELECT p.id, 'MAYA', 6 FROM public.profiles p
-- JOIN auth.users u ON u.id = p.id
-- WHERE lower(u.email) = lower('creator@example.com');
