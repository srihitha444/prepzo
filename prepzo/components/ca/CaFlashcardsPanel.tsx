"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Layers } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FlashCard } from "@/components/flashcard/FlashCard";
import { createClient } from "@/lib/supabase/client";
import { useFlashcards } from "@/hooks/useFlashcards";
import { getPaperByCode } from "@/lib/ca-syllabus";
import type { Flashcard } from "@/lib/supabase/types";

// A single "Study"/"Retake" pass through a section is capped rather than
// unbounded, so one sitting stays manageable even for a large upload —
// but it scales with the section instead of the fixed 20-card default used
// for the general (not note-scoped) session goal, so a 147-card section
// isn't artificially limited to 20 every time.
const MAX_DECK_SESSION_SIZE = 40;

type DeckSort = "recent" | "name" | "cards";

// A note's flashcards are generated per extracted content block, and each
// block carries a topic (e.g. "Chapter 3: Companies Act"). A note with
// several blocks therefore produces several distinct topic groups — a
// student needs to see and pick between those, not get one shuffled pool
// with no way to tell which card came from which part of their upload.
interface Section {
  noteId: string;
  topic: string;
  cardCount: number;
}

interface Deck {
  noteId: string;
  title: string;
  paper: string | null;
  cardCount: number;
  createdAt: string;
  sections: Section[];
}

interface SessionLogRow {
  id: string;
  note_id: string | null;
  topic: string | null;
  total_cards: number;
  recall_count: number;
  review_count: number;
  completed_at: string;
}

type ActiveView = { kind: "study" | "review"; noteId: string; topic: string } | null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function historyKey(noteId: string, topic: string): string {
  return `${noteId}::${topic}`;
}

function useDecks(userId: string) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [history, setHistory] = useState<Map<string, SessionLogRow[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchDecks = useCallback(async () => {
    const supabase = createClient();

    const { data: notes } = await supabase.from("user_notes").select("id, title, created_at").eq("user_id", userId);
    const noteTitleById = new Map<string, string>((notes || []).map((n) => [n.id as string, n.title as string]));
    const noteCreatedAtById = new Map<string, string>((notes || []).map((n) => [n.id as string, n.created_at as string]));
    const noteIds = Array.from(noteTitleById.keys());
    if (noteIds.length === 0) {
      setDecks([]);
      setLoading(false);
      return;
    }

    const [{ data: cards }, { data: sessions }] = await Promise.all([
      supabase.from("flashcards").select("note_id, paper, topic").eq("exam", "CA").eq("is_active", true).in("note_id", noteIds),
      supabase
        .from("flashcard_sessions")
        .select("id, note_id, topic, total_cards, recall_count, review_count, completed_at")
        .eq("user_id", userId)
        .eq("exam", "CA")
        .order("completed_at", { ascending: false }),
    ]);

    const deckMap = new Map<string, Deck>();
    const sectionMaps = new Map<string, Map<string, Section>>();

    for (const row of cards || []) {
      if (!row.note_id) continue;
      const topic = row.topic || "General";

      let deck = deckMap.get(row.note_id);
      if (!deck) {
        deck = {
          noteId: row.note_id,
          title: noteTitleById.get(row.note_id) || "Untitled upload",
          paper: row.paper || null,
          cardCount: 0,
          createdAt: noteCreatedAtById.get(row.note_id) || "",
          sections: [],
        };
        deckMap.set(row.note_id, deck);
        sectionMaps.set(row.note_id, new Map());
      }
      deck.cardCount += 1;

      const sections = sectionMaps.get(row.note_id)!;
      const section = sections.get(topic);
      if (section) section.cardCount += 1;
      else sections.set(topic, { noteId: row.note_id, topic, cardCount: 1 });
    }

    for (const [noteId, deck] of deckMap) {
      deck.sections = Array.from(sectionMaps.get(noteId)!.values()).sort((a, b) => a.topic.localeCompare(b.topic));
    }

    const historyMap = new Map<string, SessionLogRow[]>();
    for (const session of (sessions || []) as SessionLogRow[]) {
      if (!session.note_id) continue;
      const key = historyKey(session.note_id, session.topic || "General");
      const list = historyMap.get(key) || [];
      list.push(session);
      historyMap.set(key, list);
    }

    setDecks(Array.from(deckMap.values()));
    setHistory(historyMap);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a memoized async helper; setState happens after an await
    fetchDecks();
  }, [fetchDecks]);

  return { decks, history, loading, refetch: fetchDecks };
}

