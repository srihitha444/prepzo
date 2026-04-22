# Prepzo — Crack Every Exam.

> Smart flashcards, timed MCQs, and spaced repetition for JEE, NEET & CUET.

**Tech Stack:** Next.js 16 · TypeScript · Tailwind CSS v4 · Supabase · Razorpay

---

## Quick Start

### 1. Clone & Install

```bash
cd prepzo
npm install
```

### 2. Environment Variables

Copy the example file:

```bash
cp .env.local.example .env.local
```

Fill in:

```env
# Supabase (from your Supabase project settings)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Razorpay (use test keys during development)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx

# Admin access (comma-separated emails)
ADMIN_EMAILS=admin@yoursite.com
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. In **Authentication > Settings**, enable **Email/Password** and **Google** OAuth
4. For Google OAuth, add `<your-vercel-url>/auth/callback` as a redirect URL

### 4. Seed the Database

```bash
npm run seed
```

This inserts ~100 questions and flashcards across JEE, NEET, and CUET.

### 5. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Manual Steps

1. Push code to GitHub
2. Import repo in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.local.example`
4. Deploy — `vercel.json` handles the rest

### After Deploy

1. Copy your Vercel URL (e.g., `https://prepzo.vercel.app`)
2. Add it to Supabase: **Authentication > URL Configuration > Site URL**
3. Add `https://prepzo.vercel.app/auth/callback` to **Redirect URLs**
4. Re-run the seed script with production env vars

---

## Project Structure

```
prepzo/
├── app/
│   ├── (public)/
│   │   └── page.tsx              # Landing page
│   ├── (app)/                    # Protected app routes
│   │   ├── layout.tsx            # Sidebar + BottomNav
│   │   ├── onboarding/page.tsx   # First-time setup
│   │   ├── dashboard/page.tsx    # Home with stats
│   │   ├── flashcards/page.tsx   # 3D flip cards
│   │   ├── quiz/page.tsx         # Infinite MCQ quiz
│   │   ├── decks/page.tsx        # Recall & Review decks
│   │   ├── progress/page.tsx     # Analytics
│   │   └── upgrade/page.tsx      # Razorpay checkout
│   ├── admin/page.tsx            # Admin panel
│   ├── auth/                     # Login, Signup, Callback
│   └── api/
│       ├── payment/create-order/ # Razorpay order creation
│       ├── payment/verify/       # Payment verification
│       └── questions/            # REST API for questions
├── components/
│   ├── ui/                       # Button, Card, Badge, Modal, Skeleton
│   ├── layout/                   # Sidebar, BottomNav, TopBar
│   ├── tour/                     # Interactive product tour
│   ├── flashcard/                # FlashCard with 3D flip
│   ├── quiz/                     # TimerRing, OptionButton, SessionSummary
│   └── payment/                  # PricingCard, PaywallModal
├── hooks/
│   ├── useAuth.ts
│   ├── useQuiz.ts                # Infinite questions + spaced repetition
│   ├── useFlashcards.ts          # Swipe gestures
│   └── useProgress.ts            # Analytics data
├── lib/
│   ├── supabase/                 # client.ts, server.ts, types.ts
│   ├── razorpay.ts
│   ├── questions.ts              # Fetch logic + spaced repetition
│   └── utils.ts
├── scripts/
│   └── seed.ts                   # Database seeder
└── supabase/
    └── schema.sql                # Full DB schema with RLS
```

---

## Features

| Feature | Free | Pro (₹99/mo) |
|---------|------|--------------|
| Daily MCQs | 15/day | Unlimited |
| Exams | 1 | JEE + NEET + CUET |
| Flashcards | Basic | Speed Mode |
| Analytics | Basic | Full |
| Weak topic detection | — | ✓ |

### Key Features
- **Infinite Questions**: Fetched in batches of 20, prefetched when 5 remain
- **Spaced Repetition**: Cards resurface based on correctness history
- **30-second Timer**: SVG ring animation per question
- **Negative Marking**: -1/3 for JEE/NEET, -0.25 for CUET
- **3D Flashcard Flip**: CSS transform rotateY animation
- **Swipe Gestures**: Touch events for mobile flashcard navigation
- **Product Tour**: Custom tooltip overlay after onboarding
- **Bottom Navigation**: Mobile-first layout with BottomNav
- **Razorpay**: Full checkout with server-side signature verification

---

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret) |
| `RAZORPAY_KEY_ID` | Razorpay key ID (secret, server-only) |
| `RAZORPAY_KEY_SECRET` | Razorpay secret (secret) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay key ID (public, for checkout) |
| `ADMIN_EMAILS` | Comma-separated admin email addresses |

---

## Razorpay Test Mode

Use test credentials from [Razorpay Dashboard](https://dashboard.razorpay.com) to test payments. Test card: `4111 1111 1111 1111`, any future expiry, any CVV.

---

Made with ❤️ for Indian students.
