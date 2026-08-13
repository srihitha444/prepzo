import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { evaluateDescriptiveAnswer } from "@/lib/ca/evaluateAnswer";
import { recordAnswer } from "@/lib/questions";
import { isRetryableGeminiError } from "@/lib/gemini";
import type { Question } from "@/lib/supabase/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { question_id?: string; student_answer?: string; time_taken_seconds?: number } = await request.json();
    const { question_id, student_answer, time_taken_seconds } = body;

    if (!question_id || !student_answer?.trim()) {
      return NextResponse.json({ error: "question_id and student_answer are required" }, { status: 400 });
    }

    const { data: questionRaw, error: questionError } = await supabase
      .from("questions")
      .select("*")
      .eq("id", question_id)
      .eq("is_active", true)
      .single();

    if (questionError || !questionRaw) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const question = questionRaw as Question;
    if (question.question_type !== "descriptive") {
      return NextResponse.json({ error: "This question is not a descriptive question" }, { status: 400 });
    }
    // model_answer can legitimately be null for a verbatim test-paper question
    // with no printed solution — evaluateDescriptiveAnswer already tolerates
    // that (grades off the question text + the AI's own subject knowledge),
    // so it's not blocked here.

    const evaluation = await evaluateDescriptiveAnswer(question, student_answer);

    const { error: insertError } = await supabase.from("question_attempts").insert({
      user_id: user.id,
      question_id,
      student_answer,
      marks_awarded: evaluation.marks_awarded,
      marks_total: evaluation.marks_total,
      ai_evaluation: evaluation,
      time_taken_seconds: time_taken_seconds ?? null,
    });
    if (insertError) {
      console.error("Failed to save question_attempts row:", insertError);
    }

    await recordAnswer({
      userId: user.id,
      questionId: question_id,
      isCorrect: evaluation.percentage >= 50,
      timeSeconds: time_taken_seconds ?? 0,
      selectedOption: null,
      skipped: false,
      supabaseClient: supabase,
    });

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error("CA answer evaluation error:", error);
    if (isRetryableGeminiError(error)) {
      return NextResponse.json(
        { error: "Answer grading is experiencing high demand right now. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to evaluate answer" }, { status: 500 });
  }
}
