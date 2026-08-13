# 06 — Descriptive Answer Evaluation

> The AI evaluates student-written answers to descriptive questions, assigns marks, identifies gaps, and suggests ICAI presentation improvements.

---

## What the Evaluator Does

When a student types or uploads their answer to a descriptive question:

1. Compares answer against stored model answer
2. Assigns marks out of the question's total
3. Shows exactly which marks were earned and why
4. Shows what was missed and what it was worth
5. Suggests ICAI-standard presentation improvements
6. Does NOT simply say "wrong" — always explains why

---

## Evaluation Prompt Template

```
You are evaluating a CA {level} student's answer to the following question.

QUESTION ({marks} marks):
{question_text}

MODEL ANSWER:
{model_answer}

MARK ALLOCATION:
{mark_allocation_json}

STUDENT'S ANSWER:
{student_answer}

Evaluate the student's answer by:
1. Awarding marks for each correct point from the mark allocation
2. Identifying what the student correctly included
3. Identifying what was missed or incorrect
4. Noting any presentation issues (ICAI format problems)
5. Giving improvement suggestions

RULES:
- Be fair — if student expressed correct idea in different words, award the mark
- Be strict — vague or incomplete points do not earn full marks
- For accounting questions: check numbers are correct AND format is correct
- For law questions: check section references are correct
- For numerical questions: check working AND final answer
- Never give marks the student did not earn
- Tone: encouraging, constructive, never harsh

OUTPUT FORMAT (strict JSON):
{
  "marks_awarded": 6,
  "marks_total": 8,
  "percentage": 75,
  "what_was_correct": ["point 1", "point 2"],
  "what_was_missed": ["missed point 1 (worth 1 mark)", "missed point 2 (worth 1 mark)"],
  "presentation_feedback": "Your journal entry format is correct but totals should be double-underlined",
  "improvement_tips": ["Always cite the section number when discussing ICA provisions",
                       "Show 'Balance c/d' before totalling the ledger account"],
  "encouragement": "Good attempt — you got the concept right. Two more marks available if you include the section reference."
}
```

---

## Marks Evaluation Rules by Content Type

### Accounting Practical Questions

Award marks for:
* Correct debit entry (½ mark each typically)
* Correct credit entry (½ mark each typically)
* Correct amount (deduct ½ mark if concept right but amount wrong)
* Correct format (narration, proper headings, totals)
* Correct balance (closing balance correct)

Do NOT penalise:
* Minor spelling differences in account names ("Salary Account" vs "Salaries Account" — both acceptable)
* Abbreviation vs full name (Dr vs Debit — both acceptable)
* Presentation style if meaning is clear

DO penalise:
* Wrong side (debit vs credit reversed)
* Completely wrong account used
* Amounts not matching
* Missing narration entirely (if narration marks specified)

### Law and Theory Questions

Award marks for:
* Correct legal principle stated
* Correct section cited (if applicable to the marks)
* Correct example given
* Correct conclusion/advice

Partial credit rules:
* If student states correct principle but wrong section — ½ marks
* If student gives correct conclusion but no reasoning — ½ marks
* If student gives example but wrong principle — no marks for principle part

For 8-10 mark case scenarios:
* Award marks for: identifying the legal issue, applicable section, analysis of facts, conclusion, and advice
* Each part should be identifiable in the student's answer

### Numerical/Formula Questions

Step-marking applies:
* Student gets marks for each correct step even if final answer wrong
* If formula correct but arithmetic error — award formula marks
* If setup correct but formula wrong — award setup marks only
* Full marks only for correct working AND correct answer

Example (8 mark depreciation question):
Step 1: Correct opening balance identified (1 mark)
Step 2: Correct depreciation calculation (2 marks)
Step 3: Correct disposal entry (2 marks)
Step 4: Correct closing balance (2 marks)
Step 5: Proper format (1 mark)
→ Student can earn 6/8 even with a final arithmetic error

---

## ICAI Presentation Format Feedback

The evaluator specifically checks and comments on ICAI format:

**JOURNAL ENTRIES format check:**
* Date column present?
* Particulars with Dr notation correct?
* LF column (can be blank in practice)?
* Amount columns: Dr and Cr?
* Narration in brackets below entry?
* Double underline at totals?

**LEDGER ACCOUNT format check:**
* T-account format with Dr and Cr sides?
* Date, Particulars, JF, Amount columns?
* "To" prefix for debit entries?
* "By" prefix for credit entries?
* Balance c/d and Balance b/d correct?

**BALANCE SHEET format check:**
* Vertical format (Schedule III for companies)?
* Horizontal format acceptable for Foundation?
* Assets and Liabilities headings?
* Sub-classifications correct?

**LAW ANSWER format check:**
* Issue identified?
* Law stated with section?
* Analysis of facts?
* Conclusion?
* (ILAC format — standard for law answers)

---

## What the Student Sees After Evaluation

```
┌─────────────────────────────────────────────────────┐
│  Your Score: 6/8 marks (75%)                         │
├─────────────────────────────────────────────────────┤
│  What you got right:                                 │
│  • Correct format for journal entry                  │
│  • Correct debit to Machinery Account                │
│  • Correct credit to Cash Account                    │
│  • Depreciation calculation correct (SLM method)     │
│                                                       │
│  What you missed (2 marks):                          │
│  • Depreciation entry in 2nd year not attempted       │
│    (worth 1 mark)                                     │
│  • Asset disposal entry missing                       │
│    (worth 1 mark)                                     │
│                                                       │
│  Presentation feedback:                               │
│  • Good format overall                                │
│  • Remember to double-underline final totals          │
│  • Add narration below each entry                     │
│                                                       │
│  Tip: Always read multi-part questions carefully      │
│     — this question had 3 parts, you answered 2.      │
└─────────────────────────────────────────────────────┘
     [Try Again]  [Next Question]  [View Model Answer]
```
