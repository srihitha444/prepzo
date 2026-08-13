"use client";

export const STUDY_STAGES = [
  "11th Class",
  "12th Class",
  "Dropper",
] as const;

export const TARGET_EXAMS = [
  "NEET UG",
  "JEE",
  "CUET",
  "Other UG exam",
] as const;

interface StudyProfileFieldsProps {
  currentStage: string;
  targetExams: string[];
  onStageChange: (stage: string) => void;
  onTargetExamsChange: (exams: string[]) => void;
}

export function StudyProfileFields({
  currentStage,
  targetExams,
  onStageChange,
  onTargetExamsChange,
}: StudyProfileFieldsProps) {
  function toggleExam(exam: string) {
    if (targetExams.includes(exam)) {
      onTargetExamsChange(targetExams.filter((item) => item !== exam));
      return;
    }
    onTargetExamsChange([...targetExams, exam]);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-[#0F172A]">What are you studying right now?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {STUDY_STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => onStageChange(stage)}
              className={`min-h-[46px] rounded-xl border-2 px-3 text-sm font-semibold transition-all ${
                currentStage === stage
                  ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                  : "border-[#E2E8F0] text-[#64748B] hover:border-[#3B5FBF] hover:text-[#1E3A8A]"
              }`}
            >
              {stage}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-[#0F172A]">Which exams are you preparing for?</p>
        <div className="flex flex-wrap gap-2">
          {TARGET_EXAMS.map((exam) => {
            const selected = targetExams.includes(exam);
            return (
              <button
                key={exam}
                type="button"
                onClick={() => toggleExam(exam)}
                className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold transition-all ${
                  selected
                    ? "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]"
                    : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#3B5FBF] hover:text-[#1E3A8A]"
                }`}
              >
                {exam}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
