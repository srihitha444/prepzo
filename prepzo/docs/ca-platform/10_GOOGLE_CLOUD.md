# 10 — Google Cloud Setup and Gemini API

How to configure Google Cloud for the Prepzo CA platform. Covers Gemini API, Google Document AI, Cloud Storage, and cost management within the 90-day free credit window.

---

## What Google Cloud Powers on This Platform

Gemini Vision API reads every page of every uploaded document, extracts tables, formulas, diagrams, and legal content, and is used in both the two-pass and three-pass pipelines described in 02_DOCUMENT_INGESTION.md.

Google Document AI handles OCR for scanned PDFs only. It converts scanned images to raw text before the Vision pass. It is not used for typed PDFs or direct image uploads.

Gemini API (text generation) handles content type classification per block, paper mapping and keyword matching, question generation from extracted content, flashcard generation from extracted content, AI Teacher conversation responses, and descriptive answer evaluation.

Cloud Storage stores all uploaded student files and the generated CA Foundation video content.

---

## Project Setup

Project name: prepzo-ca
Region: asia-south1 (Mumbai — closest to Indian users)

```bash
gcloud services enable aiplatform.googleapis.com
gcloud services enable documentai.googleapis.com
gcloud services enable storage.googleapis.com

gcloud iam service-accounts create prepzo-backend \
  --display-name="Prepzo Backend Service Account"

gcloud projects add-iam-policy-binding prepzo-ca \
  --member="serviceAccount:prepzo-backend@prepzo-ca.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding prepzo-ca \
  --member="serviceAccount:prepzo-backend@prepzo-ca.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding prepzo-ca \
  --member="serviceAccount:prepzo-backend@prepzo-ca.iam.gserviceaccount.com" \
  --role="roles/documentai.apiUser"
```

---

## Environment Variables

Add to `.env.local` and to Vercel environment variables:

```
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
GOOGLE_CLOUD_PROJECT_ID=prepzo-ca-xxxxx
GOOGLE_CLOUD_PRIVATE_KEY=your_service_account_private_key
GOOGLE_CLOUD_CLIENT_EMAIL=prepzo-backend@prepzo-ca.iam.gserviceaccount.com
GCS_BUCKET_NAME=prepzo-ca-uploads
GCS_VIDEO_BUCKET=prepzo-ca-videos
DOCUMENT_AI_PROCESSOR_ID=your_document_ai_processor_id
```

Gemini API key comes from Google AI Studio at aistudio.google.com. This is simpler than Vertex AI for this use case and draws from the same $300 free credit pool.

---

## Model Selection Per Task

**DOCUMENT VISION (page extraction)**
Model: gemini-2.5-flash
Reason: supports image input, handles structured content well, fast enough for batch page processing

**CONTENT CLASSIFICATION (block typing and paper mapping)**
Model: gemini-2.5-flash
Reason: quick classification task

**QUESTION GENERATION**
Model: gemini-2.5-flash
Reason: quality matters — questions must be accurate and well-formed

**FLASHCARD GENERATION**
Model: gemini-2.5-flash
Reason: same quality requirement as questions

**ANSWER EVALUATION (descriptive)**
Model: gemini-2.5-flash
Reason: needs careful reasoning to assign marks fairly

**AI TEACHER (conversation)**
Model: gemini-3.1-flash-lite
Reason: speed matters more than depth for chat, significantly cheaper — keeps AI Teacher cost near zero

---

## Gemini Client Setup

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
export const classifierModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
export const questionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
export const flashcardModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
export const evaluatorModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
export const teacherModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' })
```

---

## Document Processing — Page Extraction Prompt

Every page of every upload goes through Gemini Vision with this prompt structure:

```typescript
const prompt = `
You are analysing page ${pageNumber} of a CA ${studentLevel} student's study notes.

Extract all content from this page and classify each block.

Return JSON:
{
  "blocks": [
    {
      "type": "text" | "table" | "formula" | "legal" | "diagram",
      "content": "extracted content",
      "confidence": 0.0 to 1.0,
      "section_references": [],
      "formula_text": "",
      "table_structure": {
        "headers": [],
        "rows": [],
        "table_type": "journal|ledger|balance_sheet|trial_balance|cost_sheet|statistical|other",
        "dr_total": 0,
        "cr_total": 0,
        "validates": true
      }
    }
  ]
}

Rules:
- Indian number format: 1,00,000 not 100,000
- For tables: preserve debit and credit relationships exactly
- For legal content: extract exact section numbers and act names
- For formulas: extract as both plain text and mathematical notation
- Ignore: page headers, footers, logos, watermarks, page numbers
- If a table cell is unreadable: mark it with [?]
`
```

---

## Google Document AI Setup (Scanned PDFs only)

```bash
# Go to: Google Cloud Console -> Document AI -> Create Processor
# Type: Document OCR
# Region: us
# Copy the Processor ID to DOCUMENT_AI_PROCESSOR_ID env variable
```

```typescript
import { DocumentProcessorServiceClient } from '@google-cloud/documentai'

