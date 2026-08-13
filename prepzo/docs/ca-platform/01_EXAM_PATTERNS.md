# 01 — CA Exam Patterns

> The platform must know the exact exam format for each paper before generating any questions.
> This file is the single source of truth for all exam pattern logic.

---

## CA Foundation

| Paper | Name | Format | Marks | Negative Marking |
| ----- | ----- | ----- | ----- | ----- |
| Paper 1 | Principles and Practice of Accounting | **Descriptive only** | 100 | No |
| Paper 2 | Business Laws | **Descriptive only** | 100 | No |
| Paper 3 | Quantitative Aptitude | **MCQ only** | 100 | Yes — −0.25 per wrong |
| Paper 4 | Business Economics | **MCQ only** | 100 | Yes — −0.25 per wrong |

### Foundation MCQ Rules (Paper 3 and Paper 4)

* Each question has exactly 4 options (A, B, C, D)
* One correct answer only
* Negative marking: −0.25 for each wrong answer
* No negative marking for unattempted questions
* Time: 2 hours per paper

### Foundation Descriptive Rules (Paper 1 and Paper 2)

* No MCQs at all
* Question types by marks:
  * **2-mark** — Define / State / Short answer (2-3 lines)
  * **4-mark** — Explain with example (half a page)
  * **8-mark** — Practical problem with full workings
  * **10-mark** — Case scenario + analysis
  * **16-mark** — Comprehensive practical problem
* Students must attempt specific questions (choice given in some)
* Presentation format matters for accounting: proper format scores marks

---

## CA Intermediate

All 6 papers follow the same split:

| Section | Format | Marks |
| ----- | ----- | ----- |
| Section A | MCQ (case-study based, not simple recall) | 30 marks |
| Section B | Descriptive (practical problems + theory) | 70 marks |

### Inter MCQ Rules

* MCQs are scenario/case-study based — a paragraph is given, then questions follow
* NOT simple one-line fact MCQs like Foundation Paper 3/4
* No negative marking in Inter
* 30 marks = approximately 30 questions of 1 mark each

### Inter Descriptive Rules

* Same marks breakdown as Foundation (2, 4, 5, 8, 10 mark questions)
* Higher difficulty — multi-concept integration required
* Accounting entries must follow correct format
* Law answers must cite correct section numbers and provisions

### CA Inter Papers

| Paper | Name | Key Content |
| ----- | ----- | ----- |
| Paper 1 | Advanced Accounting | Accounting Standards, Company Accounts |
| Paper 2 | Corporate and Other Laws | Companies Act 2013, SEBI, FEMA |
| Paper 3 | Taxation | Income Tax, GST |
| Paper 4 | Cost and Management Accounting | Costing methods, Budgeting |
| Paper 5 | Auditing and Ethics | SA standards, Ethics |
| Paper 6 | Financial Management and Strategic Management | FM, SM |

---

## CA Final

All 6 papers follow the same split as Intermediate:

| Section | Format | Marks |
| ----- | ----- | ----- |
| Section A | MCQ (advanced case-study) | 30 marks |
| Section B | Descriptive | 70 marks |

Higher difficulty than Inter. Questions test application and judgement, not just knowledge.

---

## Question Generation Rules by Paper Type

### Rule 1 — Foundation Paper 3 and Paper 4 uploads

When student uploads notes for these papers:

* Generate MCQ questions only
* 4 options per question
* One correct answer
* Show negative marking warning (−0.25)
* Timed practice mode (30 seconds per question)
* No descriptive questions generated

### Rule 2 — Foundation Paper 1 and Paper 2 uploads

When student uploads notes for these papers:

* Generate descriptive questions only
* Tag each question with marks (2/4/8/10/16)
* Generate model answer for each
* Enable answer submission + AI evaluation
* No MCQ generation
* Show ICAI format guidelines

### Rule 3 — Inter and Final paper uploads

When student uploads notes for any Inter or Final paper:

* Generate BOTH types
* 30% MCQ (case-study format)
* 70% Descriptive (marks-tagged)
* No negative marking
* MCQs must be scenario-based where possible
* Descriptive must include section/AS references for law/standards

---

## Paper Detection Logic

When a student uploads a document, the system must identify which paper it belongs to before generating questions. Detection happens by:

1. **Student selects manually** at upload time (preferred — most accurate)
2. **AI auto-detects** from content keywords as fallback:

Paper 1 signals: journal entry, ledger, trial balance, depreciation,
balance sheet, goodwill, partnership, company accounts

Paper 2 signals: contract act, offer, acceptance, sale of goods,
negotiable instruments, partnership act, companies act

Paper 3 signals: ratio, proportion, logarithm, permutation,
combination, statistics, probability, regression

Paper 4 signals: demand, supply, elasticity, GDP, national income,
monetary policy, market structure, inflation

Inter-specific: accounting standards AS-, Ind AS, SEBI, FEMA,
income tax section, GST, cost sheet, audit standard SA-

3. If auto-detection confidence is below 80%, ask student to confirm before generating.
