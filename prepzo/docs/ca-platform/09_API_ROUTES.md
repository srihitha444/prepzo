# 09 — API Routes

All backend API routes for the Prepzo CA platform. Built as Next.js API routes. All routes require authentication unless marked public.

---

## Authentication

Every route checks for a valid Supabase session before processing. If no valid session exists the route returns 401 immediately.

401 — No valid session, redirect to login
403 — Authenticated but not authorised for this resource
500 — Server error

---

## Document Upload and Processing

### POST /api/ca/notes/upload

Accepts a student's uploaded file and queues it for processing.

Request:

```
Content-Type: multipart/form-data
Body:
  file: File (PDF, JPG, PNG, WEBP)
  title: string
  ca_level: string (optional — if not provided, read from profile)
```

Process:

1. Validate file type (PDF, JPG, PNG, WEBP only)
2. Validate file size (20MB maximum)
3. If file is PDF: read page count from PDF metadata
   If page count exceeds 1,000: reject immediately
   No AI processing, no Supabase insert, no queue entry
4. Upload file to Supabase Storage: ca-notes/{user_id}/{uuid}.{ext}
5. Insert row in user_notes table
6. Insert row in processing_queue
7. Return response immediately — processing runs in background

Response (success):

```json
{
  "success": true,
  "note_id": "string",
  "status": "queued",
  "file_type": "string",
  "page_count": "number"
}
```

Errors:

400 — Invalid file type
400 — File exceeds 20MB
400 — PDF exceeds 1,000 pages:
      "Your file has more than 1,000 pages. Please split it into smaller files and upload each separately."
500 — Storage upload failed

---

### GET /api/ca/notes/status/:note_id

Returns the current processing status of an uploaded document.

Response:

```json
{
  "note_id": "string",
  "status": "pending | processing | completed | failed",
  "progress_percent": "number",
  "questions_generated": "number",
  "flashcards_generated": "number",
  "content_map": {
    "blocks": [
      {
        "block_id": "string",
        "page_start": "number",
        "page_end": "number",
        "ca_level": "string",
        "paper": "string",
        "paper_name": "string",
        "content_type": "string",
        "topic": "string",
        "confidence": "number",
        "student_confirmed": "boolean",
        "level_mismatch": "boolean"
      }
    ],
    "papers_detected": ["string"],
    "unidentified_blocks": "number",
    "level_mismatches": "number"
  },
  "error_message": "string | null"
}
```

The content_map is returned as soon as content mapping is complete, before question generation finishes. This allows the frontend to show the student what was detected and prompt confirmation for low-confidence or mismatched blocks before generating questions.

---

### POST /api/ca/notes/confirm-mapping

Called when a student confirms or corrects a block mapping.

Request:

```json
{
  "note_id": "string",
  "block_id": "string",
  "confirmed_paper": "string",
  "confirmed_ca_level": "string",
  "action": "confirm | skip"
}
```

Process:

1. Update the block in content_map with student_confirmed: true
2. If action is "skip": mark block as skipped, no questions generated
3. If action is "confirm": update paper and ca_level for this block
4. Trigger question generation for confirmed blocks

Response:

```json
{
  "success": true,
  "block_id": "string",
  "action": "confirm | skip"
}
```

---

### GET /api/ca/notes

Returns all uploaded notes for the current user.

Query parameters:

```
ca_level: string (optional filter)
processed: boolean (optional filter)
page: number (default 1)
limit: number (default 20)
```

Response:

```json
{
  "notes": [
    {
      "id": "string",
      "title": "string",
      "file_type": "string",
      "page_count": "number",
      "processed": "boolean",
      "papers_detected": ["string"],
      "questions_generated": "number",
      "flashcards_generated": "number",
      "created_at": "string"
    }
  ],
  "total": "number",
  "page": "number"
}
```

---

## Question Routes

### GET /api/ca/questions

Fetches questions for a practice session.

Query parameters:

```
note_id: string (optional — questions from a specific upload)
ca_level: string (optional)
paper: string (optional)
question_type: "mcq" | "descriptive" (optional)
content_type: string (optional)
difficulty: string (optional)
unseen_only: boolean (default false)
limit: number (default 20)
offset: number (default 0)
```

Priority order when fetching:

1. Recall due questions (next_due_at <= NOW)
2. Unseen questions
3. Review deck questions

