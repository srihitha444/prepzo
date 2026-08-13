# 02 — Document Processing

How the platform accepts, processes, and extracts content from student-uploaded documents. CA content is complex — tables, formulas, law codes, and handwritten notes all require different handling.

---

## Supported Upload Formats

| Format | Handling Method |
| ----- | ----- |
| PDF (typed/digital) | Direct text extraction + Gemini Vision for embedded images |
| PDF (scanned/photo) | Google Document AI OCR + Gemini Vision for all visual content |
| Image (JPG/PNG/WEBP) | Gemini Vision API |
| Handwritten photo | Gemini Vision API |
| Plain text / paste | Direct to Gemini |

---

### Upload Validation

The following checks run before any processing begins. If any check fails the file is rejected immediately and no API calls are made.

**FILE SIZE**
Maximum file size: 20MB
If exceeded: "Your file is too large. Maximum size is 20MB. Please compress your file and try again."

**PAGE COUNT**
Maximum pages: 1,000
If exceeded: "Your file has more than 1,000 pages. Please split it into smaller files and upload each separately."
No partial processing — the entire file is rejected.

**FILE FORMAT**
Accepted: PDF, JPG, PNG, WEBP
If other format: "We only support PDF, JPG, PNG, and WEBP files."

**FILE READABILITY**
If PDF is corrupted or unreadable: "This file could not be opened. Please check the file and try again."
If PDF is password protected: "This PDF is password protected. Please remove the password before uploading."

**CONTENT CHECK**
After extraction: if no CA-related content detected
"We could not detect CA study material in this file. Please ensure you are uploading CA Foundation, Intermediate, or Final notes or study material."

---

## Critical Reality — PDFs Always Contain Mixed Content

Both typed and scanned PDFs in a CA context will almost always contain images, diagrams, and tables embedded alongside plain text. Text extraction alone is never sufficient. Every PDF must go through a two-pass pipeline regardless of whether it is typed or scanned.

---

## Format-Specific Handling — Full Detail

### PDF (Typed / Digital)

A typed PDF has a real text layer that can be extracted directly. However CA typed PDFs routinely embed:

**EMBEDDED VISUAL CONTENT IN TYPED PDFs:**

* Accounting tables (T-accounts, trial balance, balance sheet). These are often typeset as actual table elements — may extract as garbled text columns if parsed naively.
* Financial diagrams (fund flow charts, cash flow diagrams, organisational charts for company law).
* Formula images (where the author inserted a formula as an image rather than typing it — very common in ICAI study material).
* Scanned exhibits (case law judgements, ICAI notifications pasted as image into an otherwise typed document).
* Signature blocks and stamp images (ignore these).
* Page headers/footers with logos (ignore these).

**TWO-PASS PROCESSING FOR TYPED PDFs:**

PASS 1 — Text layer extraction (pdf-parse)

* Extract all raw text from the PDF text layer.
* Preserve paragraph structure.
* Flag positions where text extraction returns garbled output (sign that a table or image was there).

PASS 2 — Visual layer extraction (Gemini Vision)

* Convert each page to a high-resolution image (300 DPI).
* Send each page image to Gemini Vision API.
* Vision sees what a human sees: tables, formulas, diagrams.
* Vision output fills the gaps left by text extraction.

MERGE PASS — Reconcile both outputs

* Where text extraction gave clean prose — use text output.
* Where text extraction gave garbled output — use Gemini Vision output.
* Where both disagree — prefer Gemini Vision output (more reliable for structure).
* Build unified content_map per page.

**DIAGRAM HANDLING IN TYPED PDFs:**

* Detected by: Gemini Vision sees image block with no corresponding text.
* Types of diagrams in CA notes:
  * Fund flow diagram — extract as description + generate comprehension questions.
  * Cash flow chart — extract flow structure + generate sequence questions.
  * Depreciation graph — extract axes and values + generate interpretation questions.
  * Company structure org chart — extract hierarchy + generate relationship questions.
  * Demand/supply curve (Economics Paper 4) — extract axis labels + generate analysis questions.
* Store as: `{type: "diagram", description: "...", extracted_data: {...}}`
* Questions generated from diagrams:
  * "Based on the fund flow diagram, which of the following is a source of funds?"
  * "In the given cash flow chart, what is the net cash from operating activities?"
  * "The depreciation graph shows [description]. Calculate the WDV at end of Year 3."

---

### PDF (Scanned / Photo)

A scanned PDF has no text layer — it is purely an image of a physical page. This is the most complex format and the most common from coaching institute materials.

**WHAT SCANNED CA PDFs CONTAIN:**

