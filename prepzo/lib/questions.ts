import { createClient } from "./supabase/client";
import { getISTDate } from "./utils";
import type { Question, UserProgress } from "./supabase/types";

export const FREE_DAILY_LIMIT = 15;
export const PRO_SESSION_LIMIT = 20;
const PRO_BUCKETS = {
  recallDue: 5,
  newThisWeek: 5,
  unseen: 7,
  review: 3,
} as const;
type RecallFrequency = "daily" | "every2days" | "weekly";

const IMAGE_BUCKET = "pyq-assets";
const IMAGE_PATH_KEYS = [
  "question_inline_image_path",
  "option_a_image_path",
  "option_b_image_path",
  "option_c_image_path",
  "option_d_image_path",
] as const;

const IMAGE_URL_KEYS = {
  question_inline_image_path: "question_inline_image_url",
  option_a_image_path: "option_a_image_url",
  option_b_image_path: "option_b_image_url",
  option_c_image_path: "option_c_image_url",
  option_d_image_path: "option_d_image_url",
} as const;

async function attachSignedImageUrls(questions: Question[]): Promise<Question[]> {
  const paths = Array.from(new Set(
    questions.flatMap((question) =>
      IMAGE_PATH_KEYS.map((key) => question[key]).filter((path): path is string => Boolean(path))
    )
  ));

  if (paths.length === 0) return questions;

  const supabase = createClient();
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) {
    console.error("Error signing PYQ image URLs:", error);
    return questions;
  }

  const signedUrlByPath = new Map<string, string>();
  for (const item of data || []) {
    if (item.path && item.signedUrl) {
      signedUrlByPath.set(item.path, item.signedUrl);
    }
  }

  return questions.map((question) => {
    const next: Question = { ...question };
    for (const pathKey of IMAGE_PATH_KEYS) {
      const urlKey = IMAGE_URL_KEYS[pathKey];
      const path = question[pathKey];
      next[urlKey] = path ? signedUrlByPath.get(path) || null : null;
    }
    return next;
  });
}

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
  chapter?: string;
  pyqYear?: number;
  pyqOnly?: boolean;
  difficulty?: string;
  noteId?: string;
  questionType?: "mcq" | "descriptive";
}): Promise<Question[]> {
  const { ids, exam, subject, topic, chapter, pyqYear, pyqOnly, difficulty, noteId, questionType } = params;
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
  if (chapter) query = query.eq("chapter", chapter);
  if (pyqYear) query = query.eq("pyq_year", pyqYear);
  if (pyqOnly) query = query.eq("is_pyq", true);
  if (difficulty && difficulty !== "All") query = query.eq("difficulty", difficulty);
  if (noteId) query = query.eq("note_id", noteId);
  if (questionType) query = query.eq("question_type", questionType);

  const { data } = await query;
  const questions = (data || []) as Question[];
  const orderedQuestions = ids
    .map((id) => questions.find((question) => question.id === id))
    .filter((question): question is Question => Boolean(question));
  return attachSignedImageUrls(orderedQuestions);
}

export async function fetchQuestions(params: {
  exam: string;
  subject?: string;
  topic?: string;
  chapter?: string;
  pyqYear?: number;
  pyqOnly?: boolean;
  difficulty?: string;
  limit?: number;
  offset?: number;
  excludeIds?: string[];
  noteId?: string;
  questionType?: "mcq" | "descriptive";
}): Promise<Question[]> {
  const supabase = createClient();
  const { exam, subject, topic, chapter, pyqYear, pyqOnly, difficulty, limit = 20, offset = 0, excludeIds = [], noteId, questionType } = params;

  let query = supabase
    .from("questions")
    .select("*")
    .eq("exam", exam)
    .eq("is_active", true)
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (subject) query = query.eq("subject", subject);
  if (topic) query = query.eq("topic", topic);
  if (chapter) query = query.eq("chapter", chapter);
  if (pyqYear) query = query.eq("pyq_year", pyqYear);
  if (pyqOnly) query = query.eq("is_pyq", true);
  if (difficulty && difficulty !== "All") query = query.eq("difficulty", difficulty);
  if (excludeIds.length > 0) query = query.not("id", "in", `(${excludeIds.join(",")})`);
  if (noteId) query = query.eq("note_id", noteId);
  if (questionType) query = query.eq("question_type", questionType);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching questions:", error);
    return [];
  }
  return attachSignedImageUrls((data || []) as Question[]);
}

