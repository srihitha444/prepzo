export type Exam = "JEE" | "NEET" | "CUET";
export type Plan = "free" | "paid";
export type DeckType = "unseen" | "recall" | "review";
export type Difficulty = "Easy" | "Medium" | "Hard";

export interface Profile {
  id: string;
  name: string | null;
  exam: Exam | null;
  plan: Plan;
  daily_goal: number;
  streak: number;
  last_active: string | null;
  tour_completed: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  exam: Exam;
  subject: string;
  topic: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string | null;
  difficulty: Difficulty | null;
  is_active: boolean;
  created_at: string;
}

export interface Flashcard {
  id: string;
  exam: Exam;
  subject: string;
  topic: string | null;
  front_text: string;
  back_text: string;
  is_active: boolean;
  created_at: string;
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
  plan: "monthly" | "yearly" | null;
  amount: number | null;
  status: "pending" | "active" | "failed" | "cancelled" | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
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
