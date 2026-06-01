import { createClient } from "./supabase/client";
import { getISTDate } from "./utils";
import type { Question, UserProgress } from "./supabase/types";

export const FREE_DAILY_LIMIT = 15;
type RecallFrequency = "daily" | "every2days" | "weekly";

function getRecallIntervals(frequency: RecallFrequency): Array<number | null> {
  if (frequency === "weekly") return [7, null];
  if (frequency === "every2days") return [2, 7, 7];
  return [1, 3, 3];
}

function addDays(days: number): string {
  const nextDue = new Date();
  nextDue.setTime(nextDue.getTime() + days * 24 * 60 * 60 * 1000);
  return nextDue.toISOString();
}

async function fetchQuestionsByIds(params: {
  ids: string[];
  exam: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
}): Promise<Question[]> {
  const { ids, exam, subject, topic, difficulty } = params;
  if (ids.length === 0) return [];

  const supabase = createClient();
  let query = supabase
    .from("questions")
    .select("*")
    .in("id", ids)
    .eq("exam", exam)
    .eq("is_active", true);

  if (subject) query = query.eq("subject", subject);
  if (topic) query = query.eq("topic", topic);
  if (difficulty && difficulty !== "All") query = query.eq("difficulty", difficulty);

  const { data } = await query;
  const questions = (data || []) as Question[];
  return ids
    .map((id) => questions.find((question) => question.id === id))
    .filter((question): question is Question => Boolean(question));
}

export async function fetchQuestions(params: {
  exam: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
  limit?: number;
  offset?: number;
  excludeIds?: string[];
}): Promise<Question[]> {
  const supabase = createClient();
  const { exam, subject, topic, difficulty, limit = 20, offset = 0, excludeIds = [] } = params;

  let query = supabase
    .from("questions")
    .select("*")
    .eq("exam", exam)
    .eq("is_active", true)
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (subject) query = query.eq("subject", subject);
  if (topic) query = query.eq("topic", topic);
  if (difficulty && difficulty !== "All") query = query.eq("difficulty", difficulty);
  if (excludeIds.length > 0) query = query.not("id", "in", `(${excludeIds.join(",")})`);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching questions:", error);
    return [];
  }
  return (data || []) as Question[];
}

export async function fetchPrioritizedQuestions(params: {
  userId: string;
  exam: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
  limit?: number;
  seenIds?: string[];
}): Promise<Question[]> {
  const supabase = createClient();
  const { userId, exam, subject, topic, difficulty, limit = 20, seenIds = [] } = params;

  const { data: progressRaw } = await supabase
    .from("user_progress")
    .select("question_id, deck_type, next_due_at")
    .eq("user_id", userId);

  const progress = (progressRaw || []) as Array<{
    question_id: string;
    deck_type: "unseen" | "recall" | "review" | null;
    next_due_at: string | null;
  }>;
  const now = Date.now();
  const recallDueIds = progress
    .filter((item) => item.deck_type === "recall" && item.next_due_at && new Date(item.next_due_at).getTime() <= now)
    .map((item) => item.question_id);
  const reviewIds = progress
    .filter((item) => item.deck_type === "review")
    .map((item) => item.question_id);
  const progressIds = progress.map((p) => p.question_id);
  const excludeIds = Array.from(new Set([...seenIds, ...progressIds]));
  const recallQuestions = await fetchQuestionsByIds({ ids: recallDueIds, exam, subject, topic, difficulty });
  const recallUsedIds = recallQuestions.map((question) => question.id);

  // Session order: recall due first, fresh unseen next, review deck last.
  let unseenQuery = supabase
    .from("questions")
    .select("*")
    .eq("exam", exam)
    .eq("is_active", true);

  if (subject) unseenQuery = unseenQuery.eq("subject", subject);
  if (topic) unseenQuery = unseenQuery.eq("topic", topic);
  if (difficulty && difficulty !== "All") unseenQuery = unseenQuery.eq("difficulty", difficulty);

  if (excludeIds.length > 0) {
    unseenQuery = unseenQuery.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data: unseenQuestionsRaw } = await unseenQuery
    .limit(Math.max(limit - recallQuestions.length, 0))
    .order("created_at", { ascending: false });

  const unseenQuestions = (unseenQuestionsRaw || []) as Question[];
  const remaining = Math.max(limit - recallQuestions.length - unseenQuestions.length, 0);
  const reviewQuestions = remaining > 0
    ? await fetchQuestionsByIds({
        ids: reviewIds.filter((id) => !recallUsedIds.includes(id)),
        exam,
        subject,
        topic,
        difficulty,
      })
    : [];

  return [...recallQuestions, ...unseenQuestions, ...reviewQuestions.slice(0, remaining)].slice(0, limit);
}

export async function getTodayQuestionCount(userId: string): Promise<number> {
  const supabase = createClient();
  // Use IST midnight as day boundary
  const istDate = getISTDate();
  const istMidnight = new Date(`${istDate}T00:00:00+05:30`).toISOString();

  const { count } = await supabase
    .from("user_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("last_seen_at", istMidnight);

  return count || 0;
}

export async function recordAnswer(params: {
  userId: string;
  questionId: string;
  isCorrect: boolean;
  timeSeconds: number;
  recallFrequency?: RecallFrequency;
}): Promise<void> {
  const supabase = createClient();
  const { userId, questionId, isCorrect, timeSeconds, recallFrequency = "daily" } = params;

  const { data: existingRaw } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("question_id", questionId)
    .single();

  const existing = existingRaw as UserProgress | null;

  const deckType = isCorrect ? "recall" : "review";
  const timesCorrect = (existing?.times_correct || 0) + (isCorrect ? 1 : 0);
  const timesSeen = (existing?.times_seen || 0) + 1;
  const avgTime = existing?.avg_time_seconds
    ? Math.round((existing.avg_time_seconds * (timesSeen - 1) + timeSeconds) / timesSeen)
    : timeSeconds;

  const intervals = getRecallIntervals(recallFrequency);
  const interval = isCorrect ? intervals[Math.min(timesCorrect - 1, intervals.length - 1)] : 0.5;
  const nextDueAt = interval === null ? null : addDays(interval);

  await supabase.from("user_progress").upsert({
    user_id: userId,
    question_id: questionId,
    deck_type: deckType,
    times_seen: timesSeen,
    times_correct: timesCorrect,
    last_seen_at: new Date().toISOString(),
    next_due_at: nextDueAt,
    avg_time_seconds: avgTime,
  }, { onConflict: "user_id,question_id" });
}