Response:

```json
{
  "questions": "Question[]",
  "total_available": "number",
  "unseen_count": "number",
  "recall_due_count": "number",
  "review_count": "number"
}
```

---

### POST /api/ca/questions/attempt

Submits a student's answer to a question.

Request:

```json
{
  "question_id": "string",
  "time_taken_seconds": "number",

  "// For MCQ": "",
  "selected_option": "A | B | C | D",

  "// For descriptive": "",
  "student_answer": "string"
}
```

Process for MCQ:

1. Read correct_option from generated_questions
2. Determine is_correct
3. Apply negative marking if applicable
4. Save to question_attempts
5. Update user_progress deck assignment
   Correct: deck_type = "recall", set next_due_at based on recall_setting
   Wrong: deck_type = "review", next_due_at = NOW
6. Return result immediately

Process for descriptive:

1. Save draft answer to question_attempts
2. Send to Gemini API for evaluation
   Include: question_text, model_answer, mark_allocation, student_answer
3. Parse evaluation JSON response
4. Save full evaluation to question_attempts
5. Update user_progress
6. Return evaluation

Response:

```json
{
  "// For MCQ": "",
  "is_correct": "boolean",
  "correct_option": "string",
  "explanation": "string",
  "negative_marking_applied": "boolean",
  "marks_deducted": "number",
  "deck_assignment": "recall | review",

  "// For descriptive": "",
  "marks_awarded": "number",
  "marks_total": "number",
  "percentage": "number",
  "what_was_correct": "string[]",
  "what_was_missed": "string[]",
  "presentation_feedback": "string",
  "improvement_tips": "string[]",
  "encouragement": "string"
}
```

---

## Flashcard Routes

### GET /api/ca/flashcards

Fetches flashcards for a practice session.

Query parameters:

```
note_id: string (optional)
flashcard_type: string (optional)
ca_level: string (optional)
paper: string (optional)
deck: "unseen" | "recall" | "review" (optional)
due_today: boolean (optional)
limit: number (default 20)
```

Response:

```json
{
  "flashcards": "Flashcard[]",
  "recall_due_count": "number",
  "review_count": "number",
  "unseen_count": "number"
}
```

---

### POST /api/ca/flashcards/progress

Updates flashcard progress after a student interaction.

Request:

```json
{
  "flashcard_id": "string",
  "action": "got_it | need_review"
}
```

Process:

1. Read flashcard type from user_flashcards
2. If flashcard_type is "section": set recall_override = "daily"
   next_due_at = NOW + 1 day regardless of profile recall_setting
3. If flashcard_type is "formula": next_due_at = NOW + 2 days
4. All others: next_due_at based on profile recall_setting
   daily: NOW + 1 day
   2days: NOW + 2 days
   weekly: NOW + 7 days
5. If action is "need_review": deck_type = "review", next_due_at = NOW
6. Save to user_flashcard_progress

Response:

```json
{
  "deck_type": "recall | review",
  "next_due_at": "string"
}
```

---

## AI Teacher Routes

### POST /api/ca/ai-teacher/message

Sends a student message to the AI Teacher.

Request:

```json
{
  "session_id": "string | null",
  "message": "string (max 500 characters)",
  "context": {
    "current_topic": "string",
    "ca_level": "string",
    "recent_accuracy": "number"
  }
}
```

Process:

1. Validate message length (max 500 characters)
2. Check rate limit:
   If more than 10 messages in last 60 seconds: return 429
3. Run topic classifier on message
   If out_of_scope: return redirect response, no Gemini call
4. Scan for prompt injection patterns
   If detected: return safe response, no Gemini call
5. Build prompt:
   System prompt + student context + conversation history (last 10 messages)
6. Call Gemini API
7. Run output filter on response
   If blocked: return fallback message
8. Increment ai_teacher_usage messages_sent
9. Save message and response to ai_teacher_sessions
10. Return response

Response:

```json
{
  "session_id": "string",
  "response": "string",
  "was_blocked": "boolean",
  "block_reason": "string | null"
}
```

Errors:

400 — Message exceeds 500 characters
429 — Rate limit: more than 10 messages in 60 seconds
      "Please slow down. Wait a moment before sending another message."

---

### GET /api/ca/ai-teacher/session/:session_id

Returns the full conversation history for a session.

