"use client";

import { useState } from "react";
import { Check, X, RotateCcw, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { CaPaper } from "@/lib/ca-syllabus";
import { useCaPractice, type DescriptiveEvaluation } from "@/hooks/useCaPractice";
import { QuestionText } from "@/components/ca/QuestionText";

type Mode = "mcq" | "descriptive";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export function DescriptiveAnswerForm({
  onSubmit,
  evaluating,
}: {
  onSubmit: (text: string) => Promise<void>;
  evaluating: boolean;
}) {
  const [text, setText] = useState("");

  return (
    <>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={evaluating}
        placeholder="Type your answer here..."
        rows={7}
        className="mt-4 w-full resize-none rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] px-4 py-3 text-sm text-[#0F172A] focus:border-[#3B5FBF] focus:outline-none"
      />
      <button
        disabled={evaluating || !text.trim()}
        onClick={async () => {
          try {
            await onSubmit(text);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Evaluation failed");
          }
        }}
        className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#162D6B] disabled:opacity-50"
      >
        {evaluating && <Loader2 size={15} className="animate-spin" />}
        {evaluating ? "Evaluating..." : "Submit answer"}
      </button>
    </>
  );
}

export function EvaluationResult({ evaluation }: { evaluation: DescriptiveEvaluation }) {
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl bg-[#F8FAFF] p-4 text-center">
        <p className="text-2xl font-bold text-[#0F172A]">
          {evaluation.marks_awarded}/{evaluation.marks_total}
        </p>
        <p className="text-xs text-[#64748B]">{evaluation.percentage}% scored</p>
      </div>

      {evaluation.what_was_correct.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-[#16A34A]">What you got right</p>
          <ul className="space-y-1">
            {evaluation.what_was_correct.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#0F172A]">
                <Check size={13} className="mt-0.5 shrink-0 text-[#16A34A]" /> {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.what_was_missed.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-[#D97706]">What you missed</p>
          <ul className="space-y-1">
            {evaluation.what_was_missed.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#0F172A]">
                <X size={13} className="mt-0.5 shrink-0 text-[#D97706]" /> {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.presentation_feedback && (
        <div>
          <p className="mb-1 text-xs font-semibold text-[#0F172A]">Presentation feedback</p>
          <p className="text-xs text-[#64748B]">{evaluation.presentation_feedback}</p>
        </div>
      )}

      {evaluation.improvement_tips.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-[#0F172A]">Improvement tips</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-[#64748B]">
            {evaluation.improvement_tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.encouragement && (
        <p className="rounded-xl bg-[#DBEAFE] p-3 text-xs text-[#1E3A8A]">{evaluation.encouragement}</p>
      )}
    </div>
  );
}

export function PracticeExplorer({ papers, userId, noteId }: { papers: CaPaper[]; userId: string; noteId?: string }) {
  const [mode, setMode] = useState<Mode>("mcq");
  const [selectedPaper, setSelectedPaper] = useState<string | null>(papers[0]?.code ?? null);
  const paper = papers.find((p) => p.code === selectedPaper) || papers[0] || null;

  const practice = useCaPractice({
    userId,
    subject: paper?.name,
    noteId,
    questionType: mode,
    enabled: Boolean(paper),
  });

  return (
    <div>
      <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-white p-1">
        {(["mcq", "descriptive"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              mode === m ? "bg-[#1E3A8A] text-white" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {m === "mcq" ? "MCQ" : "Descriptive"}
          </button>
        ))}
      </div>

      {papers.length > 1 && !noteId && (
        <div className="mt-5 flex flex-wrap gap-2">
          {papers.map((p) => (
            <button
              key={p.code}
              onClick={() => setSelectedPaper(p.code)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedPaper === p.code
                  ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                  : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#3B5FBF]"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {!paper ? (
        <p className="mt-6 text-sm text-[#64748B]">Select a paper to start practicing.</p>
      ) : practice.loading ? (
        <div className="mt-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 text-center text-sm text-[#64748B] shadow-[var(--shadow-card)]">
          Loading questions...
        </div>
      ) : practice.sessionEnded ? (
        <div className="mt-6 rounded-2xl bg-[#1E3A8A] p-6 text-center text-white shadow-[var(--shadow-card)]">
          <p className="font-[family-name:var(--font-fraunces)] text-2xl font-bold">Session complete</p>
          <p className="mt-1 text-sm text-white/70">
            {practice.stats.correct}/{practice.stats.total} correct · score {practice.stats.score}
          </p>
          <button
            onClick={practice.practiceAgain}
            className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#1E3A8A] hover:bg-[#F8FAFF]"
          >
            <RotateCcw size={15} /> Practice again
          </button>
        </div>
      ) : !practice.question ? (
        <div className="mt-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 text-center text-sm text-[#64748B] shadow-[var(--shadow-card)]">
          No {mode === "mcq" ? "MCQ" : "descriptive"} questions available for this paper yet — upload some notes to generate practice questions.
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-full bg-[#DBEAFE] px-2.5 py-1 text-xs font-medium text-[#1E3A8A]">
              Question {practice.currentIndex + 1} of {practice.questions.length}
            </span>
            {mode === "mcq" && practice.question.negative_marking_value > 0 && (
              <span className="text-xs text-[#DC2626]">−{practice.question.negative_marking_value} if wrong</span>
            )}
            {mode === "descriptive" && practice.question.marks && (
              <span className="text-xs text-[#64748B]">{practice.question.marks} marks</span>
            )}
          </div>

          {practice.question.case_study_passage && (
            <div className="mb-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1E3A8A]">Case Study</p>
              <QuestionText text={practice.question.case_study_passage} className="text-sm leading-relaxed text-[#0F172A]" />
            </div>
          )}

          <QuestionText text={practice.question.question_text} className="text-sm font-medium leading-relaxed text-[#0F172A]" />

          {mode === "mcq" ? (
            <>
              <div className="mt-4 space-y-2">
                {OPTION_KEYS.map((key) => {
                  const text = practice.question![`option_${key.toLowerCase()}` as "option_a"];
                  if (!text) return null;
                  const isSelected = practice.selectedOption === key;
                  const isCorrectOption = practice.question!.correct_option === key;
                  const showResult = practice.answered;

                  return (
                    <button
                      key={key}
                      disabled={practice.answered}
                      onClick={() => practice.handleAnswer(key)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                        showResult && isCorrectOption
                          ? "border-[#16A34A] bg-[#DCFCE7] font-medium text-[#15803D]"
                          : showResult && isSelected && !isCorrectOption
                            ? "border-[#DC2626] bg-[#FEE2E2] font-medium text-[#DC2626]"
                            : "border-[#E2E8F0] text-[#0F172A] hover:border-[#3B5FBF]"
                      }`}
                    >
                      <span className="font-medium text-[#64748B]">{key}.</span>
                      {text}
                      {showResult && isCorrectOption && <Check size={15} className="ml-auto shrink-0 text-[#16A34A]" />}
                      {showResult && isSelected && !isCorrectOption && <X size={15} className="ml-auto shrink-0 text-[#DC2626]" />}
                    </button>
                  );
                })}
              </div>

              {practice.answered && practice.question.explanation && (
                <p className="mt-4 rounded-xl bg-[#F8FAFF] p-3 text-xs text-[#64748B]">{practice.question.explanation}</p>
              )}
            </>
          ) : practice.evaluation ? (
            <EvaluationResult evaluation={practice.evaluation} />
          ) : (
            <DescriptiveAnswerForm key={practice.question.id} onSubmit={practice.submitDescriptiveAnswer} evaluating={practice.evaluating} />
          )}

          {practice.answered && (
            <button
              onClick={practice.nextQuestion}
              className="mt-6 w-full rounded-xl bg-[#1E3A8A] py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#162D6B] sm:w-auto sm:px-8"
            >
              {practice.currentIndex >= practice.questions.length - 1 ? "Finish" : "Next question"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
