"use client";

import { cn } from "@/lib/utils";

interface OptionButtonProps {
  label: string;
  text: string;
  selected: boolean;
  correct?: boolean;
  wrong?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function OptionButton({ label, text, selected, correct, wrong, disabled, onClick }: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 text-left text-sm transition-all min-h-[44px] font-medium",
        !selected && !correct && !wrong && "border-[#E2E8F0] hover:border-[#3B5FBF] hover:bg-[#F8FAFF] text-[#0F172A]",
        selected && !correct && !wrong && "border-[#1E3A8A] bg-[#DBEAFE] text-[#1E3A8A]",
        correct && "border-[#16A34A] bg-[#DCFCE7] text-[#15803D]",
        wrong && "border-[#DC2626] bg-[#FEE2E2] text-[#DC2626]",
        disabled && "cursor-not-allowed opacity-80",
      )}
    >
      <span className={cn(
        "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs shrink-0 mt-0.5 font-bold",
        !selected && !correct && !wrong && "border-[#E2E8F0] text-[#64748B]",
        selected && !correct && !wrong && "border-[#1E3A8A] bg-[#1E3A8A] text-white",
        correct && "border-[#16A34A] bg-[#16A34A] text-white",
        wrong && "border-[#DC2626] bg-[#DC2626] text-white",
      )}>
        {correct ? "✓" : wrong ? "✗" : label}
      </span>
      <span className="flex-1 leading-snug">{text}</span>
    </button>
  );
}