* Handwritten notes scanned to PDF (very common).
* Printed textbook pages photographed and compiled to PDF.
* Whiteboard photos from coaching classes.
* Photocopied ICAI material.
* Mixed: some typed pages and some handwritten pages in same PDF.

**THREE-PASS PROCESSING FOR SCANNED PDFs:**

PASS 1 — Google Document AI OCR

* Converts scanned image to extracted text.
* Handles printed text well.
* Handles clear handwriting moderately well.
* Fails on: tables, formulas, diagrams, poor quality scans.
* Output: raw text with position coordinates.

PASS 2 — Gemini Vision (full page)

* Send the original scan image to Gemini Vision API.
* Vision reads everything a human can read.
* Handles tables by understanding structure visually.
* Handles formulas by reading mathematical notation.
* Handles diagrams by describing what it sees.
* Handles mixed printed and handwritten content.
* Output: structured content blocks with type classification.

PASS 3 — Quality Assessment

* Score each page: 0-100 extraction confidence.
* Below 60: flag page as "low quality — student should re-upload".
* Below 40: skip page, notify student which page failed.
* Above 60: proceed with best available extraction.

**SCANNED TABLE HANDLING:**

Tables in scanned PDFs are the hardest case. A physical accounting ledger photographed shows:

* Ruled lines that may be faint or broken.
* Handwritten amounts that vary in size.
* Corrections and cross-outs.
* Multiple colours of ink.
* Page fold shadows obscuring some cells.

Gemini Vision approach:

* Describe the table structure to Vision explicitly in prompt: "This page likely contains an accounting table. Identify all columns and rows. Extract every number you can read. Note any cells you cannot read clearly."
* Vision returns best-effort extraction and confidence per cell.
* Cells below 80% confidence — flagged with `[?]` marker.
* Student shown: "We could not read 2 cells in your table clearly. Please verify: [Cell positions]".

**SCANNED DIAGRAM HANDLING:**

* Gemini Vision describes the diagram in detail.
* If diagram is a labelled chart (fund flow diagram, organisational chart): Vision extracts all labels.
* If diagram is unlabelled: Vision describes what it shows.
* Questions are generated from diagram description, not from image directly.

---

### Image Files (JPG / PNG / WEBP)

Direct uploads of photographs — typically a student's phone photo of their notes.

**COMMON SCENARIOS:**

* Photo of a single page of handwritten notes.
* Photo of a textbook page (open book).
* Photo of a whiteboard from coaching class.
* Screenshot of a digital PDF (lower quality than uploading PDF directly).
* Photo of a printed question paper.

**SINGLE-PASS PROCESSING (Gemini Vision only):**

* No OCR pass needed — Gemini Vision handles everything.
* Send image directly to Gemini Vision API.
* Vision extracts: text, tables, formulas, diagrams, legal references.
* Return structured content_map.

**IMAGE QUALITY REQUIREMENTS:**

Minimum acceptable:

* 720p resolution (1280x720 pixels).
* Clear enough to read without zooming on phone.
* No extreme glare, shadow, or blur.
* Page should be flat (not curved book spine).

Optimal:

* 1080p or higher.
* Even lighting across whole page.
* Camera directly above page (not at angle).
* All four corners of the page visible.

**PRE-PROCESSING BEFORE GEMINI VISION:**

* Auto-correct perspective (straighten angled photos).
* Auto-enhance contrast for faded ink.
* Crop to page boundaries (remove desk/table background).
* Rotate to correct orientation if needed.
* These steps run client-side before upload to save API costs.
* Use: browser Canvas API or sharp (Node.js).

**DIAGRAM IN PHOTOS:**

* Student often photographs a textbook showing a diagram.
* Gemini Vision reads the diagram as-is.
* Prompt specifies: "Extract all labels, values, and relationships shown in any diagrams or charts on this page."
* Diagram type identification: Vision classifies as flow_chart, graph, table, organisational, anatomical, or other.
* Questions generated based on diagram type.

---

### Handwritten Notes (Photo)

The most challenging format. Moderately successful with clear handwriting.

**SPECIFIC CHALLENGES FOR CA HANDWRITTEN NOTES:**

* Mixed English and Hindi annotations.
* Underlines and boxes drawn around key points.
* Arrows connecting concepts.
* Margin notes alongside main content.
* Corrected amounts (crossed out and rewritten).
* Shorthand: "A/c", "Dr", "Cr", "P&L", "B/S", "w.r.t.", "i.e.", "eg."
* Abbreviations unique to the student's own shorthand.

**PROCESSING APPROACH:**

