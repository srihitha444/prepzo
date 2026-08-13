"""
Extract PYQ questions from a PDF into reviewable JSON/CSV files.

Usage:
  py scripts/extract_pyq.py path/to/paper.pdf --year 2026 --booklet-code 11

Install deps:
  py -m pip install pymupdf pandas

The output is meant for review before import. PDF layouts vary a lot, so this
script extracts text conservatively and flags rows where options are missing.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import fitz
import pandas as pd


ANSWER_KEY_SET_11 = {
    1: 4, 2: 4, 3: 4, 4: 3, 5: 3, 6: 4, 7: 1, 8: 3, 9: 4, 10: 3,
    11: 4, 12: 2, 13: 4, 14: 4, 15: 1, 16: 2, 17: 1, 18: 4, 19: 4, 20: 3,
    21: 2, 22: 4, 23: 1, 24: 3, 25: 3, 26: 3, 27: 1, 28: 3, 29: 4, 30: 4,
    31: 4, 32: 1, 33: 4, 34: 4, 35: 2, 36: 1, 37: 4, 38: 4, 39: 1, 40: 2,
    41: 3, 42: 3, 43: 2, 44: 1, 45: 3,
    46: 2, 47: 4, 48: 3, 49: 3, 50: 4, 51: 2, 52: 4, 53: 4, 54: 2, 55: 1,
    56: 1, 57: 3, 58: 4, 59: 2, 60: 1, 61: 4, 62: 4, 63: 3, 64: 1, 65: 2,
    66: 4, 67: 2, 68: 2, 69: 2, 70: 1, 71: 1, 72: 2, 73: 2, 74: 2, 75: 1,
    76: 1, 77: 3, 78: 2, 79: 4, 80: 3, 81: 4, 82: 2, 83: 4, 84: 2, 85: 3,
    86: 1, 87: 2, 88: 1, 89: 2, 90: 3,
    91: 4, 92: 2, 93: 3, 94: 3, 95: 1, 96: 1, 97: 3, 98: 1, 99: 4, 100: 4,
    101: 4, 102: 2, 103: 4, 104: 4, 105: 2, 106: 3, 107: 1, 108: 1, 109: 3, 110: 1,
    111: 4, 112: 1, 113: 3, 114: 4, 115: 1, 116: 3, 117: 1, 118: 2, 119: 1, 120: 4,
    121: 4, 122: 2, 123: 2, 124: 1, 125: 4, 126: 3, 127: 3, 128: 3, 129: 4, 130: 2,
    131: 1, 132: 3, 133: 1, 134: 2, 135: 2,
    136: 3, 137: 4, 138: 3, 139: 1, 140: 3, 141: 3, 142: 4, 143: 1, 144: 1, 145: 3,
    146: 4, 147: 2, 148: 4, 149: 1, 150: 2, 151: 3, 152: 1, 153: 4, 154: 2, 155: 1,
    156: 2, 157: 3, 158: 4, 159: 1, 160: 1, 161: 4, 162: 2, 163: 2, 164: 4, 165: 2,
    166: 4, 167: 2, 168: 3, 169: 1, 170: 3, 171: 1, 172: 1, 173: 4, 174: 4, 175: 4,
    176: 3, 177: 1, 178: 1, 179: 3, 180: 3,
}

OPTION_MAP = {1: "A", 2: "B", 3: "C", 4: "D"}
QUESTION_RE = re.compile(r"(?m)(?:^|\n)\s*(?:Q\.?\s*)?(\d{1,3})[\).]\s+")
OPTION_RE = re.compile(
    r"(?is)(?:^|\s)(?:\(?([1-4A-Da-d])\)?|([A-Da-d])[\).])\s+"
)


@dataclass
class ExtractedQuestion:
    exam: str
    year: int
    booklet_code: str
    question_number: int
    subject: str
    chapter: str | None
    topic: str | None
    question_text: str
    option_a: str | None
    option_b: str | None
    option_c: str | None
    option_d: str | None
    correct_option: str | None
    marks_correct: int
    marks_wrong: int
    marks_unattempted: int
    needs_review: bool


def get_subject(question_number: int) -> str:
    if question_number <= 45:
        return "Physics"
    if question_number <= 90:
        return "Chemistry"
    return "Biology"


def clean_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def read_pdf_text(pdf_path: Path) -> str:
    with fitz.open(pdf_path) as doc:
        pages = [page.get_text("text", sort=True) for page in doc]
    return "\n".join(pages)


def split_question_blocks(text: str) -> Iterable[tuple[int, str]]:
    matches = list(QUESTION_RE.finditer(text))
    for index, match in enumerate(matches):
        question_number = int(match.group(1))
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        if 1 <= question_number <= 180:
            yield question_number, text[start:end]


def parse_options(block: str) -> tuple[str, dict[str, str | None]]:
    matches = list(OPTION_RE.finditer(block))
    if len(matches) < 4:
        return clean_text(block), {"A": None, "B": None, "C": None, "D": None}

    question_text = clean_text(block[: matches[0].start()])
    options: dict[str, str | None] = {"A": None, "B": None, "C": None, "D": None}

    for index, match in enumerate(matches[:4]):
        label = (match.group(1) or match.group(2) or "").upper()
        if label in {"1", "2", "3", "4"}:
            label = OPTION_MAP[int(label)]
        if label not in options:
            continue

        start = match.end()
        end = matches[index + 1].start() if index + 1 < min(len(matches), 4) else len(block)
        options[label] = clean_text(block[start:end])

    return question_text, options


def extract_questions(args: argparse.Namespace) -> list[ExtractedQuestion]:
    answer_key = ANSWER_KEY_SET_11 if args.booklet_code == "11" and args.year == 2026 else {}
    rows: list[ExtractedQuestion] = []

    for question_number, block in split_question_blocks(read_pdf_text(args.pdf)):
        question_text, options = parse_options(block)
        correct_option = OPTION_MAP.get(answer_key.get(question_number))
        needs_review = not question_text or any(options[key] is None for key in ("A", "B", "C", "D"))

        rows.append(
            ExtractedQuestion(
                exam=args.exam,
                year=args.year,
                booklet_code=args.booklet_code,
                question_number=question_number,
                subject=get_subject(question_number),
                chapter=None,
                topic=None,
                question_text=question_text,
                option_a=options["A"],
                option_b=options["B"],
                option_c=options["C"],
                option_d=options["D"],
                correct_option=correct_option,
                marks_correct=4,
                marks_wrong=-1,
                marks_unattempted=0,
                needs_review=needs_review,
            )
        )

    return sorted(rows, key=lambda row: row.question_number)


def write_outputs(rows: list[ExtractedQuestion], output_dir: Path, stem: str) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    data = [asdict(row) for row in rows]

    json_path = output_dir / f"{stem}.json"
    csv_path = output_dir / f"{stem}.csv"

    json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    pd.DataFrame(data).to_csv(csv_path, index=False)

    print(f"Extracted {len(rows)} questions")
    print(f"JSON: {json_path}")
    print(f"CSV:  {csv_path}")
    print(f"Needs review: {sum(1 for row in rows if row.needs_review)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract PYQ questions from a PDF.")
    parser.add_argument("pdf", type=Path, help="Path to the PYQ PDF")
    parser.add_argument("--exam", default="NEET")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--booklet-code", required=True)
    parser.add_argument("--out-dir", type=Path, default=Path("content/pyq/extracted"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.pdf.exists():
        raise SystemExit(f"PDF not found: {args.pdf}")

    stem = f"{args.exam.lower()}-{args.year}-set-{args.booklet_code}"
    write_outputs(extract_questions(args), args.out_dir, stem)


if __name__ == "__main__":
    main()