const client = new DocumentProcessorServiceClient({
  credentials: {
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY,
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL
  }
})

export async function runOCR(fileBuffer: Buffer, mimeType: string): Promise<string> {
  const processorName = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/us/processors/${process.env.DOCUMENT_AI_PROCESSOR_ID}`

  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: {
      content: fileBuffer.toString('base64'),
      mimeType
    }
  })

  return result.document?.text || ''
}
```

---

## Cloud Storage Setup

```typescript
import { Storage } from '@google-cloud/storage'

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY,
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL
  }
})

export async function uploadFile(
  buffer: Buffer,
  userId: string,
  filename: string,
  mimeType: string
): Promise<string> {
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!)
  const filePath = `ca-notes/${userId}/${filename}`
  const file = bucket.file(filePath)
  await file.save(buffer, { contentType: mimeType })
  return `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${filePath}`
}
```

---

## Budget Alerts

Set this up before any other work begins.

Go to: Google Cloud Console -> Billing -> Budgets and Alerts -> Create Budget

**Budget 1 — Total project**
Name: prepzo-total
Amount: $300
Alerts: 25% ($75), 50% ($150), 75% ($225), 90% ($270)
Action: Email only. Do not auto-stop services.

**Budget 2 — Gemini API only**
Name: prepzo-gemini
Amount: $200
Alerts: 50% ($100), 75% ($150), 90% ($180)

**Budget 3 — Document AI only**
Name: prepzo-document-ai
Amount: $50
Alerts: 75% ($37.50), 90% ($45)

---

## Cost Estimates — 90-Day Window

Mixed-content uploads cost more than single-content uploads because every page goes through Gemini Vision regardless of content type. Estimates below reflect this.

Gemini Vision (document processing): 100 uploads x 15 pages average = 1,500 page calls
Input tokens: 1,500 x 3,000 = 4.5M x $0.0000015 = $6.75
Output tokens: 1,500 x 500 = 750K x $0.000006 = $4.50
Subtotal: $11.25

Content classification and paper mapping: 1,500 block classifications
Input: 750K tokens x $0.0000015 = $1.13
Output: 300K tokens x $0.000006 = $1.80
Subtotal: $2.93

Question generation: 500 generation calls (5 blocks per upload)
Input: 1M tokens x $0.0000015 = $1.50
Output: 750K tokens x $0.000006 = $4.50
Subtotal: $6.00

Flashcard generation: 500 generation calls
Input: 750K tokens x $0.0000015 = $1.13
Output: 500K tokens x $0.000006 = $3.00
Subtotal: $4.13

Answer evaluation: 200 evaluations
Input: 300K tokens x $0.0000015 = $0.45
Output: 160K tokens x $0.000006 = $0.96
Subtotal: $1.41

AI Teacher (gemini-3.1-flash-lite): 300 conversations x 10 messages
Input: 1.5M tokens x $0.00000025 = $0.38
Output: 900K tokens x $0.000001 = $0.90
Subtotal: $1.28

Google Document AI (scanned PDFs only, 30% of uploads): 30 uploads x 15 pages = 450 scanned pages
450 / 1,000 x $1.50 = $0.68

Cloud Storage: 45.2GB x $0.020/month x 3 months = $2.70

**Total estimated cost over 90 days: approximately $30.38**
**Remaining free credit: approximately $269.62**

---

## Cost Logging

Add this table to Supabase to track real usage per feature:

```sql
CREATE TABLE api_cost_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10, 8),
  user_id UUID REFERENCES profiles(id),
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cost_log_feature ON api_cost_log(feature);
CREATE INDEX idx_cost_log_date ON api_cost_log(logged_at);
```

```typescript
const MODEL_COSTS = {
  'gemini-2.5-flash': { input: 0.0000015, output: 0.000006 },
  'gemini-3.1-flash-lite': { input: 0.00000025, output: 0.000001 }
}

export async function logApiCall(params: {
  feature: 'vision' | 'classification' | 'question_gen' |
           'flashcard_gen' | 'evaluation' | 'ai_teacher'
  model: string
  tokensInput: number
  tokensOutput: number
  userId: string
}) {
  const costs = MODEL_COSTS[params.model]
  const cost = (params.tokensInput * costs.input) +
               (params.tokensOutput * costs.output)

  await supabase.from('api_cost_log').insert({
    feature: params.feature,
    model: params.model,
    tokens_input: params.tokensInput,
    tokens_output: params.tokensOutput,
    cost_usd: cost,
    user_id: params.userId,
    logged_at: new Date().toISOString()
  })
}
```
