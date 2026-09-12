"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchPrioritizedQuestions, recordAnswer } from "@/lib/questions";
import type { Question } from "@/lib/supabase/types";
import type { AnswerEvaluation } from "@/lib/ca/evaluateAnswer";

export type { AnswerEvaluation as DescriptiveEvaluation } from "@/lib/ca/evaluateAnswer";

const DEFAULT_SESSION_LIMIT = 15;

interface UseCaPracticeOptions {
  userId: string;
  subject?: string;
  noteId?: string;
  questionType?: "mcq" | "descriptive";
  sessionLimit?: number;
  enabled?: boolean;
}

interface AnswerRecord {
  questionId: string;
  correct: boolean;
  attempted: boolean;
  negativeMarkingValue: number;
  selectedOption: string | null;
  evaluation: AnswerEvaluation | null;
}

/**
 * CA-specific practice hook, deliberately not a reuse of hooks/useQuiz.ts —
 * that hook hardcodes NEET's 1/3 negative marking, PYQ handling, a mandatory
 * timer, and free/paid daily limits via getTodayQuestionCount (which counts
 * user_progress across ALL exams, not just NEET). CA questions carry their
 * own negative_marking_value (0.25 for Foundation MCQ papers, 0 elsewhere),
 * have no PYQ concept, and have no defined daily-limit policy yet.
 */
export function useCaPractice({ userId, subject, noteId, questionType, sessionLimit = DEFAULT_SESSION_LIMIT, enabled = true }: UseCaPracticeOptions) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const questionStartRef = useRef(0);
  const sessionLoggedRef = useRef(false);

  const loadQuestions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const loaded = await fetchPrioritizedQuestions({
      userId,
      exam: "CA",
      subject,
      noteId,
      questionType,
      limit: sessionLimit,
      plan: "paid",
    });
    setQuestions(loaded);
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswered(false);
    setAnswers([]);
    setSessionEnded(false);
    setEvaluation(null);
    sessionLoggedRef.current = false;
    questionStartRef.current = Date.now();
    setLoading(false);
  }, [userId, subject, noteId, questionType, sessionLimit]);

  useEffect(() => {
    if (!enabled || !userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a memoized async helper; setState happens after an await
    loadQuestions();
  }, [enabled, userId, loadQuestions]);

  async function logSessionOnce(finalAnswers: AnswerRecord[]) {
    if (sessionLoggedRef.current) return;
    sessionLoggedRef.current = true;
    if (finalAnswers.length === 0) return;

    const correct = finalAnswers.filter((a) => a.correct).length;
    const wrong = finalAnswers.filter((a) => !a.correct && a.attempted).length;
    const skipped = finalAnswers.filter((a) => !a.attempted).length;

    const supabase = createClient();
    await supabase.from("quiz_sessions").insert({
      user_id: userId,
      exam: "CA",
      subject: subject || null,
      note_id: noteId || null,
      question_type: questionType || null,
      total_questions: finalAnswers.length,
      correct,
      wrong,
      skipped,
    });
  }

  function selectOption(option: string) {
    if (answered) return;
    setSelectedOption(option);
  }

  async function submitMcqAnswer() {
    if (answered) return;
    const question = questions[currentIndex];
    if (!question) return;

    const option = selectedOption;
    if (!option) return;
    setAnswered(true);

    const isCorrect = option !== null && option.trim().toUpperCase() === (question.correct_option || "").trim().toUpperCase();
    const timeSeconds = Math.max(0, Math.round((Date.now() - questionStartRef.current) / 1000));

    await recordAnswer({
      userId,
      questionId: question.id,
      isCorrect,
      timeSeconds,
      selectedOption: option,
      skipped: option === null,
    });

    setAnswers((prev) => [
      ...prev,
      {
        questionId: question.id,
        correct: isCorrect,
        attempted: option !== null,
        negativeMarkingValue: question.negative_marking_value,
        selectedOption: option,
        evaluation: null,
      },
    ]);
  }

  async function submitDescriptiveAnswer(studentAnswer: string) {
    if (answered) return;
    const question = questions[currentIndex];
    if (!question || !studentAnswer.trim()) return;

    setEvaluating(true);
    const timeSeconds = Math.max(0, Math.round((Date.now() - questionStartRef.current) / 1000));

    try {
      const res = await fetch("/api/ca/questions/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: question.id, student_answer: studentAnswer, time_taken_seconds: timeSeconds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Evaluation failed");

      setEvaluation(json as AnswerEvaluation);
      setAnswered(true);
      setAnswers((prev) => [
        ...prev,
        {
          questionId: question.id,
          correct: json.percentage >= 50,
          attempted: true,
          negativeMarkingValue: 0,
          selectedOption: null,
          evaluation: json as AnswerEvaluation,
        },
      ]);
    } finally {
      setEvaluating(false);
    }
  }

  function showQuestion(index: number) {
    const savedAnswer = answers.find((answer) => answer.questionId === questions[index]?.id);
    setCurrentIndex(index);
    setSelectedOption(savedAnswer?.selectedOption ?? null);
    setAnswered(Boolean(savedAnswer));
    setEvaluation(savedAnswer?.evaluation ?? null);
    if (!savedAnswer) questionStartRef.current = Date.now();
  }

  async function nextQuestion() {
    if (currentIndex >= questions.length - 1) {
      setSessionEnded(true);
      await logSessionOnce(answers);
      return;
    }
    showQuestion(currentIndex + 1);
  }

  function previousQuestion() {
    if (currentIndex === 0) return;
    showQuestion(currentIndex - 1);
  }

  function practiceAgain() {
    loadQuestions();
  }

  const correct = answers.filter((a) => a.correct).length;
  const wrong = answers.filter((a) => !a.correct && a.attempted).length;
  const skipped = answers.filter((a) => !a.attempted).length;
  const negativeMarksLost = answers.reduce((sum, a) => (!a.correct && a.attempted ? sum + a.negativeMarkingValue : sum), 0);
  const score = Math.round((correct - negativeMarksLost) * 100) / 100;

  return {
    question: questions[currentIndex] || null,
    questions,
    currentIndex,
    selectedOption,
    answered,
    loading,
    sessionEnded,
    answers,
    evaluation,
    evaluating,
    stats: { correct, wrong, skipped, score, total: answers.length },
    selectOption,
    submitMcqAnswer,
    submitDescriptiveAnswer,
    nextQuestion,
    previousQuestion,
    practiceAgain,
  };
}
