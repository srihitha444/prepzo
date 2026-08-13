# 03 — Content Mapping

How the platform identifies, separates, and maps content blocks from a student upload to the correct CA paper and level. A single upload can contain content from multiple papers and must be handled accordingly.

---

## Why Content Mapping Exists

A student does not always upload one clean file per paper. A single upload might contain:

* Accounting journal entries (Paper 1) on page 1
* A note on Section 11 of the Indian Contract Act (Paper 2) on page 2
* A statistics formula sheet (Paper 3) on page 3
* A GST provision note (Intermediate Tax) on page 4

The system cannot treat this as a single block and apply one template. It must break the upload into individual content blocks, identify what each block is, map it to the correct paper, and then apply that paper's template to generate questions.

Content mapping happens after extraction and before question generation. It is the bridge between what was uploaded and what gets generated.

---

## Step 1 — Block Segmentation

After the full document is extracted (see 02_DOCUMENT_INGESTION.md), the content is split into blocks.

A block is a logically coherent unit of content. It is not necessarily one paragraph or one page. It is defined by topic coherence — content that belongs together stays together as one block.

Block boundaries are detected when:

* The topic changes (Accounting entries followed by a law section)
* The content type changes (plain text followed by a table)
* A heading or subheading appears
* A page break occurs alongside a topic shift
* The writing style shifts (e.g. numbered legal provisions after narrative prose)

Each block is assigned:

```
block_id: unique identifier
page_start: first page the block appears on
page_end: last page the block appears on
content_type: text | table | formula | legal | diagram
raw_content: extracted text or structured data
confidence: 0-100 extraction confidence score
```

---

## Step 2 — Content Type Classification

Each block is classified into one of five content types. This classification runs automatically using Gemini.

**TEXT**
Plain prose, definitions, explanations, principles.
Signal: standard paragraphs, no special structure.
Example: "Going concern means the business is assumed to continue operations indefinitely."

**TABLE**
Structured rows and columns with financial data.
Signal: Dr/Cr headers, To/By row labels, ruled lines, numerical columns, balance sheet structure.
Example: A T-account, journal entry set, trial balance.

**FORMULA**
Mathematical expressions with operators and variables.
Signal: fraction structures, mathematical operators, equals signs with variables, SI/NPV/IRR patterns.
Example: SI = PRT/100, NPV = Σ(CF/(1+r)^t)

**LEGAL**
Sections, provisions, acts, standards, rules.
Signal: Section numbers (S.32, Sec 143), Act names, AS/SA/Ind AS references, GST/Income Tax provisions.
Example: "Section 11 of the Indian Contract Act, 1872 states that every person is competent to contract..."

**DIAGRAM**
Visual content — charts, graphs, flow diagrams.
Signal: Gemini Vision identifies image with no text layer, or describes a visual structure with labels and arrows.
Example: Fund flow diagram, depreciation graph, demand/supply curve, organisational chart.

If a block contains more than one content type — for example a paragraph of theory followed immediately by a formula — it is split further into sub-blocks at the point of transition.

---

## Step 3 — Paper Mapping

Each block is mapped to a CA paper. The student's account level (Foundation, Intermediate, or Final) set at signup narrows the mapping to only the papers within that level.

### Mapping uses keyword signals

Each paper has a defined keyword library. Gemini scores each block against all papers within the student's level and assigns the highest-confidence match.

**FOUNDATION PAPER 1 — Accounting**
Keywords: journal, ledger, trial balance, trading account, profit and loss, balance sheet, depreciation, goodwill, partnership, dissolution, share capital, debenture, T-account, Dr, Cr, debit, credit, double entry, incomplete records, bank reconciliation, bills of exchange, provision, reserve, subsidiary books, cash book

**FOUNDATION PAPER 2 — Business Laws**
Keywords: contract, offer, acceptance, consideration, capacity, free consent, coercion, fraud, misrepresentation, void, voidable, discharge, breach, damages, indemnity, guarantee, bailment, pledge, agency, sale of goods, condition, warranty, caveat emptor, negotiable instrument, promissory note, bill of exchange, cheque, crossing, endorsement, partnership act, dissolution, companies act, memorandum, articles, prospectus, director, meeting, resolution, Section [number], ICA, NI Act, SGA

**FOUNDATION PAPER 3 — Quantitative Aptitude**
Keywords: ratio, proportion, logarithm, indices, linear equation, quadratic equation, inequality, simple interest, compound interest, annuity, present value, future value, permutation, combination, factorial, arithmetic progression, geometric progression, sets, functions, limits, differentiation, integration, statistics, mean, median, mode, standard deviation, probability, regression, correlation, index numbers, Σ, √, nCr, nPr, AP, GP

**FOUNDATION PAPER 4 — Business Economics**
Keywords: demand, supply, elasticity, equilibrium, price, quantity, consumer surplus, production function, marginal product, average product, fixed cost, variable cost, average cost, marginal cost, perfect competition, monopoly, oligopoly, GDP, GNP, national income, money supply, RBI, monetary policy, CRR, SLR, repo rate, inflation, deflation, fiscal deficit, GST basics, WTO, balance of payments

**INTERMEDIATE PAPER 1 — Advanced Accounting**
Keywords: accounting standards, AS, Ind AS, company accounts, Schedule III, amalgamation, absorption, internal reconstruction, investment accounts, insurance claims, hire purchase, branch accounts, departmental accounts, ESOP, buyback

