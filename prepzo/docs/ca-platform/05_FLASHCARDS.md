# 05 — Flashcards

How flashcards are structured, templated, and generated for each CA level and paper. Like questions, the template is fixed per paper — Gemini fills the content, it does not decide the structure.

---

## Core Principle

Flashcards serve a different purpose than questions. Questions test whether the student knows something under exam conditions. Flashcards build the memory so the student knows it in the first place.

Every piece of content that gets turned into a question should also produce at least one flashcard. The two work together — the flashcard teaches, the question tests.

---

## Flashcard Structure

Every flashcard has two sides:

**FRONT**
A prompt — a question, a term, a section reference, or a formula name. Maximum 15 words.
Never includes the answer.

**BACK**
The answer — a definition, explanation, worked example, or provision. Maximum 150 words.
Always includes an example or context where relevant.
Always uses Indian format for numbers: 1,00,000 not 100,000.

---

## Flashcard Types

There are six flashcard types. Which type is generated depends on the content type of the block.

**TYPE 1 — DEFINITION**
Used for: text blocks containing concepts, principles, terms
Front: "What is [concept]?"
Back: Definition in plain language + one example

**TYPE 2 — SECTION**
Used for: legal blocks containing section references
Front: "Section [X] — [Act name and year]"
Back: What the section says + key conditions + example of application

**TYPE 3 — FORMULA**
Used for: formula blocks
Front: "Formula: [Formula name]"
Back: The formula + what each variable means + reverse formulas + one worked example

**TYPE 4 — ACCOUNTING RULE**
Used for: text or table blocks in accounting papers
Front: A rule or principle stated as a question
Back: The rule explained + journal entry example where relevant

**TYPE 5 — STANDARD**
Used for: AS, Ind AS, SA references in Inter and Final content
Front: "[Standard number]: [Standard name]"
Back: Scope + key requirements + what it does not apply to

**TYPE 6 — COMPARISON**
Used for: content blocks that distinguish between two concepts
Front: "Distinguish: [A] vs [B]"
Back: Side-by-side comparison of key differences in table format

---

## Foundation Templates

### Paper 1 — Accounting

Per text block:
* 1 Definition flashcard per key term identified
* 1 Accounting Rule flashcard per rule or principle

Per table block:
* 1 Accounting Rule flashcard explaining the format shown
* 1 Definition flashcard for the statement type (e.g. "What is a Trial Balance?")
Note: the table itself is not reproduced on the flashcard. The flashcard explains the concept, not the data.

Per formula block:
* 1 Formula flashcard per formula identified
  Must include: formula, variables, reverse formula, one worked example with Indian amounts

Per legal block (if appearing in accounting context):
* 1 Section flashcard per section reference found

Accounting-specific back side rules:

* Journal entry examples use proper Dr/Cr format
* Always include: "Remember:" followed by one memory tip
* For depreciation: always show both SLM and WDV comparison
* For partnership: always state the default rule when partnership deed is silent
* For company accounts: always note the Companies Act requirement where relevant

---

### Paper 2 — Business Laws

Per text block:
* 1 Definition flashcard per legal term
* 1 Comparison flashcard where content distinguishes two concepts

Per legal block:
* 1 Section flashcard per section reference
* 1 Definition flashcard for the overall concept the section covers

Maximum flashcards per legal block: 5
If more than 5 sections appear in one block, prioritise the most frequently examined ones.

Section flashcard back side rules for Paper 2:

Structure of back side:
Line 1: What the section says (plain language)
Line 2: Key condition or requirement
Line 3: Exception if any
Line 4: Example — one sentence real-world application
Line 5: "Exam tip:" — what ICAI commonly asks about this section

Example:
Front: "Section 11 — Indian Contract Act, 1872"
Back:
Who can contract: every person who is (1) of the age of majority, (2) of sound mind, and (3) not disqualified by law.

Minor's contract: void ab initio — no legal effect from start.
Lunatic's contract: voidable — valid when of sound mind.

Example: A 16-year-old signs a contract to buy a bike. The contract is void — minor cannot be held liable.

Exam tip: ICAI often asks about the effect of a minor's agreement and whether it can be ratified on attaining majority. (It cannot.)

---

### Paper 3 — Quantitative Aptitude

Per text block:
* 1 Definition flashcard per concept

Per formula block:
* 1 Formula flashcard per formula
  This is the most important flashcard type for this paper.

Per table block (statistical data):
* 1 Definition flashcard for the measure being illustrated (e.g. "What is Standard Deviation?")
* 1 Formula flashcard for the formula used to compute it

Formula flashcard back side rules for Paper 3:

Structure of back side:
Line 1: The formula written clearly
Line 2: Each variable defined
Line 3: Reverse formulas (how to find each variable)
Line 4: Worked example — give values, show steps, give answer
Line 5: "Common mistake:" — what students typically get wrong

Example:
Front: "Formula: Simple Interest"
Back:
SI = (P × R × T) ÷ 100

