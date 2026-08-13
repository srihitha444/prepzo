"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Flashcard } from "@/lib/supabase/types";
import toast from "react-hot-toast";

export const FREE_DAILY_FC_LIMIT = 5;
export const FREE_FLASHCARD_SESSION_LIMIT = 5;
export const PRO_FLASHCARD_SESSION_LIMIT = 20;

const PRO_BUCKETS = {
  recallDue: 5,
  newThisWeek: 5,
  unseen: 7,
  review: 3,
} as const;

type RecallFrequency = "daily" | "every2days" | "weekly";

interface UseFlashcardsOptions {
  exam: string;
  subject?: string;
  userId: string;
  plan: "free" | "paid";
  sessionGoal?: number;
  enabled?: boolean;
  noteId?: string;
  topic?: string;
}

function getFlashcardRecallFrequency(): RecallFrequency {
  try {
    const prefs = JSON.parse(localStorage.getItem("prepzo_prefs") || "{}");
    return prefs.flashcardRecallFrequency || prefs.recallFrequency || "daily";
  } catch {
    return "daily";
  }
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

async function fetchFlashcardsByIds(params: {
  ids: string[];
  exam: string;
  subject?: string;
  noteId?: string;
  topic?: string;
}): Promise<Flashcard[]> {
  const { ids, exam, subject, noteId, topic } = params;
  if (ids.length === 0) return [];

  const supabase = createClient();
  let query = supabase
    .from("flashcards")
    .select("*")
    .in("id", ids)
    .eq("exam", exam)
    .eq("is_active", true);

  if (subject) query = query.eq("subject", subject);
  if (noteId) query = query.eq("note_id", noteId);
  if (topic) query = query.eq("topic", topic);

  const { data } = await query;
  const cards = (data || []) as Flashcard[];
  return ids
    .map((id) => cards.find((card) => card.id === id))
    .filter((card): card is Flashcard => Boolean(card));
}

export function useFlashcards({ exam, subject, userId, plan, sessionGoal, enabled = true, noteId, topic }: UseFlashcardsOptions) {
  const isFree = plan !== "paid";
  const sessionLimit = isFree ? FREE_FLASHCARD_SESSION_LIMIT : Math.max(1, sessionGoal || PRO_FLASHCARD_SESSION_LIMIT);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [recallCount, setRecallCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const sessionLoggedRef = useRef(false);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: progressRaw } = await supabase
      .from("user_flashcard_progress")
      .select("flashcard_id, deck_type, next_due_at, last_seen_at")
      .eq("user_id", userId);

    const progress = (progressRaw || []) as Array<{
      flashcard_id: string;
      deck_type: "unseen" | "recall" | "review" | null;
      next_due_at: string | null;
      last_seen_at: string | null;
    }>;

    const progressIds = progress.map((item) => item.flashcard_id);
    const excluded = new Set<string>();

    function addUnique(next: Flashcard[], maxItems: number): Flashcard[] {
      const added: Flashcard[] = [];
      for (const card of next) {
        if (added.length >= maxItems) break;
        if (excluded.has(card.id)) continue;
        excluded.add(card.id);
        added.push(card);
      }
      return added;
    }

    async function fetchUnseen(params: {
      maxItems: number;
      newestThisWeek?: boolean;
      oldestFirst?: boolean;
    }): Promise<Flashcard[]> {
      const { maxItems, newestThisWeek = false, oldestFirst = false } = params;
      if (maxItems <= 0) return [];

      let query = supabase.from("flashcards").select("*").eq("exam", exam).eq("is_active", true);
      if (subject) query = query.eq("subject", subject);
      if (noteId) query = query.eq("note_id", noteId);
      if (topic) query = query.eq("topic", topic);

      const allExcluded = Array.from(new Set([...progressIds, ...excluded]));
      if (allExcluded.length > 0) query = query.not("id", "in", `(${allExcluded.join(",")})`);

      if (newestThisWeek) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        query = query.gte("added_week", sevenDaysAgo).order("added_week", { ascending: false }).order("created_at", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: oldestFirst });
      }

      const { data } = await query.limit(maxItems);
      return addUnique((data || []) as Flashcard[], maxItems);
    }

    let result: Flashcard[] = [];
    if (isFree) {
      result = await fetchUnseen({ maxItems: sessionLimit, oldestFirst: true });
    } else {
      const now = Date.now();
      const recallDueIds = progress
        .filter((item) => item.deck_type === "recall" && item.next_due_at && new Date(item.next_due_at).getTime() <= now)
        .sort((a, b) => new Date(a.next_due_at || 0).getTime() - new Date(b.next_due_at || 0).getTime())
        .map((item) => item.flashcard_id);
      const reviewIds = progress
        .filter((item) => item.deck_type === "review")
        .sort((a, b) => new Date(a.last_seen_at || 0).getTime() - new Date(b.last_seen_at || 0).getTime())
        .map((item) => item.flashcard_id);

      const recallCards = addUnique(await fetchFlashcardsByIds({ ids: recallDueIds, exam, subject, noteId, topic }), PRO_BUCKETS.recallDue);
      const newCards = await fetchUnseen({ maxItems: PRO_BUCKETS.newThisWeek, newestThisWeek: true });
      const unseenCards = await fetchUnseen({ maxItems: PRO_BUCKETS.unseen, oldestFirst: true });
      const reviewCards = addUnique(await fetchFlashcardsByIds({ ids: reviewIds, exam, subject, noteId, topic }), PRO_BUCKETS.review);

      result = [...recallCards, ...newCards, ...unseenCards, ...reviewCards].slice(0, sessionLimit);
      if (result.length < sessionLimit) {
        const fill = await fetchUnseen({ maxItems: sessionLimit - result.length, oldestFirst: true });
        result = [...result, ...fill].slice(0, sessionLimit);
      }
    }

    setCards(result);
    setCurrentIndex(0);
    setFlipped(false);
    setRecallCount(0);
    setReviewCount(0);
    setSessionEnded(false);
    sessionLoggedRef.current = false;
    setLoading(false);
  }, [exam, subject, userId, isFree, sessionLimit, noteId, topic]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      void fetchCards();
    }, 0);
    return () => clearTimeout(timer);
  }, [enabled, fetchCards]);

  async function markCard(deck: "recall" | "review") {
    if (!cards[currentIndex]) return;
    const supabase = createClient();
    const card = cards[currentIndex];

    const nextRecallCount = deck === "recall" ? recallCount + 1 : recallCount;
    const nextReviewCount = deck === "review" ? reviewCount + 1 : reviewCount;
    setRecallCount(nextRecallCount);
    setReviewCount(nextReviewCount);

    const { data: existingRaw } = await supabase
      .from("user_flashcard_progress")
      .select("times_seen")
      .eq("user_id", userId)
      .eq("flashcard_id", card.id)
      .single();

    const existing = existingRaw as { times_seen: number | null } | null;
    const successCount = deck === "recall" ? (existing?.times_seen || 0) + 1 : existing?.times_seen || 0;
    const intervals = getRecallIntervals(getFlashcardRecallFrequency());
    const interval = deck === "recall"
      ? intervals[Math.min(successCount - 1, intervals.length - 1)]
      : 0.5;

    await supabase.from("user_flashcard_progress").upsert({
      user_id: userId,
      flashcard_id: card.id,
      deck_type: deck,
      times_seen: successCount,
      last_seen_at: new Date().toISOString(),
      next_due_at: interval === null ? null : addDays(interval),
    }, { onConflict: "user_id,flashcard_id" });

    toast.success(deck === "recall" ? "Added to Recall deck" : "Added to Review deck");
    advanceAfterMark(nextRecallCount, nextReviewCount);
  }

  function flip() {
    setFlipped((value) => !value);
  }

  function advanceAfterMark(finalRecallCount: number, finalReviewCount: number) {
    if (currentIndex >= Math.min(sessionLimit, cards.length) - 1) {
      setSessionEnded(true);
      setFlipped(false);
      logSessionOnce(finalRecallCount, finalReviewCount);
      return;
    }
    goNext();
  }

  function logSessionOnce(finalRecallCount: number, finalReviewCount: number) {
    if (sessionLoggedRef.current) return;
    sessionLoggedRef.current = true;
    // flashcard_sessions is CA-only (enforced by a DB check constraint too) —
    // this hook is shared with NEET's flashcards page, so skip the insert
    // entirely rather than firing a doomed request every NEET session.
    if (exam !== "CA") return;
    const seen = cards.slice(0, Math.min(sessionLimit, cards.length));
    if (seen.length === 0) return;

    const supabase = createClient();
    void supabase.from("flashcard_sessions").insert({
      user_id: userId,
      exam,
      subject: subject || null,
      note_id: noteId || null,
      topic: topic || null,
      total_cards: seen.length,
      recall_count: finalRecallCount,
      review_count: finalReviewCount,
    });
  }

  function goNext() {
    setFlipped(false);
    setTimeout(() => setCurrentIndex((index) => Math.min(index + 1, cards.length - 1)), 150);
  }

  function goPrev() {
    setFlipped(false);
    setTimeout(() => setCurrentIndex((index) => Math.max(index - 1, 0)), 150);
  }

  function practiceAgain() {
    setCurrentIndex(0);
    setFlipped(false);
    setRecallCount(0);
    setReviewCount(0);
    setSessionEnded(false);
    sessionLoggedRef.current = false;
  }

  return {
    cards,
    currentIndex,
    currentCard: cards[currentIndex] || null,
    flipped,
    loading,
    recallCount,
    reviewCount,
    sessionEnded,
    dailyLimitReached: isFree && sessionEnded,
    flip,
    goNext,
    goPrev,
    markCard,
    continueSession: fetchCards,
    practiceAgain,
    total: cards.length,
    displayTotal: isFree ? Math.min(FREE_FLASHCARD_SESSION_LIMIT, cards.length || FREE_FLASHCARD_SESSION_LIMIT) : sessionLimit,
    seenCards: cards.slice(0, Math.min(sessionLimit, cards.length)),
  };
}
