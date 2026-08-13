# 04 — Questions

How questions are structured, templated, and generated for each CA level and paper. The template is fixed per paper — Gemini fills the content, it does not decide the structure.

---

## Core Principle

The student's account level determines the template. The content mapping (see 03_CONTENT_MAPPING.md) determines the paper. Together they define exactly what questions get generated — Gemini has no discretion over structure, only over content.

---

## What a Question Can Be

Every generated question is one of two types:

**MCQ**
Four options, one correct answer, one explanation.
Used for: Foundation Paper 3, Foundation Paper 4, and the MCQ section of all Inter and Final papers.

**DESCRIPTIVE**
An open question requiring a written answer.
Has a marks value, a model answer, and a mark allocation.
Used for: Foundation Paper 1, Foundation Paper 2, and the descriptive section of all Inter and Final papers.

A question can also contain a table as part of its body. This is not a separate question type — it is a standard MCQ or descriptive question where the question text includes a rendered table. When the content block is a table or the question requires numerical data to be meaningful, a table must be generated and embedded in the question. This is not optional.

---

## Foundation Templates

### Paper 1 — Accounting (Descriptive only)

For every content block mapped to this paper, generate:

Per text block:
* 1 question of 2 marks
* 1 question of 4 marks

Per table block:
* 1 question of 4 marks (must include the table in question body)
* 1 question of 8 marks (must include the table in question body)

Per formula block:
* 1 question of 4 marks (numerical, must show workings in model answer)
* 1 question of 8 marks (numerical, multi-step)

Per legal block (if any appears in accounting context):
* 1 question of 2 marks

No MCQs generated for this paper under any circumstances.
No negative marking applies.

Question types by marks:

**2 marks:**
* Define [term]
* State [principle or rule]
* What is meant by [concept]
* Give one example of [concept]
* Give the journal entry for [simple transaction]

**4 marks:**
* Explain [concept] with an example
* Distinguish between [A] and [B]
* Prepare [simple financial statement] from the given data
* Calculate [value] showing full workings
* Record the journal entries for the following transactions: [table]

