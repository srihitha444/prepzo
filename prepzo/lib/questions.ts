import { createClient } from "./supabase/client";
import { getISTDate } from "./utils";
import type { Question, UserProgress } from "./supabase/types";

export const FREE_DAILY_LIMIT = 15;

export async function fetchQuestions(params: {
  exam: string;
  subject?: string;
  difficulty?: string;
  limit?: number;
  offset?: number;
  excludeIds?: string[];
}): Promise<Question[]> {
  const supabase = createClient();
  const { exam, subject, difficulty, limit = 20, offset = 0, excludeIds = [] } = params;

  let query = supabase
    .from("questions")
    .select("*")
    .eq("exam", exam)
    .eq("is_active", true)
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (subject) query = query.eq("subject", subject);
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
  difficulty?: string;
  limit?: number;
  seenIds?: string[];
}): Promise<Question[]> {
  const supabase = createClient();
  const { userId, exam, subject, difficulty, limit = 20, seenIds = [] } = params;

  // 1. Get due recall/review cards first
  const { data: dueProgressRaw } = await supabase
    .from("user_progress")
    .select("question_id, deck_type")
    .eq("user_id", userId)
    .lte("next_due_at", new Date().toISOString())
    .in("deck_type", ["recall", "review"])
    .limit(10);

  const dueProgress = (dueProgressRaw || []) as Array<{ question_id: string; deck_type: string }>;
  const dueIds = dueProgress.map((p) => p.question_id);

  // 2. Get unseen questions (not in user_progress at all)
  let unseenQuery = supabase
    .from("questions")
    .select("*")
    .eq("exam", exam)
    .eq("is_active", true);

  if (subject) unseenQuery = unseenQuery.eq("subject", subject);
  if (difficulty && difficulty !== "All") unseenQuery = unseenQuery.eq("difficulty", difficulty);

  const allExclude = [...seenIds, ...dueIds];
  if (allExclude.length > 0) {
    unseenQuery = unseenQuery.not("id", "in", `(${allExclude.join(",")})`);
  }

  const { data: unseenQuestionsRaw } = await unseenQuery
    .limit(limit)
    .order("created_at", { ascending: false });
  const unseenQuestions = (unseenQuestionsRaw || []) as Question[];

  // 3. Fetch the due questions if we have them
  let dueQuestions: Question[] = [];
  if (dueIds.length > 0) {
    const { data } = await supabase
      .from("questions")
      .select("*")
      .in("id", dueIds)
      .eq("is_active", true);
    dueQuestions = (data || []) as Question[];
  }

  // 4. Combine: due first, then unseen, fill remaining with random
  const combined = [...dueQuestions, ...unseenQuestions];
  const remaining = limit - combined.length;

  if (remaining > 0 && seenIds.length > 0) {
    let fallbackQuery = supabase
      .from("questions")
      .select("*")
      .eq("exam", exam)
      .eq("is_active", true);
    if (subject) fallbackQuery = fallbackQuery.eq("subject", subject);

    const allUsed = [...seenIds, ...combined.map((q) => q.id)];
    if (allUsed.length > 0) {
      fallbackQuery = fallbackQuery.not("id", "in", `(${allUsed.join(",")})`);
    }
    const { data: fallbackRaw } = await fallbackQuery.limit(remaining);
    combined.push(...((fallbackRaw || []) as Question[]));
  }

  return combined.slice(0, limit);
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
}): Promise<void> {
  const supabase = createClient();
  const { userId, questionId, isCorrect, timeSeconds } = params;

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

  // Calculate next due date using spaced repetition
  const intervals = isCorrect ? [1, 3, 7, 14, 30, 60] : [0.5, 1, 2];
  const idx = Math.min(timesCorrect - (isCorrect ? 1 : 0), intervals.length - 1);
  const daysUntilDue = intervals[Math.max(0, idx)];
  const nextDue = new Date();
  nextDue.setTime(nextDue.getTime() + daysUntilDue * 24 * 60 * 60 * 1000);

  await supabase.from("user_progress").upsert({
    user_id: userId,
    question_id: questionId,
    deck_type: deckType,
    times_seen: timesSeen,
    times_correct: timesCorrect,
    last_seen_at: new Date().toISOString(),
    next_due_at: nextDue.toISOString(),
    avg_time_seconds: avgTime,
  });
}