**INTERMEDIATE PAPER 2 — Corporate and Other Laws**
Keywords: Companies Act 2013, SEBI, FEMA, insolvency, IBBI, competition act, section [number] companies act, board of directors, audit committee, NCLT, winding up, charge, debenture trustee, foreign exchange

**INTERMEDIATE PAPER 3 — Taxation**
Keywords: income tax, assessment year, previous year, head of income, salary, house property, capital gains, business income, TDS, advance tax, GST, CGST, SGST, IGST, input tax credit, composition scheme, place of supply, return filing, u/s, Schedule [number] IT Act

**INTERMEDIATE PAPER 4 — Cost and Management Accounting**
Keywords: cost sheet, marginal costing, absorption costing, standard costing, variance, budget, flexible budget, process costing, job costing, activity based costing, break even, contribution, P/V ratio, margin of safety

**INTERMEDIATE PAPER 5 — Auditing and Ethics**
Keywords: audit, auditor, SA, standard on auditing, audit report, materiality, risk, internal control, audit evidence, sampling, fraud, error, qualified opinion, emphasis of matter, CARO, audit trail, ethics, ICAI code

**INTERMEDIATE PAPER 6 — Financial Management and SM**
Keywords: capital budgeting, NPV, IRR, payback period, WACC, capital structure, working capital, cash management, receivables, inventory, dividend policy, lease, hire, strategic management, SWOT, Porter, BCG, competitive advantage

FINAL papers follow similar keyword libraries at higher depth.

### Mapping confidence rules

Above 85%: map to that paper automatically, no confirmation needed
70-85%: map to that paper, show student: "We detected this as [Paper Name]. Is this correct?" with option to change
Below 70%: show student all possible paper matches and ask them to select the correct one before generating questions
Below 40%: flag block as unidentifiable — do not generate questions. Tell student: "We could not identify which paper this content belongs to. Please confirm the paper."

### When a block matches multiple papers

Some content genuinely overlaps papers. Example: a note about depreciation could belong to Foundation Paper 1 (Accounting) or Intermediate Paper 1 (Advanced Accounting).

Resolution:

Use student's account level first.
If student is Foundation — map to Foundation Paper 1.
If student is Intermediate — map to Intermediate Paper 1.
If student's level matches both — use the more specific signal.
More specific signal = more unique keywords from one paper vs the other.
If still tied — ask student to confirm.

---

## Step 4 — Mixed Upload Result

After all blocks are mapped, the upload is summarised as a content map.

**EXAMPLE CONTENT MAP — single uploaded file**

Upload: "My Revision Notes.pdf" — 24 pages

Block 1 — Pages 1-6
Content type: text + table
Paper: Foundation Paper 1 — Accounting
Topic detected: Depreciation
Confidence: 94%
Blocks: 3 text blocks, 2 table blocks

Block 2 — Pages 7-9
Content type: legal
Paper: Foundation Paper 2 — Business Laws
Topic detected: Indian Contract Act — Free Consent
Confidence: 91%
Blocks: 4 legal blocks

Block 3 — Pages 10-12
Content type: formula + text
Paper: Foundation Paper 3 — Quantitative Aptitude
Topic detected: Simple Interest and Compound Interest
Confidence: 88%
Blocks: 2 formula blocks, 1 text block

Block 4 — Pages 13-14
Content type: text
Paper: unidentified — confidence 45%
Action: ask student to confirm paper before generating

Block 5 — Pages 15-24
Content type: text + legal
Paper: Intermediate Paper 3 — Taxation
Topic detected: GST provisions
Confidence: 79%
Action: show student confirmation prompt before generating
Note: student's account level is Foundation — flag mismatch

---

## Step 5 — Level Mismatch Handling

If a block maps to a paper from a different CA level than the student's account level:

Example: Foundation student uploads Inter Tax content

Show student:
"We detected content from CA Intermediate Taxation on pages 15-24 of your file. Your account is set to CA Foundation. Do you want to:

[Generate questions at Foundation level anyway]
[Skip this section]
[Update my account to Intermediate]"

Do not generate questions silently for a different level. Always ask the student before proceeding.

---

## Step 6 — Output to Question Generation

Once all blocks are mapped and confirmed, the content map is passed to the question generation engine (see 04_QUESTION_TEMPLATES.md and 05_QUESTION_GENERATION.md).

Each block is passed with:

```json
{
  "block_id": "string",
  "ca_level": "Foundation | Intermediate | Final",
  "paper": "Paper 1 | Paper 2 | etc",
  "paper_name": "string",
  "content_type": "text | table | formula | legal | diagram",
  "topic": "string",
  "raw_content": "string or structured object",
  "confidence": "number",
  "student_confirmed": "boolean"
}
```

The question generation engine reads the paper from this object and applies that paper's fixed template. It never decides the template itself — the template is determined entirely by the paper field from this mapping.

---

## What Is Never Mapped

The following content is identified and discarded before mapping. No questions are generated from these:

Page headers and footers
Publisher logos and watermarks
Table of contents pages
Index pages
Bibliography and reference lists
Copyright notices
Blank pages
Signature blocks
Stamp images
Roll number or student name fields on cover pages
"This page is intentionally left blank" notices
