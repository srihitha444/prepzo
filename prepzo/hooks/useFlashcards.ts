"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getISTDate } from "@/lib/utils";
import type { Flashcard } from "@/lib/supabase/types";
import toast from "react-hot-toast";

export const FREE_DAILY_FC_LIMIT = 5;
const DAILY_FC_KEY = "prepzo_daily_fcs";

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
      // New day: get previously seen flashcard IDs to exclude
      const { data: seenRaw } = await supabase
        .from("user_flashcard_progress")
        .select("flashcard_id, next_due_at")
        .eq("user_id", userId);

      const seenIds = (seenRaw || []).map((r: { flashcard_id: string; next_due_at: string | null }) => r.flashcard_id);
      const dueIds = (seenRaw || [])
        .filter((r: { flashcard_id: string; next_due_at: string | null }) => r.next_due_at && new Date(r.next_due_at) <= new Date())
        .map((r: { flashcard_id: string; next_due_at: string | null }) => r.flashcard_id);

      // Fetch new (unseen) cards
      let newQuery = supabase.from("flashcards").select("*").eq("exam", exam).eq("is_active", true);
      if (subject) newQuery = newQuery.eq("subject", subject);
      const excludeFromNew = seenIds.filter((id) => !dueIds.includes(id));
      if (excludeFromNew.length > 0) newQuery = newQuery.not("id", "in", `(${excludeFromNew.join(",")})`);
      const { data: newCards } = await newQuery.limit(isFree ? FREE_DAILY_FC_LIMIT : 50);

      // Fetch due cards (spaced repetition)
      let dueCards: Flashcard[] = [];
      if (dueIds.length > 0) {
        let dueQuery = supabase.from("flashcards").select("*").in("id", dueIds).eq("is_active", true);
        if (subject) dueQuery = dueQuery.eq("subject", subject);
        const { data: due } = await dueQuery;
        dueCards = (due || []) as Flashcard[];
      }

      result = [...dueCards, ...((newCards || []) as Flashcard[])].slice(0, isFree ? FREE_DAILY_FC_LIMIT : 50);
      saveDailyFCSession(exam, subject, result.map((c) => c.id));
    }

    setCards(result);
    setCurrentIndex(0);
    setFlipped(false);

    // Check daily limit on load
    if (isFree) {
      const count = getFcSeenCount();
      if (count >= FREE_DAILY_FC_LIMIT) setDailyLimitReached(true);
      else incrementFcSeen(); // count first card
    }

    setLoading(false);
  }, [exam, subject, userId, isFree]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  async function markCard(deck: "recall" | "review") {
    if (!cards[currentIndex]) return;
    const supabase = createClient();
    const card = cards[currentIndex];

    if (deck === "recall") setRecallCount((c) => c + 1);
    else setReviewCount((c) => c + 1);

    await supabase.from("user_flashcard_progress").upsert({
      user_id: userId,
      flashcard_id: card.id,
      deck_type: deck,
      times_seen: 1,
      last_seen_at: new Date().toISOString(),
      next_due_at: new Date(Date.now() + (deck === "recall" ? 3 : 1) * 86400000).toISOString(),
    }, { onConflict: "user_id,flashcard_id" });

    toast.success(deck === "recall" ? "Added to Recall deck ✓" : "Added to Review deck");
    goNext();
  }

  function flip() { setFlipped((f) => !f); }

  function goNext() {
    if (isFree && !dailyLimitReached) {
      const newCount = incrementFcSeen();
      if (newCount >= FREE_DAILY_FC_LIMIT) {
        setDailyLimitReached(true);
        return;
      }
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