Gemini Vision with a CA-specific prompt: "This is a CA student's handwritten accounting/law/maths notes. Extract all readable content. CA-specific abbreviations: A/c=Account, Dr=Debit, Cr=Credit, P&L=Profit and Loss, B/S=Balance Sheet, GST=Goods and Services Tax, ICA=Indian Contract Act, AS=Accounting Standard. Ignore crossed-out content. Note margin annotations separately."

Return: main_content + margin_notes + crossed_out_count. Confidence score per section.

**HANDWRITTEN TABLE HANDLING:**

* Most challenging scenario in the entire pipeline.
* A hand-drawn T-account with varying row heights and column widths.
* Gemini Vision approach: describe structure first, then extract values.
* Prompt: "There appears to be an accounting T-account on this page. Identify the left side (Debit) entries and right side (Credit) entries. Extract each entry: Description and Amount."
* Validate: Dr total vs Cr total — flag if they do not match.
* If match fails: tell student "Your handwritten account does not balance. Please check your notes."

**HANDWRITTEN FORMULA HANDLING:**

* Mathematical formulas in handwriting vary widely.
* Gemini Vision reads the formula as best it can.
* Store as plain text description alongside best-effort LaTeX.
* Flag low-confidence formula extractions for student review.
* Never generate numerical questions from low-confidence formula extraction.

**QUALITY IMPROVEMENT TIPS shown to student:** "For best results when photographing handwritten notes: use bright, even lighting and avoid shadows. Hold camera directly above the page. Write clearly and avoid cursive for numbers. Use a ruler for table lines when possible. Photograph one page at a time."

---

### Plain Text / Paste

Student types or pastes text directly into the app.

**USE CASES:**

* Student copies text from a digital PDF.
* Student types out key points they want questions on.
* Student pastes notes from Google Docs or Notion.
* Student pastes a question they are stuck on.

**PROCESSING:**

* No OCR, no Vision needed — direct text input.
* Send directly to Gemini API for classification and question generation.
* Highest accuracy of all formats (no extraction errors).
* Still runs: content_type classification, paper detection, validation.

**LIMITATIONS:**

* Tables lose formatting when pasted as plain text. Ask student to describe the table structure if detected as garbled.
* Formulas may paste as broken text (e.g. "SI=PRT100" without slash). Flag and ask student to confirm the formula before generating questions.
* Images and diagrams cannot be pasted as text. Show prompt: "Your text mentions a diagram. Upload an image of it for full question generation."

---

## The Four Content Types in CA Notes

CA student notes contain four distinct content types, each requiring different extraction and question-generation strategies.

### Content Type 1 — Plain Text (Theory)

Examples: definitions, explanations, principles, descriptions.

Detection: standard text paragraphs. Extraction: direct text extraction. Question types generated:

* Foundation P1/P2: descriptive questions (define, explain, state).
* Foundation P3/P4: MCQs testing conceptual understanding.
* Inter/Final: both types.

Flashcard format: front = concept name, back = definition.

---

### Content Type 2 — Accounting Tables and Financial Statements

Examples: T-accounts, journal entries, trial balance, trading account, balance sheet, depreciation schedule, cost sheet, ratio tables.

This is the hardest content type to extract correctly. Numbers, debit/credit relationships, and table structure all carry meaning that plain text extraction destroys.

Detection signals:

* Column headers: Dr, Cr, Debit, Credit, Amount, Rs, ₹.
* Row labels: To [something], By [something].
* Double-line totals.
* Balance Sheet headers: Liabilities, Assets.
* Words: ledger, account, journal, entry.

Extraction strategy:

* Use Gemini Vision for all table content.
* Send image of table directly to Gemini Vision API.
* Gemini reads table structure visually.
* Validate: debits must equal credits in journal entries.
* Validate: balance sheet must balance (Assets = Liabilities + Capital).
* If validation fails — flag for student review.

Question types generated from tables:

* "What is the closing balance of the Cash Account?"
* "Record the journal entry for [described transaction]."
* "Prepare the Trading Account from the following data."
* "Calculate the Current Ratio from the balance sheet."
* "What is the net profit as per the Profit and Loss Account?"
* "Identify the error in the following journal entry."

Never generate MCQs asking students to identify which T-account format is correct — always ask about the values and relationships.

---

### Content Type 3 — Mathematical Formulas

Examples: depreciation formulas, interest calculations, statistical formulas, financial management formulas, ratio formulas.

Detection signals:

* Fraction structures (numerator/denominator).
* Mathematical operators: ×, ÷, −, Σ, ^.
* Common formula keywords: formula, calculate, equals, rate, percentage.
* Specific patterns: SI = PRT/100, NPV = Σ(CF/(1+r)^t).

Extraction strategy:

