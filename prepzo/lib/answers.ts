export function getCorrectOptions(correctOption: string | null | undefined): string[] {
  if (!correctOption) return [];
  return correctOption
    .split(",")
    .map((option) => option.trim().toUpperCase())
    .filter(Boolean);
}

export function isCorrectOption(selected: string | null | undefined, correctOption: string | null | undefined): boolean {
  if (!selected) return false;
  return getCorrectOptions(correctOption).includes(selected.trim().toUpperCase());
}

export function formatCorrectOptions(correctOption: string | null | undefined): string {
  return getCorrectOptions(correctOption).join(", ");
}
