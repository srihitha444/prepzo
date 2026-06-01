"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getISTDate } from "@/lib/utils";
import type { Flashcard } from "@/lib/supabase/types";
import toast from "react-hot-toast";

export const FREE_DAILY_FC_LIMIT = 5;
const DAILY_FC_KEY = "prepzo_daily_fcs";
type RecallFrequency = "daily" | "every2days" | "weekly";

interface UseFlashcardsOptions {
  exam: string;
  subject?: string;
  userId: string;
  plan: "free" | "paid";
}

function getDailyFCSession(exam: string, subject?: string): string[] | null {
  try {
    const raw = JSON.parse(localStorage.getItem(DAILY_FC_KEY) || "{}");
    const key = `${exam}:${subject || ""}`;
    if (raw.date === getISTDate() && raw[key]) return raw[key];
    return null;
  } catch { return null; }
}

function saveDailyFCSession(exam: string, subject: string | undefined, ids: string[]) {
  try {
    const key = `${exam}:${subject || ""}`;
    const existing = JSON.parse(localStorage.getItem(DAILY_FC_KEY) || "{}");
    const date = getISTDate();
    const updated = existing.date === date ? { ...existing, [key]: ids } : { date, [key]: ids };
    localStorage.setItem(DAILY_FC_KEY, JSON.stringify(updated));
  } catch {}
}

function getFcSeenCount(): number {
  try {
    const raw = JSON.parse(localStorage.getItem("prepzo_fc_day") || "{}");
    return raw.date === getISTDate() ? (raw.count || 0) : 0;
  } catch { return 0; }
}

function incrementFcSeen(): number {
  try {
    const date = getISTDate();
    const raw = JSON.parse(localStorage.getItem("prepzo_fc_day") || "{}");
    const count = (raw.date === date ? raw.count : 0) + 1;
    localStorage.setItem("prepzo_fc_day", JSON.stringify({ date, count }));
    return count;
  } catch { return 0; }
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
}): Promise<Flashcard[]> {
  const { ids, exam, subject } = params;
  if (ids.length === 0) return [];

  const supabase = createClient();
  let query = supabase
    .from("flashcards")
    .select("*")
    .in("id", ids)
    .eq("exam", exam)
    .eq("is_active", true);

  if (subject) query = query.eq("subject", subject);

  const { data } = await query;
  const cards = (data || []) as Flashcard[];
  return ids
    .map((id) => cards.find((card) => card.id === id))
    .filter((card): card is Flashcard => Boolean(card));
}

