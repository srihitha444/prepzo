"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Clock,
  Filter,
  Flame,
  Layers,
  LineChart,
  RotateCcw,
  Search,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import type { Question } from "@/lib/supabase/types";

type PyqQuestion = Pick<
  Question,
  "id" | "subject" | "chapter" | "topic" | "subtopic" | "pyq_year" | "question_text" | "difficulty"
>;

type StatItem = {
  label: string;
  count: number;
  years: number[];
};

const selectClass =
  "min-h-[44px] w-full rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] outline-none transition-all focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#DBEAFE]";

const inputClass =
  "min-h-[44px] w-full rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] outline-none transition-all placeholder:text-[#94A3B8] focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#DBEAFE]";

const PYQ_YEARS = Array.from({ length: 12 }, (_, index) => 2025 - index);
const AVAILABLE_PAPER_YEARS = [2025, 2024, 2023, 2021, 2020];
const PYQ_PERMISSION_BARRIER_ENABLED = true;

function uniqueSorted<T extends string | number>(values: Array<T | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is T => value !== null && value !== undefined && value !== "")))
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

function toStatItems(items: PyqQuestion[], key: "chapter" | "topic" | "subtopic", fallback: string): StatItem[] {
  const map = new Map<string, { count: number; years: Set<number> }>();
  for (const item of items) {
    const label = item[key] || fallback;
    const current = map.get(label) || { count: 0, years: new Set<number>() };
    current.count += 1;
    if (item.pyq_year) current.years.add(item.pyq_year);
    map.set(label, current);
  }

  return Array.from(map.entries())
    .map(([label, value]) => ({
      label,
      count: value.count,
      years: Array.from(value.years).sort((a, b) => b - a),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function makePracticeHref(filters: {
  year: string;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: string;
}) {
  const params = new URLSearchParams({ pyq: "true" });
  if (filters.year) params.set("year", filters.year);
  if (filters.subject) params.set("subject", filters.subject);
  if (filters.chapter) params.set("chapter", filters.chapter);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  return `/quiz?${params.toString()}`;
}

function makePaperHref(
  year: number,
  timerSeconds: number,
  timerMode: "paper" | "question",
  navigationMode: "strict" | "flexi"
) {
  const params = new URLSearchParams({
    pyq: "true",
    year: String(year),
    mode: "paper",
    timer: String(timerSeconds),
    timerMode,
    navigation: navigationMode,
  });
  return `/quiz?${params.toString()}`;
}

export default function PyqPage() {
  if (PYQ_PERMISSION_BARRIER_ENABLED) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center p-4 md:p-8">
        <section className="w-full rounded-[18px] border border-[#E2E8F0] bg-white p-8 text-center shadow-[var(--shadow-card)] md:p-10">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#DBEAFE] text-[#1E3A8A]">
            <BookOpenCheck size={26} />
          </div>
          <Badge variant="warning">Coming soon</Badge>
          <h1 className="mt-4 font-[family-name:var(--font-fraunces)] text-3xl font-bold text-[#0F172A] md:text-4xl">
            PYQ Practice Coming Soon
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#64748B] md:text-base">
            Year-wise papers, chapter-wise filters, topic-wise practice, and PYQ analysis are coming soon on Prepzo
          </p>
          <p className="mx-auto mt-4 max-w-lg text-xs leading-5 text-[#94A3B8]">
            Prepzo is independent and is not affiliated with NTA or NEET
          </p>
        </section>
      </div>
    );
  }

  return <PyqDashboard />;
}

function PyqDashboard() {
  const [questions, setQuestions] = useState<PyqQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [search, setSearch] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [paperYear, setPaperYear] = useState<number | null>(null);
  const [paperTimerSeconds, setPaperTimerSeconds] = useState(180 * 60);
  const [paperTimerMode, setPaperTimerMode] = useState<"paper" | "question">("paper");
  const [paperNavigationMode, setPaperNavigationMode] = useState<"strict" | "flexi">("strict");
  const [customQuestionSeconds, setCustomQuestionSeconds] = useState("60");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("questions")
      .select("id, subject, chapter, topic, subtopic, pyq_year, question_text, difficulty")
      .eq("exam", "NEET")
      .eq("is_pyq", true)
      .eq("is_active", true)
      .order("pyq_year", { ascending: false })
      .order("subject", { ascending: true })
      .limit(1000)
      .then(({ data, error }) => {
        if (error) {
          console.error("Error loading PYQs:", error);
        }
        setQuestions((data || []) as PyqQuestion[]);
        setLoading(false);
      });
  }, []);

  const years = useMemo(() => uniqueSorted<number>(questions.map((item) => item.pyq_year)).reverse(), [questions]);
  const yearFiltered = useMemo(
    () => questions.filter((item) => !selectedYear || String(item.pyq_year || "") === selectedYear),
    [questions, selectedYear]
  );
  const subjects = useMemo(() => uniqueSorted<string>(yearFiltered.map((item) => item.subject)), [yearFiltered]);
  const subjectFiltered = useMemo(
    () => yearFiltered.filter((item) => !selectedSubject || item.subject === selectedSubject),
    [yearFiltered, selectedSubject]
  );
  const chapters = useMemo(() => uniqueSorted<string>(subjectFiltered.map((item) => item.chapter)), [subjectFiltered]);
  const chapterFiltered = useMemo(
    () => subjectFiltered.filter((item) => !selectedChapter || item.chapter === selectedChapter),
    [subjectFiltered, selectedChapter]
  );
  const topics = useMemo(() => uniqueSorted<string>(chapterFiltered.map((item) => item.topic)), [chapterFiltered]);
  const difficulties = ["Easy", "Medium", "Hard"];
  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return chapterFiltered.filter((item) => {
      if (selectedTopic && item.topic !== selectedTopic) return false;
      if (selectedDifficulty && item.difficulty !== selectedDifficulty) return false;
      if (!query) return true;
      return [
        item.question_text,
        item.subject,
        item.chapter,
        item.topic,
        item.subtopic,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [chapterFiltered, search, selectedDifficulty, selectedTopic]);

  const chapterWeightage = useMemo(() => toStatItems(subjectFiltered, "chapter", "Unmapped chapter"), [subjectFiltered]);
  const highYieldAreas = chapterWeightage.slice(0, 5);
  const importantSubtopics = useMemo(() => toStatItems(filteredQuestions, "subtopic", "General"), [filteredQuestions]);
  const topicStats = useMemo(() => toStatItems(filteredQuestions, "topic", "General topic"), [filteredQuestions]);
  const yearlyTrends = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of subjectFiltered) {
      if (!item.pyq_year) continue;
      if (selectedChapter && item.chapter !== selectedChapter) continue;
      if (selectedTopic && item.topic !== selectedTopic) continue;
      if (selectedDifficulty && item.difficulty !== selectedDifficulty) continue;
      map.set(item.pyq_year, (map.get(item.pyq_year) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year);
  }, [selectedChapter, selectedDifficulty, selectedTopic, subjectFiltered]);

  const practiceHref = makePracticeHref({
    year: selectedYear,
    subject: selectedSubject,
    chapter: selectedChapter,
    topic: selectedTopic,
    difficulty: selectedDifficulty,
  });

  function resetFilters() {
    setSelectedYear("");
    setSelectedSubject("");
    setSelectedChapter("");
    setSelectedTopic("");
    setSelectedDifficulty("");
    setSearch("");
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#DBEAFE] text-[#1E3A8A]">
            <BookOpenCheck size={22} />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
              PYQ Practice Coming Soon
            </h1>
            <p className="text-sm text-[#64748B]">Year-wise, chapter-wise, and topic-wise previous year questions.</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Prepzo is independent and is not affiliated with NTA or NEET.
            </p>
          </div>
        </div>

        <Link
          href={practiceHref}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#1E3A8A] px-5 py-2.5 text-sm font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE]"
        >
          Practice Filtered Set
          <ArrowRight size={16} />
        </Link>
      </div>

      <section className="mb-5 rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Take Test Year-wise Paper</h2>
            <p className="text-sm text-[#64748B]">Full PYQ papers are coming soon.</p>
          </div>
          <Badge variant="primary">NEET</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PYQ_YEARS.map((year) => {
            const isAvailable = AVAILABLE_PAPER_YEARS.includes(year);
            if (isAvailable) {
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    setPaperYear(year);
                    setPaperTimerSeconds(180 * 60);
                    setPaperTimerMode("paper");
                    setPaperNavigationMode("strict");
                    setCustomQuestionSeconds("60");
                  }}
                  className="flex min-h-[72px] items-center justify-between rounded-xl border border-[#1E3A8A] bg-[#F8FAFF] px-4 py-3 hover:bg-[#DBEAFE]"
                >
                  <div>
                    <p className="font-bold text-[#0F172A]">NEET {year}</p>
                    <p className="text-sm text-[#64748B]">Take full 180-question test</p>
                  </div>
                  <ArrowRight size={17} className="text-[#1E3A8A]" />
                </button>
              );
            }

            return (
              <div
                key={year}
                className="flex min-h-[72px] items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] px-4 py-3"
              >
                <div>
                  <p className="font-bold text-[#0F172A]">NEET {year}</p>
                  <p className="text-sm text-[#94A3B8]">Coming soon</p>
                </div>
                <Badge variant="muted">Soon</Badge>
              </div>
            );
          })}
        </div>
      </section>

      {paperYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4">
          <div className="w-full max-w-lg rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">NEET {paperYear} Full Paper</h2>
                <p className="mt-1 text-sm text-[#64748B]">
                  Attempt all 180 questions with one total paper timer. Use the time across questions however you want.
                </p>
                <p className="mt-2 text-xs text-[#94A3B8]">
                  Prepzo is independent and is not affiliated with NTA or NEET.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaperYear(null)}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-[#64748B] hover:bg-[#F1F5F9]"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaperNavigationMode("strict")}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    paperNavigationMode === "strict"
                      ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                      : "border-[#E2E8F0] bg-[#F8FAFF] text-[#0F172A] hover:border-[#3B5FBF]"
                  }`}
                >
                  <p className="text-sm font-bold">Strict mode</p>
                  <p className="mt-1 text-xs text-[#64748B]">Answer each question before moving ahead.</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaperNavigationMode("flexi");
                    setPaperTimerMode("paper");
                    setPaperTimerSeconds(180 * 60);
                  }}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    paperNavigationMode === "flexi"
                      ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                      : "border-[#E2E8F0] bg-[#F8FAFF] text-[#0F172A] hover:border-[#3B5FBF]"
                  }`}
                >
                  <p className="text-sm font-bold">Flexi mode</p>
                  <p className="mt-1 text-xs text-[#64748B]">Move between subjects and return to unanswered questions.</p>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPaperTimerSeconds(180 * 60);
                  setPaperTimerMode("paper");
                }}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  paperTimerMode === "paper"
                    ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                    : "border-[#E2E8F0] bg-[#F8FAFF] text-[#0F172A] hover:border-[#3B5FBF]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock size={16} />
                  <p className="text-sm font-bold">Actual NEET time</p>
                </div>
                <p className="mt-1 text-xs text-[#64748B]">180 minutes total. Use the time however you want.</p>
              </button>

              {paperNavigationMode === "strict" && (
                <div className={`rounded-xl border px-4 py-3 ${
                  paperTimerMode === "question" ? "border-[#1E3A8A] bg-[#DBEAFE]" : "border-[#E2E8F0] bg-[#F8FAFF]"
                }`}>
                  <p className="text-sm font-bold text-[#0F172A]">Allocate your own time</p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Auto-moves to the next question when time ends
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-xs font-medium text-[#64748B]">
                    Seconds per question
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={customQuestionSeconds}
                      onFocus={() => setPaperTimerMode("question")}
                      onChange={(event) => {
                        const value = event.target.value;
                        const seconds = Number(value);
                        setCustomQuestionSeconds(value);
                        setPaperTimerMode("question");
                        if (Number.isFinite(seconds) && seconds > 0) setPaperTimerSeconds(seconds);
                      }}
                      className="h-9 w-24 rounded-lg border border-[#CBD5E1] bg-white px-2 text-sm font-semibold text-[#0F172A] outline-none focus:border-[#1E3A8A]"
                    />
                  </label>
                </div>
              )}
            </div>

            <Link
              href={makePaperHref(paperYear, paperTimerSeconds, paperTimerMode, paperNavigationMode)}
              className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] px-4 text-sm font-semibold text-white hover:bg-[#162D6B]"
            >
              Start Paper
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}

      <section className="mb-5 rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
            <Filter size={16} className="text-[#1E3A8A]" />
            Filters
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-[36px] items-center gap-2 rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold text-[#64748B] hover:border-[#CBD5E1]"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Year</span>
            <select
              value={selectedYear}
              onChange={(event) => {
                setSelectedYear(event.target.value);
                setSelectedSubject("");
                setSelectedChapter("");
                setSelectedTopic("");
                setSelectedDifficulty("");
              }}
              className={selectClass}
              disabled={loading}
            >
              <option value="">All years</option>
              {PYQ_YEARS.map((year) => (
                <option key={year} value={year} disabled={!AVAILABLE_PAPER_YEARS.includes(year)}>
                  {AVAILABLE_PAPER_YEARS.includes(year) ? year : `${year} - Upcoming`}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Subject</span>
            <select
              value={selectedSubject}
              onChange={(event) => {
                setSelectedSubject(event.target.value);
                setSelectedChapter("");
                setSelectedTopic("");
                setSelectedDifficulty("");
              }}
              className={selectClass}
              disabled={loading}
            >
              <option value="">All subjects</option>
              {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Chapter</span>
            <select
              value={selectedChapter}
              onChange={(event) => {
                setSelectedChapter(event.target.value);
                setSelectedTopic("");
                setSelectedDifficulty("");
              }}
              className={selectClass}
              disabled={loading || chapters.length === 0}
            >
              <option value="">All chapters</option>
              {chapters.map((chapter) => <option key={chapter} value={chapter}>{chapter}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Topic</span>
            <select
              value={selectedTopic}
              onChange={(event) => {
                setSelectedTopic(event.target.value);
              }}
              className={selectClass}
              disabled={loading || topics.length === 0}
            >
              <option value="">All topics</option>
              {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Difficulty</span>
            <select
              value={selectedDifficulty}
              onChange={(event) => {
                setSelectedDifficulty(event.target.value);
              }}
              className={selectClass}
              disabled={loading || difficulties.length === 0}
            >
              <option value="">All levels</option>
              {difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Search</span>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                placeholder="Question, topic..."
                className={`${inputClass} pl-9`}
              />
            </div>
          </label>
        </div>
      </section>

      <section className="mb-5 rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">PYQ Analysis Coming Soon</h2>
            <p className="text-sm text-[#64748B]">
              Chapter weightage, yearly trends, important subtopics, and high-yield areas are coming soon.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAnalysis((value) => !value)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#1E3A8A] px-4 text-sm font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE]"
          >
            <BarChart3 size={16} />
            {showAnalysis ? "Hide Analysis" : "View Analysis"}
          </button>
        </div>
      </section>

      {showAnalysis && (
        <>
          <div className="mb-5 grid gap-3 md:grid-cols-4">
            <Metric icon={CalendarDays} label="Years" value={years.length} />
            <Metric icon={Layers} label="Chapters" value={chapterWeightage.length} />
            <Metric icon={Target} label="Filtered PYQs Coming Soon" value={filteredQuestions.length} />
            <Metric icon={Flame} label="High-Yield Areas" value={highYieldAreas.length} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <AnalysisPanel
                icon={BarChart3}
                title="Chapter Weightage"
                items={chapterWeightage}
                emptyText="No chapter data found for this filter."
              />

              <AnalysisPanel
                icon={LineChart}
                title={selectedChapter ? `Yearly Trend: ${selectedChapter}` : "Yearly Trends"}
                items={yearlyTrends.map((item) => ({ label: String(item.year), count: item.count, years: [item.year] }))}
                emptyText="Trend data will appear when PYQ tools launch."
                compact
              />
            </div>

            <div className="space-y-5">
              <AnalysisPanel
                icon={Flame}
                title="Potential High-Yield Areas"
                items={highYieldAreas}
                emptyText="High-yield areas will appear when PYQ tools launch."
                compact
              />

              <AnalysisPanel
                icon={Target}
                title="Important Subtopics"
                items={importantSubtopics.slice(0, 8)}
                emptyText="Subtopic insights will appear after subtopics are tagged."
                compact
              />
            </div>
          </div>
        </>
      )}

      <section className="mt-5 rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Filtered PYQ Question List Coming Soon</h2>
            <p className="text-sm text-[#64748B]">
              {loading ? "Loading questions..." : `${filteredQuestions.length} questions match the current filters.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[selectedYear, selectedSubject, selectedChapter, selectedTopic, selectedDifficulty].filter(Boolean).map((item) => (
              <Badge key={item} variant="primary">{item}</Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredQuestions.slice(0, 30).map((question, index) => (
            <div key={question.id} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="warning">{question.pyq_year ? `PYQ ${question.pyq_year} coming soon` : "PYQ coming soon"}</Badge>
                <Badge variant="primary">{question.subject}</Badge>
                {question.chapter && <Badge variant="muted">{question.chapter}</Badge>}
                {question.topic && <Badge variant="muted">{question.topic}</Badge>}
                {question.difficulty && (
                  <Badge variant={question.difficulty === "Easy" ? "success" : question.difficulty === "Hard" ? "error" : "warning"}>
                    {question.difficulty}
                  </Badge>
                )}
              </div>
              <p className="line-clamp-2 text-sm font-medium leading-6 text-[#0F172A]">
                {index + 1}. {question.question_text}
              </p>
            </div>
          ))}

          {!loading && filteredQuestions.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#CBD5E1] p-6 text-center text-sm text-[#64748B]">
              PYQ tools are coming soon.
            </div>
          )}
        </div>
      </section>

      {showAnalysis && topicStats.length > 0 && (
        <section className="mt-5 rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-4 text-base font-bold text-[#0F172A]">Topic-wise PYQs Coming Soon</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {topicStats.slice(0, 10).map((item) => (
              <StatRow key={item.label} item={item} max={topicStats[0]?.count || 1} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: number }) {
  return (
    <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-[#DBEAFE] text-[#1E3A8A]">
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-[#0F172A]">{value}</p>
      <p className="text-sm font-medium text-[#64748B]">{label}</p>
    </div>
  );
}

function AnalysisPanel({
  icon: Icon,
  title,
  items,
  emptyText,
  compact = false,
}: {
  icon: typeof BarChart3;
  title: string;
  items: StatItem[];
  emptyText: string;
  compact?: boolean;
}) {
  const max = items[0]?.count || 1;

  return (
    <section className="rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={17} className="text-[#1E3A8A]" />
        <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.slice(0, compact ? 6 : 12).map((item) => (
          <StatRow key={item.label} item={item} max={max} compact={compact} />
        ))}
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#CBD5E1] p-4 text-sm text-[#64748B]">
            {emptyText}
          </p>
        )}
      </div>
    </section>
  );
}

function StatRow({ item, max, compact }: { item: StatItem; max: number; compact?: boolean }) {
  const width = Math.max(6, Math.round((item.count / max) * 100));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#0F172A]">{item.label}</p>
          {!compact && item.years.length > 0 && (
            <p className="text-xs text-[#94A3B8]">Seen in {item.years.join(", ")}</p>
          )}
        </div>
        <span className="shrink-0 text-sm font-bold text-[#1E3A8A]">{item.count}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
        <div className="h-full rounded-full bg-[#1E3A8A]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
