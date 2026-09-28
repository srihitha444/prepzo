"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchQuestions, recordAnswer } from "@/lib/questions";
import type { CaPaper } from "@/lib/ca-syllabus";
import type { Question } from "@/lib/supabase/types";
import type { AnswerEvaluation } from "@/lib/ca/evaluateAnswer";

const MCQ_POOL_LIMIT = 20;
const DESCRIPTIVE_POOL_LIMIT = 10;

interface McqAnswerState {
  selected: string | null;
  correct: boolean;
  // A real uploaded paper may have no bundled answer key — those MCQs are
  // still answerable (recorded here) but excluded from scoring rather than
  // auto-marked wrong, since there's nothing to check the answer against.
  graded: boolean;
}

interface DescriptiveAnswerState {
  text: string;
  evaluation: AnswerEvaluation | null;
  evaluating: boolean;
}

export interface MockTestResult {
  mcqScore: number;
  descriptiveScore: number;
  totalScore: number;
  totalPossible: number;
}

/**
 * Assembles a self-paced, mixed-pattern question set for a paper — MCQ and
 * descriptive together, in roughly the paper's real format, sized to
 * whatever the student's own notes have produced. Not a timed full-paper
 * simulation (no timer/duration, no forced quantity).
 */
export function useCaMockTest({ userId, paper, testPaperId }: { userId: string; paper: CaPaper; testPaperId?: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, McqAnswerState>>({});
  const [descriptiveAnswers, setDescriptiveAnswers] = useState<Record<string, DescriptiveAnswerState>>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MockTestResult | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  // One claim per mounted test, so React's development double-mount (and any
  // dependency change that re-runs load) can't charge the same attempt twice.
  const claimedRef = useRef(false);
  // The attempt row /start created for us. /finish updates that exact row —
  // the browser can no longer create one itself.
  const attemptIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    // Claim the mock-test allowance before loading anything. The attempt row
    // is still written client-side on finish, so this route is the only place
    // the quota can actually be enforced — see app/api/ca/mock-tests/start.
    if (!claimedRef.current) {
      claimedRef.current = true;
      try {
        const res = await fetch("/api/ca/mock-tests/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paper: paper.code, test_paper_id: testPaperId || null }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setQuotaError(json.error || "You've used all your mock tests for this month.");
          setQuestions([]);
          setLoading(false);
          return;
        }
        attemptIdRef.current = json.attempt_id ?? null;
      } catch {
        // A network blip shouldn't block a student who is entitled to the
        // test; the cap is a product limit, not a security boundary.
        console.error("[mock-test] could not claim allowance, continuing");
      }
    }

    if (testPaperId) {
      // A real uploaded paper is a fixed, already-assembled set — pull
      // everything extracted from it, in original order, no pool sampling.
      const supabase = createClient();
      const { data } = await supabase
        .from("questions")
        .select("*")
        .eq("exam", "CA")
        .eq("test_paper_id", testPaperId)
        .order("created_at", { ascending: true });
      setQuestions((data || []) as Question[]);
    } else {
      const [mcq, descriptive] = await Promise.all([
        paper.format === "descriptive"
          ? Promise.resolve([])
          : fetchQuestions({ exam: "CA", subject: paper.name, questionType: "mcq", limit: MCQ_POOL_LIMIT }),
        paper.format === "objective"
          ? Promise.resolve([])
          : fetchQuestions({ exam: "CA", subject: paper.name, questionType: "descriptive", limit: DESCRIPTIVE_POOL_LIMIT }),
      ]);
      setQuestions([...mcq, ...descriptive]);
    }

    setCurrentIndex(0);
    setMcqAnswers({});
    setDescriptiveAnswers({});
    setSubmitted(false);
    setResult(null);
    setLoading(false);
  }, [paper.name, paper.format, paper.code, testPaperId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a memoized async helper; setState happens after an await
    load();
  }, [load]);

  async function answerMcq(question: Question, option: string) {
    const graded = Boolean(question.correct_option);
    const correct = graded && option.trim().toUpperCase() === (question.correct_option || "").trim().toUpperCase();
    setMcqAnswers((prev) => ({ ...prev, [question.id]: { selected: option, correct, graded } }));
    // Skip recordAnswer (feeds the recall/review spaced-repetition deck) for
    // ungraded questions — there's no known answer, so "isCorrect: false"
    // would wrongly push it to the review deck.
    if (graded) {
      await recordAnswer({ userId, questionId: question.id, isCorrect: correct, timeSeconds: 0, selectedOption: option });
    }
  }

  async function submitDescriptive(question: Question, text: string) {
    if (!text.trim()) return;
    setDescriptiveAnswers((prev) => ({ ...prev, [question.id]: { text, evaluation: null, evaluating: true } }));

    try {
      const res = await fetch("/api/ca/questions/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: question.id, student_answer: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Evaluation failed");

      setDescriptiveAnswers((prev) => ({ ...prev, [question.id]: { text, evaluation: json, evaluating: false } }));
    } catch (error) {
      setDescriptiveAnswers((prev) => ({ ...prev, [question.id]: { text, evaluation: null, evaluating: false } }));
      throw error;
    }
  }

  function goTo(index: number) {
    if (index < 0 || index >= questions.length) return;
    setCurrentIndex(index);
  }

  async function finish() {
    setSubmitting(true);
    try {
      const mcqQuestions = questions.filter((q) => q.question_type === "mcq");
      const gradedMcqQuestions = mcqQuestions.filter((q) => q.correct_option);
      const descriptiveQuestions = questions.filter((q) => q.question_type === "descriptive");
      // Same "ungraded" treatment as MCQs without a correct_option: a real
      // paper's marks value can be as easily unreadable on a scan as its
      // answer key. Excluded from both descriptivePossible AND
      // descriptiveScore together — previously marks_awarded was still
      // added to the score numerator even though the question contributed
      // nothing to the denominator, so a result could read e.g. "17/10".
      const gradedDescriptiveQuestions = descriptiveQuestions.filter((q) => q.marks != null);

      let mcqScore = 0;
      for (const q of gradedMcqQuestions) {
        const answer = mcqAnswers[q.id];
        if (!answer) continue;
        mcqScore += answer.correct ? 1 : -(q.negative_marking_value || 0);
      }

      let descriptiveScore = 0;
      let descriptivePossible = 0;
      for (const q of gradedDescriptiveQuestions) {
        descriptivePossible += q.marks || 0;
        const answer = descriptiveAnswers[q.id];
        if (answer?.evaluation) descriptiveScore += answer.evaluation.marks_awarded;
      }

      const totalPossible = gradedMcqQuestions.length + descriptivePossible;
      const totalScore = Math.round((mcqScore + descriptiveScore) * 100) / 100;

      // Written through the server, not straight to the table: attempts are
      // service-write only now, which is what makes the mock-test allowance
      // enforceable rather than advisory.
      if (attemptIdRef.current) {
        await fetch("/api/ca/mock-tests/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attempt_id: attemptIdRef.current,
            mcq_answers: Object.fromEntries(Object.entries(mcqAnswers).map(([id, a]) => [id, a.selected])),
            descriptive_answers: Object.fromEntries(Object.entries(descriptiveAnswers).map(([id, a]) => [id, a.text])),
            mcq_score: Math.round(mcqScore * 100) / 100,
            descriptive_score: descriptiveScore,
            total_score: totalScore,
            total_possible: totalPossible,
          }),
        });
      }

      setResult({ mcqScore: Math.round(mcqScore * 100) / 100, descriptiveScore, totalScore, totalPossible });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  const answeredCount = Object.keys(mcqAnswers).length + Object.values(descriptiveAnswers).filter((a) => a.evaluation).length;

  return {
    quotaError,
    questions,
    currentIndex,
    currentQuestion: questions[currentIndex] || null,
    mcqAnswers,
    descriptiveAnswers,
    loading,
    submitting,
    submitted,
    result,
    answeredCount,
    answerMcq,
    submitDescriptive,
    goTo,
    finish,
    restart: load,
  };
}