export function useFlashcards({ exam, subject, userId, plan }: UseFlashcardsOptions) {
  const isFree = plan !== "paid";
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recallCount, setRecallCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const savedIds = getDailyFCSession(exam, subject);

    let result: Flashcard[] = [];

    if (savedIds && savedIds.length > 0) {
      // Same day: load today's assigned cards
      const { data } = await supabase
        .from("flashcards").select("*").in("id", savedIds).eq("is_active", true);
      result = (data || []) as Flashcard[];
    } else {
      const { data: progressRaw } = await supabase
        .from("user_flashcard_progress")
        .select("flashcard_id, deck_type, next_due_at")
        .eq("user_id", userId);

      const progress = (progressRaw || []) as Array<{
        flashcard_id: string;
        deck_type: "unseen" | "recall" | "review" | null;
        next_due_at: string | null;
      }>;
      const now = Date.now();
      const recallDueIds = progress
        .filter((item) => item.deck_type === "recall" && item.next_due_at && new Date(item.next_due_at).getTime() <= now)
        .map((item) => item.flashcard_id);
      const reviewIds = progress
        .filter((item) => item.deck_type === "review")
        .map((item) => item.flashcard_id);
      const seenIds = progress.map((item) => item.flashcard_id);
      const recallCards = await fetchFlashcardsByIds({ ids: recallDueIds, exam, subject });

      let newQuery = supabase.from("flashcards").select("*").eq("exam", exam).eq("is_active", true);
      if (subject) newQuery = newQuery.eq("subject", subject);
      if (seenIds.length > 0) newQuery = newQuery.not("id", "in", `(${seenIds.join(",")})`);
      const limit = isFree ? FREE_DAILY_FC_LIMIT : 50;
      const { data: newCards } = await newQuery.limit(Math.max(limit - recallCards.length, 0));

      const unseenCards = (newCards || []) as Flashcard[];
      const remaining = Math.max(limit - recallCards.length - unseenCards.length, 0);
      const reviewCards = remaining > 0
        ? await fetchFlashcardsByIds({
            ids: reviewIds.filter((id) => !recallDueIds.includes(id)),
            exam,
            subject,
          })
        : [];

      result = [...recallCards, ...unseenCards, ...reviewCards.slice(0, remaining)].slice(0, limit);
      saveDailyFCSession(exam, subject, result.map((c) => c.id));
    }

    setCards(result);
    setCurrentIndex(0);
    setFlipped(false);

    // Check daily limit on load without consuming a card.
    if (isFree) {
      const count = getFcSeenCount();
      if (count >= FREE_DAILY_FC_LIMIT) setDailyLimitReached(true);
      else setDailyLimitReached(false);
    }

    setLoading(false);
  }, [exam, subject, userId, isFree]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCards();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCards]);

  async function markCard(deck: "recall" | "review") {
    if (!cards[currentIndex]) return;
    const supabase = createClient();
    const card = cards[currentIndex];

    if (deck === "recall") setRecallCount((c) => c + 1);
    else setReviewCount((c) => c + 1);

    const { data: existingRaw } = await supabase
      .from("user_flashcard_progress")
      .select("times_seen")
      .eq("user_id", userId)
      .eq("flashcard_id", card.id)
      .single();

    const existing = existingRaw as { times_seen: number | null } | null;
    const successCount = deck === "recall" ? (existing?.times_seen || 0) + 1 : existing?.times_seen || 0;
    const interval = deck === "recall"
      ? getRecallIntervals(getFlashcardRecallFrequency())[Math.min(successCount - 1, getRecallIntervals(getFlashcardRecallFrequency()).length - 1)]
      : 0.5;

    await supabase.from("user_flashcard_progress").upsert({
      user_id: userId,
      flashcard_id: card.id,
      deck_type: deck,
      times_seen: successCount,
      last_seen_at: new Date().toISOString(),
      next_due_at: interval === null ? null : addDays(interval),
    }, { onConflict: "user_id,flashcard_id" });

    toast.success(deck === "recall" ? "Added to Recall deck ✓" : "Added to Review deck");
    goNext();
  }

  function flip() { setFlipped((f) => !f); }

  function goNext() {
    if (isFree && !dailyLimitReached) {
      if (currentIndex >= FREE_DAILY_FC_LIMIT - 1 || currentIndex >= cards.length - 1) {
        incrementFcSeen();
        setDailyLimitReached(true);
        return;
      }
      incrementFcSeen();
    }
    setFlipped(false);
    setTimeout(() => setCurrentIndex((i) => Math.min(i + 1, cards.length - 1)), 150);
  }

  function goPrev() {
    setFlipped(false);
    setTimeout(() => setCurrentIndex((i) => Math.max(i - 1, 0)), 150);
  }

  return {
    cards,
    currentIndex,
    currentCard: cards[currentIndex] || null,
    flipped,
    loading,
    recallCount,
    reviewCount,
    dailyLimitReached,
    flip,
    goNext,
    goPrev,
    markCard,
    total: cards.length,
    displayTotal: isFree ? Math.min(FREE_DAILY_FC_LIMIT, cards.length) : cards.length,
    seenCards: isFree ? cards.slice(0, FREE_DAILY_FC_LIMIT) : cards,
  };
}
