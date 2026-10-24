import { createClient } from "@/lib/supabase/client";
import { uploadFileToStorage } from "@/lib/ca/clientUpload";

export const ANSWER_IMAGE_BUCKET = "ca-answer-images";
export const MAX_ANSWER_IMAGES = 6;
export const MAX_ANSWER_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_ANSWER_TOTAL_BYTES = 14 * 1024 * 1024;
export const MAX_ANSWER_SELECTION_BYTES = 40 * 1024 * 1024;

export interface AnswerImageRef {
  path: string;
  mime_type: string;
}

export interface AnswerSubmissionResponse {
  needs_review?: boolean;
  extracted_answer?: string;
  answer_image_urls?: string[];
  marks_awarded?: number;
  marks_total?: number;
  percentage?: number;
  what_was_correct?: string[];
  what_was_missed?: string[];
  presentation_feedback?: string;
  improvement_tips?: string[];
  encouragement?: string;
}

export class AnswerSubmissionError extends Error {
  constructor(message: string, public readonly images: AnswerImageRef[]) {
    super(message);
    this.name = "AnswerSubmissionError";
  }
}

export async function submitAnswerForEvaluation(params: {
  questionId: string;
  text: string;
  files: File[];
  uploadedImages?: AnswerImageRef[];
  confirmedAnswer?: string;
  timeTakenSeconds?: number;
}): Promise<{ result: AnswerSubmissionResponse; images: AnswerImageRef[] }> {
  const { questionId, text, files, confirmedAnswer, timeTakenSeconds } = params;
  let images = params.uploadedImages || [];
  const newlyUploaded: AnswerImageRef[] = [];

  if (files.length > MAX_ANSWER_IMAGES) {
    throw new Error(`Upload up to ${MAX_ANSWER_IMAGES} answer pages.`);
  }
  if (files.some((file) => !file.type.startsWith("image/") || file.type === "image/heic" || file.type === "image/heif")) {
    throw new Error("Use JPG, PNG, or WEBP images. Convert HEIC photos to JPG before uploading.");
  }
  if (files.some((file) => file.size > MAX_ANSWER_IMAGE_BYTES)) {
    throw new Error("Each answer image must be 10MB or smaller.");
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_ANSWER_SELECTION_BYTES) {
    throw new Error("The selected images are too large together. Choose fewer or smaller pages.");
  }

  if (images.length === 0 && files.length > 0) {
    try {
      let totalUploadedBytes = 0;
      for (const file of files) {
        const uploaded = await uploadFileToStorage({ file, bucket: ANSWER_IMAGE_BUCKET });
        const image = { path: uploaded.filePath, mime_type: uploaded.mimeType };
        images = [...images, image];
        newlyUploaded.push(image);
        totalUploadedBytes += uploaded.fileSize;
        if (totalUploadedBytes > MAX_ANSWER_TOTAL_BYTES) {
          throw new Error("Compressed answer pages must be 14MB or smaller in total. Remove some pages and try again.");
        }
      }
    } catch (error) {
      if (newlyUploaded.length > 0) {
        const supabase = createClient();
        const { error: cleanupError } = await supabase.storage
          .from(ANSWER_IMAGE_BUCKET)
          .remove(newlyUploaded.map((image) => image.path));
        if (cleanupError) console.error("Failed to clean up incomplete answer image upload:", cleanupError);
      }
      throw error;
    }
  }

  try {
    const response = await fetch("/api/ca/questions/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: questionId,
        student_answer: text,
        confirmed_answer: confirmedAnswer,
        answer_images: images,
        time_taken_seconds: timeTakenSeconds,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new AnswerSubmissionError(result.error || "Evaluation failed", images);
    return { result, images };
  } catch (error) {
    if (error instanceof AnswerSubmissionError) throw error;
    throw new AnswerSubmissionError(
      error instanceof Error ? error.message : "Evaluation failed",
      images
    );
  }
}

export async function removeUncommittedAnswerImages(images: AnswerImageRef[]): Promise<void> {
  if (images.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.storage.from(ANSWER_IMAGE_BUCKET).remove(images.map((image) => image.path));
  if (error) console.error("Failed to remove uncommitted answer images:", error);
}