Response:

```json
{
  "session_id": "string",
  "messages": [
    {
      "role": "user | assistant",
      "content": "string",
      "timestamp": "string"
    }
  ],
  "created_at": "string"
}
```

---

### DELETE /api/ca/ai-teacher/session/:session_id

Clears a conversation session. Used when student starts a new topic.

Response:

```json
{
  "success": true
}
```

---

## Progress and Analytics Routes

### GET /api/ca/analytics/progress

Returns a student's full progress summary.

Response:

```json
{
  "by_paper": [
    {
      "paper": "string",
      "paper_name": "string",
      "questions_attempted": "number",
      "mcq_accuracy": "number",
      "descriptive_avg_marks_percent": "number",
      "flashcards_mastered": "number"
    }
  ],
  "weak_topics": [
    {
      "topic": "string",
      "paper": "string",
      "paper_name": "string",
      "accuracy": "number",
      "attempts": "number"
    }
  ],
  "streak": "number",
  "longest_streak": "number",
  "total_uploads": "number",
  "total_questions_generated": "number",
  "total_questions_attempted": "number",
  "ai_teacher_sessions": "number"
}
```

Weak topic query (runs server-side):

```sql
SELECT
  q.topic,
  q.paper,
  q.paper_name,
  COUNT(*) as attempts,
  ROUND(
    SUM(CASE WHEN up.times_correct > 0 THEN 1 ELSE 0 END)::numeric
    / COUNT(*)::numeric * 100
  ) as accuracy
FROM user_progress up
JOIN generated_questions q ON q.id = up.question_id
WHERE up.user_id = auth.uid()
GROUP BY q.topic, q.paper, q.paper_name
HAVING COUNT(*) >= 5
AND ROUND(
  SUM(CASE WHEN up.times_correct > 0 THEN 1 ELSE 0 END)::numeric
  / COUNT(*)::numeric * 100
) < 50
ORDER BY accuracy ASC
LIMIT 10
```

---

## Internal Processing Routes

### POST /api/ca/internal/process-note

Called by the background worker only. Requires service role key. Not accessible to students.

Request:

```
{
  note_id: string
}
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
```

Process:

1. Download file from Supabase Storage
2. Determine file type
3. Run appropriate extraction:
   Typed PDF: pdf-parse + Gemini Vision per page
   Scanned PDF: Google Document AI OCR + Gemini Vision per page
   Image: Gemini Vision directly
   Text: pass directly
4. Run content type classification per block
5. Run paper mapping per block (see 03_CONTENT_MAPPING.md)
6. Build content_map
7. Update user_notes with content_map and processed = true
8. For blocks with confidence above 85% and no level mismatch:
   trigger question generation automatically
9. For blocks below 85% or with level mismatch:
   update status, wait for student confirmation via
   POST /api/ca/notes/confirm-mapping
10. Update processing_queue status to completed

Response:

```json
{
  "success": true,
  "blocks_processed": "number",
  "blocks_confirmed_auto": "number",
  "blocks_awaiting_confirmation": "number",
  "papers_detected": ["string"]
}
```

---

## Mock Test Routes

### GET /api/ca/mock-tests

Lists available mock tests for the student's level.

Query parameters:

```
ca_level: string (optional — defaults to profile level)
paper_number: number (optional)
test_type: string (optional)
```

Response:

```json
{
  "mock_tests": "CaMockTest[]"
}
```

---

### POST /api/ca/mock-tests/:test_id/start

Starts a mock test session and returns the questions.

Response:

```json
{
  "attempt_id": "string",
  "mock_test": "CaMockTest",
  "questions": "Question[]",
  "time_limit_minutes": "number",
  "started_at": "string"
}
```

---

### POST /api/ca/mock-tests/:test_id/submit

Submits a completed mock test for scoring.

Request:

```json
{
  "attempt_id": "string",
  "mcq_answers": { "question_id": "selected_option" },
  "descriptive_answers": { "question_id": "student_answer_text" },
  "time_taken_minutes": "number"
}
```

Response:

```json
{
  "mcq_score": "number",
  "descriptive_score": "number",
  "total_score": "number",
  "total_possible": "number",
  "percentage": "number",
  "mcq_breakdown": ["..."],
  "descriptive_breakdown": ["..."],
  "time_taken_minutes": "number"
}
```
