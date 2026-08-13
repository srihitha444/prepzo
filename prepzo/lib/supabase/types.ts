export type Exam = "NEET" | "CA";
export type Plan = "free" | "paid";
export type DeckType = "unseen" | "recall" | "review";
export type Difficulty = "Easy" | "Medium" | "Hard";

export interface Profile {
  id: string;
  name: string | null;
  exam: Exam | null;
  survey_current_stage: string | null;
  survey_target_exams: string[] | null;
  survey_completed_at: string | null;
  ca_level: "Foundation" | "Intermediate" | "Final" | null;
  ca_groups: string[] | null;
  ca_papers: string[] | null;
  ca_target_attempt_date: string | null;
  plan: Plan;
  daily_goal: number;
  streak: number;
  longest_streak: number;
  recall_setting: string;
  last_active: string | null;
  tour_completed: boolean;
  created_at: string;
}

export type QuestionType = "mcq" | "descriptive";
export type ContentType = "text" | "table" | "formula" | "legal" | "diagram";
export type FlashcardType = "definition" | "section" | "formula" | "accounting_rule" | "standard" | "comparison";

export interface Question {
  id: string;
  exam: Exam;
  subject: string;
  topic: string | null;
  chapter: string | null;
  subtopic: string | null;
  is_pyq: boolean;
  pyq_year: number | null;
  question_text: string;
  question_text_before_image: string | null;
  question_inline_image_path: string | null;
  question_inline_image_url?: string | null;
  question_text_after_image: string | null;
  option_a: string | null;
  option_a_image_path: string | null;
  option_a_image_url?: string | null;
  option_b: string | null;
  option_b_image_path: string | null;
  option_b_image_url?: string | null;
  option_c: string | null;
  option_c_image_path: string | null;
  option_c_image_url?: string | null;
  option_d: string | null;
  option_d_image_path: string | null;
  option_d_image_url?: string | null;
  correct_option: string | null;
  explanation: string | null;
  difficulty: Difficulty | null;
  is_active: boolean;
  added_week: string | null;
  created_at: string;
  // CA-only fields (see supabase/ca-notes-pipeline-schema.sql). Null for NEET.
  question_type: QuestionType;
  paper: string | null;
  content_type: ContentType | null;
  marks: number | null;
  model_answer: string | null;
  mark_allocation: unknown;
  negative_marking_value: number;
  section_references: string[] | null;
  note_id: string | null;
  block_id: string | null;
}

export interface Flashcard {
  id: string;
  exam: Exam;
  subject: string;
  topic: string | null;
  front_text: string;
  back_text: string;
  is_active: boolean;
  added_week: string | null;
  created_at: string;
  // CA-only fields (see supabase/ca-notes-pipeline-schema.sql). Null for NEET.
  flashcard_type: FlashcardType | null;
  paper: string | null;
  section_reference: string | null;
  note_id: string | null;
  block_id: string | null;
}

export interface UserProgress {
  id: string;
  user_id: string;
  question_id: string;
  deck_type: DeckType | null;
  times_seen: number;
  times_correct: number;
  last_seen_at: string | null;
  next_due_at: string | null;
  avg_time_seconds: number | null;
}

export interface QuizSession {
  id: string;
  user_id: string;
  exam: Exam;
  subject: string | null;
  topic: string | null;
  is_pyq: boolean | null;
  pyq_year: number | null;
  total_questions: number | null;
  correct: number | null;
  wrong: number | null;
  skipped: number | null;
  avg_time_seconds: number | null;
  completed_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_subscription_id: string | null;
  plan: "monthly" | null;
  amount: number | null;
  original_amount: number | null;
  discount_amount: number | null;
  discount_percent: number | null;
  referral_code_id: string | null;
  status: "pending" | "active" | "failed" | "cancelled" | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  status: "active" | "disabled" | null;
  discount_percent: number;
  commission_percent: number;
  valid_months: number;
  expires_at: string | null;
  created_at: string;
}

export interface Referral {
  id: string;
  code_id: string;
  referrer_user_id: string;
  referred_user_id: string;
  first_subscription_id: string | null;
  status: "pending" | "active" | "expired" | "cancelled" | null;
  activated_at: string | null;
  commission_ends_at: string | null;
  created_at: string;
}

export interface ReferralReward {
  id: string;
  referral_id: string;
  subscription_id: string;
  referrer_user_id: string;
  referred_user_id: string;
  amount_paid: number;
  commission_amount: number;
  commission_percent: number;
  currency: string;
  status: "pending" | "approved" | "paid" | "void" | null;
  payout_month: string;
  earned_at: string;
  paid_at: string | null;
  notes: string | null;
}

export interface UserFlashcardProgress {
  id: string;
  user_id: string;
  flashcard_id: string;
  deck_type: DeckType | null;
  times_seen: number;
  last_seen_at: string | null;
  next_due_at: string | null;
}