P = Principal (original amount in ₹)
R = Rate of interest per annum (%)
T = Time period (in years)

Find P: P = (SI × 100) ÷ (R × T)
Find R: R = (SI × 100) ÷ (P × T)
Find T: T = (SI × 100) ÷ (P × R)

Example: P = ₹10,000, R = 8%, T = 3 years
SI = (10,000 × 8 × 3) ÷ 100 = ₹2,400

Common mistake: Using T in months instead of years. Always convert months to years before applying the formula.

---

### Paper 4 — Business Economics

Per text block:
* 1 Definition flashcard per concept
* 1 Comparison flashcard where two concepts are contrasted (e.g. elastic vs inelastic demand)

Per diagram block:
* 1 Definition flashcard describing what the diagram shows
* Note: the diagram is not reproduced on the flashcard. The flashcard describes it in words.

Economics flashcard back side rules:

* Use Indian examples: RBI, Indian GDP, rupee amounts
* For elasticity: always include the formula and interpretation of values greater than 1, equal to 1, and less than 1
* For market structures: always include a real Indian industry example (e.g. telecom for oligopoly, vegetables market for perfect competition)
* Keep economic theory connected to real-world context

---

## Intermediate Templates

Intermediate adds one flashcard type not used in Foundation: the Standard flashcard for AS, Ind AS, and SA references.

Per text block:
* 1 Definition flashcard per key concept
* 1 Comparison flashcard where relevant

Per table block:
* 1 Accounting Rule flashcard
* 1 Definition flashcard for the statement type

Per formula block:
* 1 Formula flashcard per formula

Per legal block:
* 1 Section flashcard per section reference
* 1 Definition flashcard for the overall concept

Per standard reference (AS / Ind AS / SA):
* 1 Standard flashcard per standard identified

Standard flashcard back side rules:

Structure of back side:
Line 1: Full name of the standard
Line 2: Scope — what it applies to
Line 3: Key requirement — what it says must be done
Line 4: Does not apply to — important exclusions
Line 5: Key disclosure requirement
Line 6: "Remember:" — one memory tip

Example:
Front: "AS-10: Property, Plant and Equipment"
Back:
Full name: Accounting Standard 10 — Property, Plant and Equipment

Scope: Accounting for PPE so users understand investment in fixed assets and changes therein.

Key requirement: Recognise PPE only if (1) future economic benefits probable and (2) cost reliably measurable. Initially record at cost. Subsequently: cost model OR revaluation model.

Does not apply to: biological assets related to agricultural activity, mineral rights, wasting assets.

Key disclosure: gross carrying amount, accumulated depreciation, net carrying amount, depreciation method used.

Remember: AS-10 replaced AS-6 (Depreciation Accounting) and AS-10 (old). The new AS-10 combined both.

---

## Final Templates

Final follows the same template structure as Intermediate with one addition:

* Higher complexity on the back side
* Back side must reference recent amendments or judicial interpretations where relevant
* Standard flashcards include effective date and transition provisions where material
* Legal section flashcards for Final must note if there are related rules or regulations that extend or modify the section

---

## Recall System

Flashcards follow the same spaced repetition logic as NEET flashcards with one CA-specific adjustment:

Student marks flashcard as Got It:
* Moves to Recall deck
* Resurfaces based on student's recall setting (daily / 2 days / weekly)

Student marks flashcard as Need Review:
* Moves to Review deck
* Resurfaces next session

CA-specific rule — Section flashcards:
* Always default to daily recall regardless of setting
* Legal section numbers need daily reinforcement
* Student can override this in settings

CA-specific rule — Formula flashcards:
* Default to 2-day recall
* Formulas are reinforced through practice questions as much as through flashcard recall

---

## What Flashcards Are Never Generated From

* Page headers, footers, logos
* Table of contents
* "This chapter covers..." introductory lines
* Bibliography or reference lists
* Content the student crossed out in handwritten notes
* Duplicate content already captured in another block
* Diagram content — diagrams produce Definition flashcards about the concept they illustrate, not reproductions of the diagram itself
* Low-confidence extracted content (below 60% confidence) — do not generate flashcards from content that may be wrong

---

## Quality Checks Before Delivery

**CHECK 1 — Front length**
Front side must not exceed 15 words.
If exceeded: shorten to the core term or question.

**CHECK 2 — Back length**
Back side must not exceed 150 words.
If exceeded: cut to the most important information.

**CHECK 3 — Section accuracy (Section flashcards)**
Section number and act name must follow correct format.
Cross-check against known section reference library.
If format incorrect: flag for review.

**CHECK 4 — Formula accuracy (Formula flashcards)**
Run any numerical example in the back side.
Verify the answer is mathematically correct.
If incorrect: regenerate.

**CHECK 5 — Indian format**
All amounts in Indian number format with ₹ symbol.
If not: correct before delivering.

**CHECK 6 — No answer on the front**
Front side must not contain or imply the answer.
If it does: restructure the front side.