export async function fetchPrioritizedQuestions(params: {
  userId: string;
  exam: string;
  subject?: string;
  topic?: string;
  chapter?: string;
  pyqYear?: number;
  pyqOnly?: boolean;
  difficulty?: string;
  limit?: number;
  seenIds?: string[];
  plan?: "free" | "paid";
  fullPaper?: boolean;
  noteId?: string;
  questionType?: "mcq" | "descriptive";
}): Promise<Question[]> {
  const supabase = createClient();
  const { userId, exam, subject, topic, chapter, pyqYear, pyqOnly, difficulty, limit = PRO_SESSION_LIMIT, seenIds = [], plan = "paid", fullPaper = false, noteId, questionType } = params;

  const { data: progressRaw } = await supabase
    .from("user_progress")
    .select("question_id, deck_type, next_due_at, last_seen_at")
    .eq("user_id", userId);

  const progress = (progressRaw || []) as Array<{
    question_id: string;
    deck_type: "unseen" | "recall" | "review" | null;
    next_due_at: string | null;
    last_seen_at: string | null;
  }>;

  const progressIds = progress.map((p) => p.question_id);
  const baseQuery = () => {
    let query = supabase
      .from("questions")
      .select("*")
      .eq("exam", exam)
      .eq("is_active", true);

    if (subject) query = query.eq("subject", subject);
    if (topic) query = query.eq("topic", topic);
    if (chapter) query = query.eq("chapter", chapter);
    if (pyqYear) query = query.eq("pyq_year", pyqYear);
    if (pyqOnly) query = query.eq("is_pyq", true);
    if (difficulty && difficulty !== "All") query = query.eq("difficulty", difficulty);
    if (noteId) query = query.eq("note_id", noteId);
    if (questionType) query = query.eq("question_type", questionType);

    return query;
  };

  if (fullPaper) {
    const { data, error } = await baseQuery()
      .order("pyq_source_key", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("Error fetching PYQ paper:", error);
      return [];
    }

    return attachSignedImageUrls((data || []) as Question[]);
  }

  const excluded = new Set(seenIds);
  function addUnique(next: Question[], maxItems: number): Question[] {
    const added: Question[] = [];
    for (const question of next) {
      if (added.length >= maxItems) break;
      if (excluded.has(question.id)) continue;
      excluded.add(question.id);
      added.push(question);
    }
    return added;
  }

  async function fetchUnseen(params: {
    maxItems: number;
    newestThisWeek?: boolean;
    oldestFirst?: boolean;
  }): Promise<Question[]> {
    const { maxItems, newestThisWeek = false, oldestFirst = false } = params;
    if (maxItems <= 0) return [];

    let query = baseQuery();
    const allExcluded = Array.from(new Set([...progressIds, ...excluded]));
    if (allExcluded.length > 0) query = query.not("id", "in", `(${allExcluded.join(",")})`);

    if (newestThisWeek) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      query = query.gte("added_week", sevenDaysAgo).order("added_week", { ascending: false }).order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: oldestFirst });
    }

    const { data } = await query.limit(maxItems);
    return addUnique(await attachSignedImageUrls((data || []) as Question[]), maxItems);
  }

  if (plan === "free") {
    return fetchUnseen({ maxItems: limit, oldestFirst: true });
  }

  const now = Date.now();
  const recallDueIds = progress
    .filter((item) => item.deck_type === "recall" && item.next_due_at && new Date(item.next_due_at).getTime() <= now)
    .sort((a, b) => new Date(a.next_due_at || 0).getTime() - new Date(b.next_due_at || 0).getTime())
    .map((item) => item.question_id);
  const reviewIds = progress
    .filter((item) => item.deck_type === "review")
    .sort((a, b) => new Date(a.last_seen_at || 0).getTime() - new Date(b.last_seen_at || 0).getTime())
    .map((item) => item.question_id);

  const recallQuestions = addUnique(
    await fetchQuestionsByIds({ ids: recallDueIds, exam, subject, topic, chapter, pyqYear, pyqOnly, difficulty, noteId, questionType }),
    PRO_BUCKETS.recallDue
  );
  const newQuestions = await fetchUnseen({ maxItems: PRO_BUCKETS.newThisWeek, newestThisWeek: true });
  const unseenQuestions = await fetchUnseen({ maxItems: PRO_BUCKETS.unseen, oldestFirst: true });
  const reviewQuestions = addUnique(
    await fetchQuestionsByIds({ ids: reviewIds, exam, subject, topic, chapter, pyqYear, pyqOnly, difficulty, noteId, questionType }),
    PRO_BUCKETS.review
  );

  const result = [...recallQuestions, ...newQuestions, ...unseenQuestions, ...reviewQuestions];
  if (result.length >= limit) return result.slice(0, limit);

  const fill = await fetchUnseen({ maxItems: limit - result.length, oldestFirst: true });
  return [...result, ...fill].slice(0, limit);
}

export async function getTodayQuestionCount(userId: string, exam: string): Promise<number> {
  const supabase = createClient();
  // Use IST midnight as day boundary
  const istDate = getISTDate();
  const istMidnight = new Date(`${istDate}T00:00:00+05:30`).toISOString();

  const { count } = await supabase
    .from("user_progress")
    .select("*, questions!inner(exam)", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("questions.exam", exam)
    .gte("last_seen_at", istMidnight);

  return count || 0;
}

export async function recordAnswer(params: {
  userId: string;
  questionId: string;
  isCorrect: boolean;
  timeSeconds: number;
  recallFrequency?: RecallFrequency;
  isPyq?: boolean;
  pyqYear?: number;
  selectedOption?: string | null;
  skipped?: boolean;
  // Server routes (no browser session) pass in a server-scoped Supabase
  // client here instead of using the default browser client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any;
}): Promise<void> {
  const supabase = params.supabaseClient ?? createClient();
  const {
    userId,
    questionId,
    isCorrect,
    timeSeconds,
    recallFrequency = "daily",
    isPyq = false,
    pyqYear,
    selectedOption,
    skipped = false,
  } = params;

  if (isPyq) {
    const { error } = await supabase.from("pyq_question_attempts").upsert({
      user_id: userId,
      question_id: questionId,
      pyq_year: pyqYear || null,
      selected_option: selectedOption,
      is_correct: isCorrect,
      skipped,
      time_seconds: timeSeconds,
      attempted_at: new Date().toISOString(),
    }, { onConflict: "user_id,question_id" });

    if (error) {
      console.error("Error recording PYQ answer:", error);
      throw error;
    }
    return;
  }

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

  const { error } = await supabase.from("user_progress").upsert({
    user_id: userId,
    question_id: questionId,
    deck_type: deckType,
    times_seen: timesSeen,
    times_correct: timesCorrect,
    last_seen_at: new Date().toISOString(),
    next_due_at: nextDueAt,
    avg_time_seconds: avgTime,
  }, { onConflict: "user_id,question_id" });

  if (error) {
    console.error("Error recording answer:", error);
    throw error;
  }
}
