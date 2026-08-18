"use client";

import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import type { CaPaper } from "@/lib/ca-syllabus";
import { useCaMockTest } from "@/hooks/useCaMockTest";
import { DescriptiveAnswerForm, EvaluationResult } from "@/components/ca/PracticeExplorer";
import { TestPapersPanel } from "@/components/ca/TestPapersPanel";
import { QuestionText } from "@/components/ca/QuestionText";
import { ResizableSplit } from "@/components/ca/ResizableSplit";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function TestRunner({
  userId,
  paper,
  testPaperId,
  onExit,
}: {
  userId: string;
  paper: CaPaper;
  testPaperId?: string;
  onExit: () => void;
}) {
  const test = useCaMockTest({ userId, paper, testPaperId });

  if (test.loading) {
    return (
      <p className="mt-6 text-sm text-[#64748B]">
        {testPaperId ? "Loading questions from this paper..." : "Assembling questions from your notes..."}
      </p>
    );
  }

  if (test.questions.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 text-center text-sm text-[#64748B] shadow-[var(--shadow-card)]">
        {testPaperId
          ? "No questions could be extracted from this paper."
          : `No ${paper.name} questions available yet — upload notes for this paper first.`}
      </div>
    );
  }

  if (test.submitted && test.result) {
    return (
      <div className="mt-6 rounded-2xl bg-[#1E3A8A] p-6 text-center text-white shadow-[var(--shadow-card)]">
        <p className="font-[family-name:var(--font-fraunces)] text-2xl font-bold">
          {test.result.totalScore}/{test.result.totalPossible}
        </p>
        <p className="mt-1 text-sm text-white/70">
          MCQ: {test.result.mcqScore} · Descriptive: {test.result.descriptiveScore}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button onClick={test.restart} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A8A] hover:bg-[#F8FAFF]">
            <RotateCcw size={15} /> Retake
          </button>
          <button onClick={onExit} className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
            Done
          </button>
        </div>
      </div>
    );
  }

  const q = test.currentQuestion;
  if (!q) return null;
  const mcqAnswer = test.mcqAnswers[q.id];
  const descriptiveAnswer = test.descriptiveAnswers[q.id];

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {test.questions.map((question, i) => {
          const isAnswered = question.question_type === "mcq" ? Boolean(test.mcqAnswers[question.id]) : Boolean(test.descriptiveAnswers[question.id]?.evaluation);
          return (
            <button
              key={question.id}
              onClick={() => test.goTo(i)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                i === test.currentIndex
                  ? "bg-[#1E3A8A] text-white"
                  : isAnswered
                    ? "bg-[#DCFCE7] text-[#15803D]"
                    : "border border-[#E2E8F0] bg-white text-[#64748B]"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <ResizableSplit
        left={
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-[#DBEAFE] px-2.5 py-1 text-xs font-medium text-[#1E3A8A]">
                {q.question_type === "mcq" ? "MCQ" : `Descriptive · ${q.marks ?? "?"} marks`}
              </span>
              <span className="text-xs text-[#64748B]">{test.answeredCount}/{test.questions.length} answered</span>
            </div>

            {q.question_type === "mcq" && !q.correct_option && (
              <p className="mb-3 rounded-lg bg-[#FEF3C7] px-3 py-2 text-xs text-[#92400E]">
                No answer key was found for this question in the uploaded paper — you can still answer it, but it won&apos;t count toward your score.
              </p>
            )}
            {q.question_type === "descriptive" && q.marks == null && (
              <p className="mb-3 rounded-lg bg-[#FEF3C7] px-3 py-2 text-xs text-[#92400E]">
                No marks value was found for this question in the uploaded paper — you&apos;ll still get feedback on your answer, but it won&apos;t count toward your score.
              </p>
            )}

            {q.case_study_passage && (
              <div className="mb-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1E3A8A]">Case Study</p>
                <QuestionText text={q.case_study_passage} className="text-sm leading-relaxed text-[#0F172A]" />
              </div>
            )}

            <QuestionText text={q.question_text} className="text-sm font-medium leading-relaxed text-[#0F172A]" />
          </div>
        }
        right={
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[var(--shadow-card)]">
            {q.question_type === "mcq" ? (
              <div className="space-y-2">
                {OPTION_KEYS.map((key) => {
                  const text = q[`option_${key.toLowerCase()}` as "option_a"];
                  if (!text) return null;
                  const isSelected = mcqAnswer?.selected === key;
                  return (
                    <button
                      key={key}
                      onClick={() => test.answerMcq(q, key)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                        isSelected ? "border-[#1E3A8A] bg-[#DBEAFE] font-medium text-[#1E3A8A]" : "border-[#E2E8F0] text-[#0F172A] hover:border-[#3B5FBF]"
                      }`}
                    >
                      <span className="font-medium text-[#64748B]">{key}.</span> {text}
                      {isSelected && <Check size={15} className="ml-auto shrink-0 text-[#1E3A8A]" />}
                    </button>
                  );
                })}
              </div>
            ) : descriptiveAnswer?.evaluation ? (
              <EvaluationResult evaluation={descriptiveAnswer.evaluation} />
            ) : (
              <DescriptiveAnswerForm
                key={q.id}
                onSubmit={async (text) => {
                  try {
                    await test.submitDescriptive(q, text);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Evaluation failed");
                  }
                }}
                evaluating={Boolean(descriptiveAnswer?.evaluating)}
              />
            )}
          </div>
        }
      />

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => test.goTo(test.currentIndex - 1)}
          disabled={test.currentIndex === 0}
          className="rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold text-[#64748B] disabled:opacity-40"
        >
          Previous
        </button>
        {test.currentIndex >= test.questions.length - 1 ? (
          <button
            onClick={test.finish}
            disabled={test.submitting}
            className="rounded-xl bg-[#1E3A8A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#162D6B] disabled:opacity-60"
          >
            {test.submitting ? "Submitting..." : "Submit"}
          </button>
        ) : (
          <button
            onClick={() => test.goTo(test.currentIndex + 1)}
            className="rounded-xl bg-[#1E3A8A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#162D6B]"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

type ActiveTest = { paper: CaPaper; testPaperId?: string } | null;

export function MockTestRunner({ papers, userId }: { papers: CaPaper[]; userId: string }) {
  const [active, setActive] = useState<ActiveTest>(null);

  if (active) {
    return (
      <TestRunner
        userId={userId}
        paper={active.paper}
        testPaperId={active.testPaperId}
        onExit={() => setActive(null)}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-sm font-semibold text-[#0F172A]">Practice Set</h2>
        <p className="text-sm text-[#64748B]">
          Pick a paper to practice a mixed set of MCQ and descriptive questions from your uploaded notes, in that paper&apos;s real format.
        </p>
        <div className="mt-4 space-y-2">
          {papers.map((paper) => (
            <button
              key={paper.code}
              onClick={() => setActive({ paper })}
              className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-4 py-3.5 text-left text-sm font-semibold text-[#0F172A] shadow-[var(--shadow-card)] transition-all hover:border-[#3B5FBF]"
            >
              {paper.name}
              <span className="text-xs font-normal text-[#64748B]">
                {paper.format === "mixed" ? "MCQ + Descriptive" : paper.format === "objective" ? "MCQ only" : "Descriptive only"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[#E2E8F0] pt-6">
        <h2 className="mb-1 text-sm font-semibold text-[#0F172A]">Your Real Papers</h2>
        <TestPapersPanel
          userId={userId}
          onAttempt={(testPaperId, paper) => setActive({ paper, testPaperId })}
        />
      </div>
    </div>
  );
}