* Use Gemini Vision for formula images.
* Store formula as both: LaTeX string and plain text description.
* Example: "SI = PRT/100" stored as both the formula and "Simple Interest = (Principal × Rate × Time) divided by 100".
* Validate formula structure makes mathematical sense.

Question types generated from formulas:

* Numerical: "Calculate SI if P=10000, R=8%, T=2 years."
* Conceptual: "What does 'R' represent in the SI formula?"
* Application: "If SI = 1600 and PRT = 20000, what is the rate?"
* Reverse: "Derive the formula for finding Principal given SI, R, T."

Indian number format handling:

* Always store and display in Indian format: 1,00,000 not 100,000.
* Recognise both formats on input.
* Validate that generated numerical answers use Indian format.

---

### Content Type 4 — Laws, Sections, and Legal Codes

Examples: Indian Contract Act sections, Companies Act provisions, GST rules, Income Tax sections, SEBI regulations, ICAI standards (AS, SA, Ind AS).

This content type is critical for CA and requires precise extraction — getting a section number wrong invalidates the entire answer in an exam.

Detection signals:

* Section numbers: S.32, Sec 143, Section 2(47).
* Sub-sections: S.32(1)(ii)(a).
* Standard references: AS-10, SA-700, Ind AS-115, Rule 46A.
* Act names: Companies Act 2013, ICA 1872, Sale of Goods Act 1930.
* GST: CGST, SGST, IGST, Rule [number].
* Income Tax: AY, PY, u/s, Schedule [number].

Extraction strategy:

* Identify and tag every section reference found.
* Store: Act name + Section number + Sub-section + Summary of provision.
* Cross-reference: if the same section appears multiple times, merge.
* Flag: any section reference that does not follow standard format.

Flashcard generation from legal content:

Front: "State Section 11 of the Indian Contract Act, 1872"
Back: "Section 11 specifies who is competent to contract: every person who (1) is of the age of majority, (2) is of sound mind, and (3) is not disqualified by law from contracting."

Front: "What is AS-10?"
Back: "AS-10: Property, Plant and Equipment. Prescribes accounting treatment for property, plant and equipment so that users can understand investment in PPE and changes therein."

MCQ generation from legal content (Inter/Final):

* Scenario-based: describe a situation, ask which section applies.
* "X entered into a contract with Y under coercion. Under which section can Y void the contract?" (S.19, ICA 1872).
* Never ask student to memorise exact wording — ask for application.

Descriptive question generation from legal content:

* "State the provisions of Section [X] of [Act]." (2-4 marks)
* "With reference to [Act], explain [concept] with an example." (4-8 marks)
* "[Case scenario]. Advise [party] with reference to relevant sections of [Act]." (8-10 marks)

---

## Complete Upload Processing Pipeline

**STEP 1 — RECEIVE UPLOAD:** Student uploads file (PDF/image/text). Store in Supabase Storage under user_id/upload_id/. Record in user_notes table: user_id, file_url, file_type, paper, timestamp.

**STEP 2 — CONTENT EXTRACTION** If image/scanned PDF — Google Document AI OCR first. If typed PDF — extract text directly (pdf-parse). Send ALL pages to Gemini Vision API regardless. Gemini Vision catches tables and formulas that text extraction misses.

**STEP 3 — CONTENT CLASSIFICATION:** Identify blocks of content by type. Mark each paragraph/block as: text, table, formula, or legal. Build a content map of the document.

**STEP 4 — PAPER DETECTION** Student selects paper at upload or system auto-detects from keyword signals. If confidence is below 80%: show detection result and ask student to confirm. Set paper_type flag — this affects all downstream question generation.

**STEP 5 — VALIDATION** For tables: validate debit equals credit (accounting). For balance sheets: validate Assets equals Liabilities plus Capital. For formulas: validate mathematical structure. For section references: validate format against known pattern library. Flag any validation failures and show student before generating questions.

**STEP 6 — QUESTION GENERATION TRIGGER** Pass content map and paper_type to question generation engine. See 03_QUESTION_GENERATION.md.

**STEP 7 — STORE RESULTS:** Generated questions saved to generated_questions table, linked to upload_id and user_id. Flashcards saved to user_flashcards table. Show student: X questions generated, Y flashcards created.

---

## Error Handling

Poor image quality — "This image is too blurry to process accurately. Please upload a clearer photo."

Password-protected PDF — "This PDF is password protected. Please remove the password before uploading."

Unrecognised content — "We could not detect CA-related content in this file. Please ensure you are uploading CA study material."

Table validation fail — "We detected an accounting table where debits do not equal credits. Please check your notes before we generate questions from this section."

Wrong format — "We only support PDF, JPG, PNG, and WEBP files."

File too large — "Maximum file size is 20MB. Please compress your file."
