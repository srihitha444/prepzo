import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// IST = UTC+5:30. All daily resets use IST midnight.
export function getISTDate(): string {
  const istMs = Date.now() + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).toISOString().split("T")[0];
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 70) return "text-[#16A34A]";
  if (accuracy >= 50) return "text-[#D97706]";
  return "text-[#DC2626]";
}

export function getSubjectsForExam(exam: string): string[] {
  if (exam === "NEET") {
    return ["Physics", "Chemistry", "Botany", "Zoology"];
  }
  return [];
}

export function getNegativeMarking(): number {
  return 1 / 3;
}

export function getDaysUntilDue(nextDueAt: string | null): number {
  if (!nextDueAt) return 0;
  const diff = new Date(nextDueAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function calculateSpacedRepetitionDue(timesCorrect: number): Date {
  const intervals = [1, 3, 7, 14, 30, 60];
  const interval = intervals[Math.min(timesCorrect, intervals.length - 1)];
  const due = new Date();
  due.setDate(due.getDate() + interval);
  return due;
}

export function formatCurrency(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export const EXAM_COLORS: Record<string, string> = {
  NEET: "#16A34A",
};

export const EXAM_ICONS: Record<string, string> = {
  NEET: "🧬",
};
