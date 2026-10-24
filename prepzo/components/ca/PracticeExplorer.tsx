"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, RotateCcw, ChevronLeft, ChevronRight, FileText, Layers3, Loader2, ImagePlus, Camera, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import type { CaPaper } from "@/lib/ca-syllabus";
import { useCaPractice, type DescriptiveEvaluation } from "@/hooks/useCaPractice";
import { QuestionText } from "@/components/ca/QuestionText";
import {
  MAX_ANSWER_IMAGES,
  MAX_ANSWER_IMAGE_BYTES,
  MAX_ANSWER_SELECTION_BYTES,
  AnswerSubmissionError,
  removeUncommittedAnswerImages,
  type AnswerImageRef,
  type AnswerSubmissionResponse,
} from "@/lib/ca/answerSubmission";

type BrowseMode = "subject" | "pdf";

export interface PracticeSource {
  id: string;
  title: string;
  fileType: "pdf" | "image" | null;
  questionCount: number;
  paper: string | null;
}

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export function DescriptiveAnswerForm({
  value,
  onChange,
  onSubmit,
  evaluating,
}: {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (
    text: string,
    files: File[],
    confirmedAnswer?: string,
    uploadedImages?: AnswerImageRef[]
  ) => Promise<{ result: AnswerSubmissionResponse; images: AnswerImageRef[] }>;
  evaluating: boolean;
}) {
  const [internalValue, setInternalValue] = useState("");
  const [mode, setMode] = useState<"text" | "images">("text");
  const [pages, setPages] = useState<{ file: File; preview: string }[]>([]);
  const [reviewDraft, setReviewDraft] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<AnswerImageRef[]>([]);
  const uploadedImagesRef = useRef<AnswerImageRef[]>([]);
  const pagesRef = useRef(pages);
  const committedRef = useRef(false);
  const text = value ?? internalValue;
  const files = pages.map((page) => page.file);
  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => () => {
    pagesRef.current.forEach((page) => URL.revokeObjectURL(page.preview));
    if (!committedRef.current) void removeUncommittedAnswerImages(uploadedImagesRef.current);
  }, []);

  const updateText = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
  };

  function changeMode(nextMode: "text" | "images") {
    if (mode === nextMode) return;
    if (uploadedImages.length > 0) {
      void removeUncommittedAnswerImages(uploadedImages);
      setUploadedImages([]);
    }
    setReviewDraft(null);
    setMode(nextMode);
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const selected = Array.from(fileList);
    const invalidType = selected.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (invalidType) {
      toast.error("Use JPG, PNG, or WEBP images. Convert HEIC photos to JPG before uploading.");
      return;
    }
    if (selected.some((file) => file.size > MAX_ANSWER_IMAGE_BYTES)) {
      toast.error("Each answer image must be 10MB or smaller.");
      return;
    }
    if ([...files, ...selected].reduce((total, file) => total + file.size, 0) > MAX_ANSWER_SELECTION_BYTES) {
      toast.error("Selected images must be 40MB or smaller in total.");
      return;
    }
    if (pages.length + selected.length > MAX_ANSWER_IMAGES) {
      toast.error(`Upload up to ${MAX_ANSWER_IMAGES} answer pages.`);
      return;
    }
    if (uploadedImages.length > 0) {
      void removeUncommittedAnswerImages(uploadedImages);
      setUploadedImages([]);
    }
    setReviewDraft(null);
    setPages((current) => [...current, ...selected.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  }

  function movePage(index: number, direction: -1 | 1) {
    if (uploadedImages.length > 0) {
      void removeUncommittedAnswerImages(uploadedImages);
      setUploadedImages([]);
    }
    setReviewDraft(null);
    setPages((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  }

  function removePage(index: number) {
    URL.revokeObjectURL(pages[index].preview);
    if (uploadedImages.length > 0) {
      void removeUncommittedAnswerImages(uploadedImages);
      setUploadedImages([]);
    }
    setReviewDraft(null);
    setPages((current) => current.filter((_, i) => i !== index));
  }

  async function submit() {
    if (!onSubmit) return;
    try {
      const { result, images } = await onSubmit(
        mode === "text" ? text : "",
        mode === "images" ? files : [],
        reviewDraft ?? undefined,
        mode === "images" ? uploadedImages : undefined
      );
      if (result.needs_review) {
        setReviewDraft(result.extracted_answer || "");
        setUploadedImages(images);
        return;
      }
      if (typeof result.marks_awarded !== "number") throw new Error("The answer could not be graded.");
      committedRef.current = true;
    } catch (error) {
      if (error instanceof AnswerSubmissionError) setUploadedImages(error.images);
      toast.error(error instanceof Error ? error.message : "Evaluation failed");
    }
  }

  return (
    <>
      {onSubmit && (
        <div className="mt-5 inline-flex rounded-lg border border-[#E2E8F0] bg-white p-1">
          <button type="button" onClick={() => changeMode("text")} disabled={evaluating} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "text" ? "bg-[#1E3A8A] text-white" : "text-[#64748B]"}`}>Type answer</button>
          <button type="button" onClick={() => changeMode("images")} disabled={evaluating} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "images" ? "bg-[#1E3A8A] text-white" : "text-[#64748B]"}`}><ImagePlus size={14} /> Upload pages</button>
        </div>
      )}
      {mode === "text" ? (
        <textarea
          value={text}
          onChange={(e) => updateText(e.target.value)}
          disabled={evaluating}
          placeholder="Write your answer here..."
          rows={9}
          className="mt-3 w-full resize-y rounded-xl border border-[#CBD5E1] bg-[#F8FAFF] px-4 py-3 text-sm leading-relaxed text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none"
        />
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFF] p-4">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#1E3A8A] shadow-sm hover:bg-[#EFF6FF]">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              multiple
              disabled={evaluating || files.length >= MAX_ANSWER_IMAGES}
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
              className="sr-only"
            />
            <Camera size={16} /> Add answer page photos
          </label>
          <p className="mt-2 text-center text-xs text-[#64748B]">JPG, PNG, or WEBP · up to {MAX_ANSWER_IMAGES} pages · 10MB per page · images are compressed before grading</p>
          {files.length > 0 && (
            <ol className="mt-4 space-y-2">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white p-2">
                  {/* Local preview helps students verify page order before grading. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pages[index].preview} alt={`Answer page ${index + 1} preview`} className="h-14 w-12 rounded border border-[#E2E8F0] object-cover" />
                  <span className="min-w-0 flex-1 truncate text-xs text-[#334155]">Page {index + 1}: {file.name}</span>
                  <button type="button" aria-label={`Move page ${index + 1} up`} disabled={index === 0 || evaluating} onClick={() => movePage(index, -1)} className="text-[#64748B] disabled:opacity-30"><ChevronUp size={16} /></button>
                  <button type="button" aria-label={`Move page ${index + 1} down`} disabled={index === files.length - 1 || evaluating} onClick={() => movePage(index, 1)} className="text-[#64748B] disabled:opacity-30"><ChevronDown size={16} /></button>
                  <button type="button" aria-label={`Remove page ${index + 1}`} disabled={evaluating} onClick={() => removePage(index)} className="text-[#DC2626]"><Trash2 size={15} /></button>
                </li>
              ))}
            </ol>
          )}
          {reviewDraft !== null && (
            <div className="mt-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
              <p className="text-xs font-semibold text-[#92400E]">Please review the answer we could read</p>
              <p className="mt-1 text-xs text-[#78350F]">Some handwriting or figures were unclear. Correct the transcription below before we grade it.</p>
              <textarea value={reviewDraft} onChange={(event) => setReviewDraft(event.target.value)} rows={7} disabled={evaluating} className="mt-3 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#1E3A8A] focus:outline-none" />
            </div>
          )}
        </div>
      )}
      {onSubmit && (
        <button
          type="button"
          disabled={evaluating || (mode === "text" ? !text.trim() : files.length === 0 || (reviewDraft !== null && !reviewDraft.trim()))}
          onClick={submit}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#162D6B] disabled:opacity-50"
        >
          {evaluating && <Loader2 size={15} className="animate-spin" />}
          {evaluating ? "Evaluating..." : reviewDraft !== null ? "Submit corrected answer" : "Submit answer"}
        </button>
      )}
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
      {evaluation.answer_image_urls && evaluation.answer_image_urls.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-[#0F172A]">Your submitted pages</p>
          <div className="flex flex-wrap gap-2">
            {evaluation.answer_image_urls.map((url, index) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" aria-label={`View submitted answer page ${index + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Submitted answer page ${index + 1}`} className="h-24 w-20 rounded-lg border border-[#CBD5E1] object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PracticeExplorer({
  papers,
  sources,
  userId,
  noteId,
}: {
  papers: CaPaper[];
  sources: PracticeSource[];
  userId: string;
  noteId?: string;
}) {
  const [browseMode, setBrowseMode] = useState<BrowseMode>(noteId ? "pdf" : "subject");
  // Null intentionally means every subject. A subject only narrows the
  // session after the learner explicitly chooses its pill.
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(noteId || sources[0]?.id || null);
  const [answerDraft, setAnswerDraft] = useState({ questionId: "", text: "" });
  const selectedPaperItem = papers.find((p) => p.code === selectedPaper) || null;
  const selectedSourceItem = sources.find((source) => source.id === selectedSource) || null;
  const subject = browseMode === "subject" ? selectedPaperItem?.name : undefined;
  const activeNoteId = browseMode === "pdf" ? selectedSource : undefined;

  const practice = useCaPractice({
    userId,
    subject,
    noteId: activeNoteId,
    enabled: papers.length > 0,
  });
  const isDescriptive = practice.question?.question_type === "descriptive";

  const answerText = answerDraft.questionId === practice.question?.id ? answerDraft.text : "";

  return (
    <div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Practice questions by</p>
        <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-white p-1">
          <button
            onClick={() => setBrowseMode("subject")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
              browseMode === "subject" ? "bg-[#1E3A8A] text-white" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <Layers3 size={15} /> By subject
          </button>
          <button
            onClick={() => setBrowseMode("pdf")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
              browseMode === "pdf" ? "bg-[#1E3A8A] text-white" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <FileText size={15} /> By PDF
          </button>
        </div>
      </div>

      {browseMode === "subject" && papers.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedPaper(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedPaper === null
                ? "border-[#1E3A8A] bg-[#1E3A8A] text-white"
                : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#3B5FBF]"
            }`}
          >
            All subjects
          </button>
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

      {browseMode === "pdf" && (
        <div className="mt-5">
          {sources.length > 0 ? (
            <div className="space-y-3">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className={`flex min-w-0 items-center gap-3 rounded-2xl border bg-white p-4 shadow-[var(--shadow-card)] ${
                    selectedSourceItem?.id === source.id
                      ? "border-[#1E3A8A] bg-[#EFF6FF] shadow-sm"
                      : "border-[#E2E8F0]"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#1E3A8A]"><FileText size={17} /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#0F172A]">{source.title}</span>
                    <span className="mt-0.5 block text-xs text-[#64748B]">
                      {source.paper || "CA practice"} · {source.questionCount} question{source.questionCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  <button
                    onClick={() => setSelectedSource(source.id)}
                    className={`ml-auto shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                      selectedSourceItem?.id === source.id
                        ? "bg-[#1E3A8A] text-white"
                        : "border border-[#CBD5E1] text-[#1E3A8A] hover:border-[#1E3A8A]"
                    }`}
                  >
                    {selectedSourceItem?.id === source.id ? "Practicing" : "Start practice"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#64748B]">No uploaded PDFs have practice questions yet. Generate questions from Upload first.</p>
          )}
        </div>
      )}

      {practice.loading ? (
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
          No questions are available for {selectedPaperItem?.name || selectedSourceItem?.title || "this selection"} yet — upload a PDF and generate practice questions first.
        </div>
      ) : (
        <>
        <div className="mt-6 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-full bg-[#DBEAFE] px-2.5 py-1 text-xs font-medium text-[#1E3A8A]">
              Question {practice.currentIndex + 1} of {practice.questions.length}
            </span>
            {!isDescriptive && practice.question.negative_marking_value > 0 && (
              <span className="text-xs text-[#DC2626]">−{practice.question.negative_marking_value} if wrong</span>
            )}
            {isDescriptive && practice.question.marks && (
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

          {!isDescriptive ? (
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
                      onClick={() => practice.selectOption(key)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                        showResult && isCorrectOption
                          ? "border-[#16A34A] bg-[#DCFCE7] font-medium text-[#15803D]"
                          : showResult && isSelected && !isCorrectOption
                            ? "border-[#DC2626] bg-[#FEE2E2] font-medium text-[#DC2626]"
                            : isSelected
                              ? "border-[#1E3A8A] bg-[#EFF6FF] font-medium text-[#1E3A8A]"
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
            <DescriptiveAnswerForm
              key={practice.question.id}
              value={answerText}
              onChange={(text) => setAnswerDraft({ questionId: practice.question!.id, text })}
              onSubmit={(text, files, confirmedAnswer, uploadedImages) =>
                practice.submitDescriptiveAnswer(text, files, confirmedAnswer, uploadedImages)
              }
              evaluating={practice.evaluating}
            />
          )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#E2E8F0] pt-4">
            <button
              onClick={practice.previousQuestion}
              disabled={practice.currentIndex === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-sm font-semibold text-[#475569] transition-all hover:border-[#3B5FBF] hover:text-[#1E3A8A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Previous question
            </button>
            <button
              onClick={practice.nextQuestion}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E3A8A] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#162D6B]"
            >
              {practice.currentIndex >= practice.questions.length - 1 ? "Finish" : "Next question"} <ChevronRight size={16} />
            </button>
        </div>
        </div>
        {!practice.answered && !isDescriptive && (
          <div className="mt-4 flex justify-end">
            <button
              disabled={practice.evaluating || (isDescriptive ? !answerText.trim() : !practice.selectedOption)}
              onClick={async () => {
                try {
                  if (isDescriptive) await practice.submitDescriptiveAnswer(answerText);
                  else await practice.submitMcqAnswer();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not submit your answer");
                }
              }}
              className="rounded-xl bg-[#1E3A8A] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#162D6B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {practice.evaluating ? "Evaluating..." : "Submit answer"}
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}