**8 marks:**
* Prepare [complete financial statement] from the following: [table]
* From the following trial balance, prepare Trading and P&L Account
* Calculate depreciation for [years] under SLM and WDV methods
* Record all entries in [party's] books for the following bill transactions
* Prepare the Partner's Capital Account from the following information

Model answer rules for Paper 1:

* All accounting entries must follow ICAI journal entry format
* T-accounts must show Dr and Cr sides with To/By prefixes
* Financial statements must follow proper heading format
* Totals must be double-underlined
* Narrations must be included below each journal entry
* Marks allocation must show which step earns which marks
* Indian number format throughout: 1,00,000 not 100,000

---

### Paper 2 — Business Laws (Descriptive only)

For every content block mapped to this paper, generate:

Per text block:
* 1 question of 2 marks
* 1 question of 4 marks

Per legal block:
* 1 question of 2 marks (define or state the provision)
* 1 question of 4 marks (explain with example)
* 1 question of 8 marks (case scenario — apply the provision)

No MCQs generated for this paper under any circumstances.
No tables generated — Paper 2 is entirely prose-based.
No negative marking applies.

Question types by marks:

**2 marks:**
* Define [legal term]
* State Section [X] of [Act]
* What is meant by [concept]
* Give one example of [legal concept]

**4 marks:**
* State the provisions of Section [X] of [Act]
* Explain [concept] with an example
* Distinguish between [A] and [B] with reference to [Act]
* What are the essentials of [legal concept]

**8 marks:**
* [Case scenario]. Advise [party] with reference to relevant provisions of [Act].
* Explain [major concept] covering all important aspects with reference to [Act].
* [Situation described]. State the legal position of [party] with reasons.

Model answer rules for Paper 2:

* All answers must follow ILAC format for case scenarios:
  Issue — identify the legal issue
  Law — state the applicable section and act
  Application — apply the law to the facts
  Conclusion — advise the party clearly
* Section numbers must always be cited
* Act name and year must always be included
* Marks allocation must map to ILAC steps

---

### Paper 3 — Quantitative Aptitude (MCQ only)

For every content block mapped to this paper, generate:

Per text block:
* 2 MCQs (conceptual understanding)

Per formula block:
* 3 MCQs:
  1 direct application (calculate the answer)
  1 reverse (find a missing variable)
  1 conceptual (what does this variable mean)

Per table block (statistical data):
* 3 MCQs based on the data in the table

Negative marking applies: −0.25 per wrong answer.
This must be visible on every question.
No descriptive questions generated for this paper.

MCQ structure:

* 4 options: A, B, C, D
* One correct answer only
* Distractor options must be plausible (common calculation errors, not obviously wrong values)
* Explanation must show full working for numerical questions
* Indian number format throughout
* Difficulty distribution per upload session: 40% Easy, 40% Medium, 20% Hard

---

### Paper 4 — Business Economics (MCQ only)

For every content block mapped to this paper, generate:

Per text block:
* 3 MCQs (conceptual and application)

Per diagram block (demand/supply curves, production graphs):
* 2 MCQs based on interpreting the diagram

Negative marking applies: −0.25 per wrong answer.
No descriptive questions generated for this paper.

MCQ structure: same rules as Paper 3.

Economics-specific rules:

* Questions must use Indian economic examples where possible (RBI, Indian GDP figures, Indian market examples)
* Diagram questions must describe what the diagram shows in the question text — student should not need to see the original diagram to answer
* Numerical questions use realistic Indian economic data

---

## Intermediate Templates

All Intermediate papers follow the same split:

30% of output — MCQ (scenario-based)
70% of output — Descriptive (practical + theory)
No negative marking for any Intermediate paper.

### MCQ section (applies to all Inter papers)

Per content block:
* 2 scenario-based MCQs

Scenario-based means:
* A paragraph describes a real business situation
* The question asks what the correct treatment or answer is
* Options test application, not recall
* Student must read and understand the scenario to answer — cannot answer from memory alone

Example structure:
"M/s ABC Ltd, a listed company incorporated in 2019, has 250 shareholders and paid-up capital of ₹50 lakhs. The company wants to issue debentures to raise funds. As per Companies Act 2013, which of the following statements is correct regarding this issuance?"

No negative marking.
4 options, one correct answer, full explanation.

### Descriptive section (applies to all Inter papers)

Per content block, generate based on content type:

Per text block:
* 1 question of 4 marks
* 1 question of 5 marks

Per table block:
* 1 question of 5 marks (must include table in question body)
* 1 question of 8 marks (must include table in question body)

Per formula block:
* 1 question of 5 marks (numerical with full workings)
* 1 question of 8 marks (multi-step numerical)

Per legal block:
* 1 question of 4 marks (state and explain provision)
* 1 question of 8 marks (case scenario with section citations)

Question types by marks for Inter:

**4 marks:**
* Explain [concept] with reference to [Standard/Act/Rule]
* State the treatment of [item] as per [AS/Ind AS]
* Distinguish between [A] and [B]
* Calculate [value] from the following: [data or table]

**5 marks:**
* From the following information, prepare [statement]: [table]
* [Scenario]. Advise with reference to [Act/Standard].
* Explain [concept] covering all important aspects.

**8 marks:**
* Prepare [complete multi-part statement] from: [table]
* [Complex scenario]. State the legal/accounting treatment with reasons and relevant section/standard references.
* Calculate [multiple related values] from the following comprehensive data: [table]

Model answer rules for Inter:

* All AS/Ind AS references must include standard number and name
* All legal answers must cite section and act
* Accounting entries follow Schedule III format for companies
* Costing statements follow standard cost sheet format
* Tax calculations show step-by-step computation
* Audit answers reference relevant SA (Standard on Auditing)
* Marks allocation shown per step
* Indian number format throughout

---

## Final Templates

Final follows the same 30/70 MCQ/Descriptive split as Intermediate.

Differences from Intermediate:

* Higher marks questions: 8 and 10 mark questions replace most 4 and 5 mark questions
* MCQ scenarios are more complex — multi-layered situations
* Descriptive questions require integrated thinking across multiple concepts
* Legal answers must show awareness of recent amendments and judicial interpretations where relevant
* Costing and FM questions involve more variables and require more steps

Per content block for Final:

MCQ section:
* 2 scenario-based MCQs (more complex scenarios than Inter)

Descriptive section:

Per text block:
* 1 question of 5 marks
* 1 question of 8 marks

Per table block:
* 1 question of 8 marks (must include table)
* 1 question of 10 marks (must include table)

Per formula block:
* 1 question of 8 marks
* 1 question of 10 marks

Per legal block:
* 1 question of 5 marks
* 1 question of 10 marks (comprehensive case scenario)

---

## Table Generation Rules

When a question requires a table, the table is generated as part of the question body. This applies whenever:

* The content block is a table (always)
* The question asks "from the following data" (always)
* Numerical values are needed to make the question answerable
* A financial statement needs to be prepared or analysed
* An accounting entry needs to be verified or corrected

Table format rules:

**JOURNAL ENTRY TABLE:**
Date | Particulars | LF | Dr (₹) | Cr (₹)
Values filled with realistic Indian amounts
Narration included in brackets below each entry

**LEDGER / T-ACCOUNT:**
Dr side | Cr side
Date | Particulars | JF | Amount | Date | Particulars | JF | Amount
To/By prefixes on all entries

**TRIAL BALANCE:**
Particulars | LF | Dr (₹) | Cr (₹)
Must balance — Dr total equals Cr total

**TRADING AND P&L:**
Dr side: expenses and cost of goods sold
Cr side: sales and closing stock
Gross profit / Net profit clearly shown

**BALANCE SHEET:**
Vertical format preferred (Schedule III style for companies)
Horizontal format acceptable for Foundation sole trader questions

**COST SHEET (Inter/Final Costing):**
Standard cost sheet format
Prime cost, works cost, cost of production, cost of goods sold, cost of sales clearly separated

**STATISTICAL TABLE (Paper 3):**
Variable | Frequency | CF | Class boundaries as required
Values must allow calculation of mean, median, mode, SD

Table values must:

* Use Indian number format: 1,00,000 not 100,000
* Use ₹ symbol
* Be internally consistent (debits equal credits, balance sheet balances, totals are correct)
* Be realistic for Indian business context (not ₹1 or ₹999,999,999 — use believable amounts)
* Be mathematically verified before being included in the question — no table with wrong totals is ever shown

---

## Deduplication

Before storing any generated question:

* Compare question text against all existing questions for this user and this upload session
* If two questions test exactly the same concept in the same way — discard the duplicate
* If two questions test the same concept but at different difficulty or from different angles — keep both
* Maximum 2 questions on the exact same sub-topic per upload session

---

## Quality Checks Before Delivery

Every question passes these checks before being shown to the student:

**CHECK 1 — Format match**
Does the question type match the paper's allowed types?
Paper 1 or 2 — descriptive only, no MCQ
Paper 3 or 4 — MCQ only, no descriptive
If mismatch — discard

**CHECK 2 — Table accuracy**
If a table is included, do all totals verify correctly?
Do debits equal credits?
Does the balance sheet balance?
If not — regenerate the table before delivering

**CHECK 3 — Section reference accuracy**
If a legal section is cited, does it follow the correct format for that act?
If not — flag for review, do not discard

**CHECK 4 — Numerical accuracy**
If a model answer includes a calculation, run the calculation independently and verify the answer matches.
If not — regenerate

**CHECK 5 — Indian format**
Are all amounts in Indian number format with ₹ symbol?
If not — correct before delivering

**CHECK 6 — Marks appropriateness**
Is the question complexity appropriate for the marks assigned?
A 2-mark question should not require a full page answer.
An 8-mark question should not be answerable in two lines.
If not — adjust marks value or regenerate
