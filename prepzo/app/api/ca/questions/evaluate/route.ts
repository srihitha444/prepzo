import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { evaluateDescriptiveAnswer } from "@/lib/ca/evaluateAnswer";
import { recordAnswer } from "@/lib/questions";
import { isRetryableGeminiError } from "@/lib/gemini";
import type { Question } from "@/lib/supabase/types";

export const maxDuration = 60;
const ANSWER_IMAGE_BUCKET = "ca-answer-images";
const MAX_ANSWER_IMAGES = 6;
const MAX_ANSWER_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_ANSWER_TOTAL_BYTES = 14 * 1024 * 1024;
const ANSWER_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface AnswerImageRef {
  path: string;
  mime_type: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: {
      question_id?: string;
      student_answer?: string;
      confirmed_answer?: string;
      answer_images?: AnswerImageRef[];
      time_taken_seconds?: number;
    } = await request.json();
    const { question_id, student_answer, confirmed_answer, answer_images = [], time_taken_seconds } = body;

    if (!question_id || !Array.isArray(answer_images) || answer_images.length > MAX_ANSWER_IMAGES) {
      return NextResponse.json({ error: "A question and up to six answer images are required." }, { status: 400 });
    }
    const hasImages = answer_images.length > 0;
    const hasText = Boolean(student_answer?.trim());
    if (hasImages === hasText || (confirmed_answer && !hasImages)) {
      return NextResponse.json({ error: "Submit either a typed answer or answer images, not both." }, { status: 400 });
    }
    if (confirmed_answer !== undefined && (typeof confirmed_answer !== "string" || !confirmed_answer.trim())) {
      return NextResponse.json({ error: "Please enter the answer text you want graded." }, { status: 400 });
    }
    if (hasImages && answer_images.some((image) =>
      !image ||
      typeof image.path !== "string" ||
      !image.path.startsWith(`${user.id}/`) ||
      image.path.includes("..") ||
      !ANSWER_IMAGE_MIME_TYPES.has(image.mime_type)
    )) {
      return NextResponse.json({ error: "One or more answer images are invalid." }, { status: 400 });
    }
    if (new Set(answer_images.map((image) => image.path)).size !== answer_images.length) {
      return NextResponse.json({ error: "Duplicate answer images are not allowed." }, { status: 400 });
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

    const imageContents: { data: string; mimeType: string }[] = [];
    if (hasImages) {
      const service = await createServiceClient();
      let totalImageBytes = 0;
      for (const image of answer_images) {
        const { data: file, error: downloadError } = await service.storage.from(ANSWER_IMAGE_BUCKET).download(image.path);
        if (downloadError || !file) {
          console.error("Failed to load a submitted answer image:", downloadError);
          return NextResponse.json({ error: "We couldn't read one of your uploaded pages. Please upload it again." }, { status: 400 });
        }
        if (file.size > MAX_ANSWER_IMAGE_BYTES || file.type !== image.mime_type) {
          return NextResponse.json({ error: "An answer image is too large or has an unsupported file type." }, { status: 400 });
        }
        totalImageBytes += file.size;
        if (totalImageBytes > MAX_ANSWER_TOTAL_BYTES) {
          return NextResponse.json({ error: "Compressed answer pages must be 14MB or smaller in total." }, { status: 400 });
        }
        if (!confirmed_answer) {
          imageContents.push({
            data: Buffer.from(await file.arrayBuffer()).toString("base64"),
            mimeType: image.mime_type,
          });
        }
      }
    }

    const evaluation = await evaluateDescriptiveAnswer(
      question,
      confirmed_answer?.trim() || student_answer?.trim() || "",
      imageContents
    );
    if ("needs_review" in evaluation) {
      return NextResponse.json({
        ...evaluation,
        answer_images,
      });
    }

    const studentAnswer = confirmed_answer?.trim() || student_answer?.trim() || evaluation.extracted_answer || "";
    const service = await createServiceClient();

    const { error: insertError } = await service.from("question_attempts").insert({
      user_id: user.id,
      question_id,
      student_answer: studentAnswer,
      ...(hasImages ? { answer_images: answer_images.map((image) => image.path) } : {}),
      marks_awarded: evaluation.marks_awarded,
      marks_total: evaluation.marks_total,
      ai_evaluation: evaluation,
      time_taken_seconds: time_taken_seconds ?? null,
    });
    if (insertError) {
      console.error("Failed to save question_attempts row:", insertError);
      return NextResponse.json({ error: "We couldn't save your answer. Please try submitting it again." }, { status: 500 });
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

    const response: Record<string, unknown> = { ...evaluation };
    if (answer_images.length > 0) {
      const { data: signedImages, error: signedUrlError } = await service.storage
        .from(ANSWER_IMAGE_BUCKET)
        .createSignedUrls(answer_images.map((image) => image.path), 60 * 60);
      if (signedUrlError) {
        console.error("Failed to create answer image preview URLs:", signedUrlError);
      } else {
        response.answer_image_urls = (signedImages || []).flatMap((image) => image.signedUrl ? [image.signedUrl] : []);
      }
    }
    return NextResponse.json(response);
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