function SessionHistory({ sessions }: { sessions: SessionLogRow[] }) {
  const [expanded, setExpanded] = useState(false);
  if (sessions.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs font-semibold text-[#1E3A8A]"
      >
        {sessions.length} past attempt{sessions.length === 1 ? "" : "s"}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between text-xs text-[#64748B]">
              <span>{formatDate(session.completed_at)}</span>
              <span>
                {session.total_cards} cards · {session.recall_count} recalled · {session.review_count} to review
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Study/Retake always draws a fresh (or due) batch. Review & Recall instead
// browses the cards currently sitting in this section's Recall/Review decks
// — i.e. it reflects the live outcome of the student's most recent
// session(s), not a fixed historical log — so it only makes sense to offer
// once there's been at least one session for the section.
function SectionActions({
  sessions,
  onStudy,
  onReview,
}: {
  sessions: SessionLogRow[];
  onStudy: () => void;
  onReview: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <button
        onClick={onStudy}
        className="rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#162D6B]"
      >
        {sessions.length > 0 ? "Retake" : "Study"}
      </button>
      {sessions.length > 0 && (
        <button
          onClick={onReview}
          className="rounded-lg border border-[#1E3A8A] px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE]"
        >
          Review &amp; Recall
        </button>
      )}
    </div>
  );
}

function SectionRow({
  section,
  sessions,
  onStudy,
  onReview,
}: {
  section: Section;
  sessions: SessionLogRow[];
  onStudy: () => void;
  onReview: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#0F172A]">{section.topic}</p>
          <p className="text-xs text-[#64748B]">{section.cardCount} cards</p>
        </div>
        <SectionActions sessions={sessions} onStudy={onStudy} onReview={onReview} />
      </div>
      <SessionHistory sessions={sessions} />
    </div>
  );
}

function DeckRow({
  deck,
  historyFor,
  defaultExpanded,
  onStudySection,
  onReviewSection,
}: {
  deck: Deck;
  historyFor: (topic: string) => SessionLogRow[];
  defaultExpanded: boolean;
  onStudySection: (topic: string) => void;
  onReviewSection: (topic: string) => void;
}) {
  const singleSection = deck.sections.length <= 1;
  const [expanded, setExpanded] = useState(defaultExpanded || singleSection);
  const paper = deck.paper ? getPaperByCode(deck.paper) : null;
  const onlySection = deck.sections[0];

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#1E3A8A]">
          <Layers size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#0F172A]">{deck.title}</p>
          <p className="text-xs text-[#64748B]">
            {paper?.name || "Unassigned"} · {deck.cardCount} cards
            {!singleSection && ` · ${deck.sections.length} sections`}
          </p>
        </div>
        {singleSection && onlySection ? (
          <SectionActions
            sessions={historyFor(onlySection.topic)}
            onStudy={() => onStudySection(onlySection.topic)}
            onReview={() => onReviewSection(onlySection.topic)}
          />
        ) : (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] hover:border-[#3B5FBF]"
          >
            Sections {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {singleSection && onlySection ? (
        <SessionHistory sessions={historyFor(onlySection.topic)} />
      ) : (
        expanded && (
          <div className="mt-3 space-y-2 border-t border-[#E2E8F0] pt-3">
            {deck.sections.map((section) => (
              <SectionRow
                key={section.topic}
                section={section}
                sessions={historyFor(section.topic)}
                onStudy={() => onStudySection(section.topic)}
                onReview={() => onReviewSection(section.topic)}
              />
            ))}
          </div>
        )
      )}
    </Card>
  );
}

function StudySession({
  userId,
  plan,
  deck,
  topic,
  onExit,
}: {
  userId: string;
  plan: "free" | "paid";
  deck: Deck;
  topic: string;
  onExit: () => void;
}) {
  const section = deck.sections.find((s) => s.topic === topic);
  const sectionCardCount = section?.cardCount ?? deck.cardCount;
  const paper = deck.paper ? getPaperByCode(deck.paper) : null;
  const sessionGoal = Math.min(sectionCardCount, MAX_DECK_SESSION_SIZE);
  const session = useFlashcards({
    exam: "CA",
    subject: paper?.name,
    userId,
    plan,
    noteId: deck.noteId,
    topic: topic === "General" ? undefined : topic,
    sessionGoal,
  });

  return (
    <div>
      <button onClick={onExit} className="mb-4 flex items-center gap-1 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]">
        <ChevronLeft size={14} /> Back to decks
      </button>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#64748B]">{deck.title} · {topic}</p>

      {session.loading ? (
        <p className="text-sm text-[#64748B]">Loading cards...</p>
      ) : session.sessionEnded ? (
        <div className="rounded-2xl bg-[#1E3A8A] p-6 text-center text-white shadow-[var(--shadow-card)]">
          <p className="font-[family-name:var(--font-fraunces)] text-2xl font-bold">Section complete</p>
          <p className="mt-1 text-sm text-white/70">
            {session.recallCount} recalled · {session.reviewCount} need review
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {sectionCardCount > session.displayTotal && (
              <button onClick={session.continueSession} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A8A] hover:bg-[#F8FAFF]">
                Study next cards in this section
              </button>
            )}
            <button onClick={session.practiceAgain} className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
              Retake this batch
            </button>
            <button onClick={onExit} className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
              Done
            </button>
          </div>
        </div>
      ) : !session.currentCard ? (
        <p className="text-sm text-[#64748B]">No cards found for this section.</p>
      ) : (
        <>
          <p className="mb-3 text-center text-xs text-[#64748B]">
            {session.currentIndex + 1} / {session.displayTotal} this session
            {sectionCardCount > session.displayTotal && ` · ${sectionCardCount} in this section`}
          </p>
          <FlashCard card={session.currentCard} flipped={session.flipped} onFlip={session.flip} />
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => session.markCard("review")}
              className="flex-1 rounded-xl bg-[#FEE2E2] py-3 text-sm font-semibold text-[#DC2626] hover:bg-[#FECACA]"
            >
              ← Need Review
            </button>
            <button
              onClick={() => session.markCard("recall")}
              className="flex-1 rounded-xl bg-[#DCFCE7] py-3 text-sm font-semibold text-[#16A34A] hover:bg-[#BBF7D0]"
            >
              Got It →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface SectionProgressCard {
  card: Flashcard;
  deckType: "recall" | "review";
  timesSeen: number;
}

function useSectionProgress(userId: string, noteId: string, topic: string) {
  const [cards, setCards] = useState<SectionProgressCard[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let cardQuery = supabase.from("flashcards").select("id").eq("exam", "CA").eq("is_active", true).eq("note_id", noteId);
    cardQuery = topic === "General" ? cardQuery.is("topic", null) : cardQuery.eq("topic", topic);
    const { data: sectionCards } = await cardQuery;
    const ids = (sectionCards || []).map((c) => c.id as string);
    if (ids.length === 0) {
      setCards([]);
      setLoading(false);
      return;
    }

    const { data: progress } = await supabase
      .from("user_flashcard_progress")
      .select("flashcard_id, deck_type, times_seen, flashcards!inner(*)")
      .eq("user_id", userId)
      .in("flashcard_id", ids)
      .in("deck_type", ["recall", "review"]);

    const rows = (progress || []) as Array<{
      flashcard_id: string;
      deck_type: "recall" | "review";
      times_seen: number;
      flashcards: Flashcard;
    }>;
    setCards(rows.map((r) => ({ card: r.flashcards, deckType: r.deck_type, timesSeen: r.times_seen || 0 })));
    setLoading(false);
  }, [userId, noteId, topic]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a memoized async helper; setState happens after an await
    refetch();
  }, [refetch]);

  return { cards, loading, refetch };
}

// Browses (and lets the student re-mark) exactly the cards currently in this
// section's Recall/Review decks — the live result of their previous
// session(s) for this section, not a fixed replay of what they studied.
function SectionReviewSession({
  userId,
  deck,
  topic,
  onExit,
}: {
  userId: string;
  deck: Deck;
  topic: string;
  onExit: () => void;
}) {
  const { cards, loading, refetch } = useSectionProgress(userId, deck.noteId, topic);
  const [tab, setTab] = useState<"recall" | "review">("recall");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const recallCards = cards.filter((c) => c.deckType === "recall");
  const reviewCards = cards.filter((c) => c.deckType === "review");
  const activeCards = tab === "recall" ? recallCards : reviewCards;
  const current = activeCards[index];

  function switchTab(nextTab: "recall" | "review") {
    setTab(nextTab);
    setIndex(0);
    setFlipped(false);
  }

  async function mark(nextDeck: "recall" | "review") {
    if (!current) return;
    const supabase = createClient();
    await supabase.from("user_flashcard_progress").upsert(
      {
        user_id: userId,
        flashcard_id: current.card.id,
        deck_type: nextDeck,
        times_seen: current.timesSeen + 1,
        last_seen_at: new Date().toISOString(),
        next_due_at: new Date(Date.now() + (nextDeck === "recall" ? 3 : 1) * 86400000).toISOString(),
      },
      { onConflict: "user_id,flashcard_id" }
    );
    setFlipped(false);
    await refetch();
    setIndex((i) => Math.min(i, Math.max(activeCards.length - 2, 0)));
  }

  return (
    <div>
      <button onClick={onExit} className="mb-4 flex items-center gap-1 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]">
        <ChevronLeft size={14} /> Back to decks
      </button>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#64748B]">{deck.title} · {topic}</p>

      <div className="mb-4 flex gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-1">
        {(["recall", "review"] as const).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === t ? "bg-white shadow-sm text-[#1E3A8A]" : "text-[#64748B]"
            }`}
          >
            {t === "recall" ? `Recall (${recallCards.length})` : `Need Review (${reviewCards.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#64748B]">Loading...</p>
      ) : !current ? (
        <p className="text-sm text-[#64748B]">
          {tab === "recall" ? "Nothing in Recall for this section yet." : "Nothing needs review in this section right now."}
        </p>
      ) : (
        <>
          <p className="mb-3 text-center text-xs text-[#64748B]">{index + 1} / {activeCards.length}</p>
          <FlashCard card={current.card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          <div className="mt-5 flex gap-3">
            <button onClick={() => mark("review")} className="flex-1 rounded-xl bg-[#FEE2E2] py-3 text-sm font-semibold text-[#DC2626] hover:bg-[#FECACA]">
              ← Need Review
            </button>
            <button onClick={() => mark("recall")} className="flex-1 rounded-xl bg-[#DCFCE7] py-3 text-sm font-semibold text-[#16A34A] hover:bg-[#BBF7D0]">
              Got It →
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => { setFlipped(false); setIndex((i) => Math.max(i - 1, 0)); }}
              disabled={index === 0}
              className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => { setFlipped(false); setIndex((i) => Math.min(i + 1, activeCards.length - 1)); }}
              disabled={index >= activeCards.length - 1}
              className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] disabled:opacity-30 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const SORTERS: Record<DeckSort, (a: Deck, b: Deck) => number> = {
  recent: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  name: (a, b) => a.title.localeCompare(b.title),
  cards: (a, b) => b.cardCount - a.cardCount,
};

export function CaFlashcardsPanel({ userId, plan, initialNoteId }: { userId: string; plan: "free" | "paid"; initialNoteId?: string }) {
  const { decks, history, loading, refetch } = useDecks(userId);
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [sort, setSort] = useState<DeckSort>("recent");

  // A direct link from a note (e.g. "Ask AI Teacher"'s sibling "Study
  // flashcards" button) only knows the note, not a section — auto-start
  // only when that note turns out to have just one section; otherwise land
  // on the deck expanded to its section list so the student picks one.
  useEffect(() => {
    if (!initialNoteId || loading) return;
    const deck = decks.find((d) => d.noteId === initialNoteId);
    if (deck && deck.sections.length === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time auto-launch once the deck list has loaded; deps only change on mount/refetch, not on the exitSession navigation back
      setActiveView({ kind: "study", noteId: deck.noteId, topic: deck.sections[0].topic });
    }
  }, [initialNoteId, loading, decks]);

  const activeDeck = decks.find((d) => d.noteId === activeView?.noteId) || null;
  const sortedDecks = [...decks].sort(SORTERS[sort]);

  function exitSession() {
    setActiveView(null);
    refetch();
  }

  if (activeDeck && activeView) {
    return activeView.kind === "study" ? (
      <StudySession userId={userId} plan={plan} deck={activeDeck} topic={activeView.topic} onExit={exitSession} />
    ) : (
      <SectionReviewSession userId={userId} deck={activeDeck} topic={activeView.topic} onExit={exitSession} />
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#0F172A]">Your decks</h2>
        {decks.length > 1 && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as DeckSort)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1 text-xs text-[#64748B]"
          >
            <option value="recent">Recently uploaded</option>
            <option value="name">Name (A–Z)</option>
            <option value="cards">Most cards</option>
          </select>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-[#64748B]">Loading...</p>
      ) : decks.length === 0 ? (
        <p className="text-sm text-[#64748B]">
          No flashcards yet — upload notes to generate some, then they&apos;ll show up here as a deck.
        </p>
      ) : (
        <div className="space-y-2">
          {sortedDecks.map((deck) => (
            <DeckRow
              key={deck.noteId}
              deck={deck}
              defaultExpanded={deck.noteId === initialNoteId}
              historyFor={(topic) => history.get(historyKey(deck.noteId, topic)) || []}
              onStudySection={(topic) => setActiveView({ kind: "study", noteId: deck.noteId, topic })}
              onReviewSection={(topic) => setActiveView({ kind: "review", noteId: deck.noteId, topic })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
