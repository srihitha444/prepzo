import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const TOTAL_QUESTIONS = 180;

const SET_11_ANSWER_KEY: Record<number, 1 | 2 | 3 | 4> = {
  1: 4, 2: 4, 3: 4, 4: 3, 5: 3, 6: 4, 7: 1, 8: 3, 9: 4, 10: 3,
  11: 4, 12: 2, 13: 4, 14: 4, 15: 1, 16: 2, 17: 1, 18: 4, 19: 4, 20: 3,
  21: 2, 22: 4, 23: 1, 24: 3, 25: 3, 26: 3, 27: 1, 28: 3, 29: 4, 30: 4,
  31: 4, 32: 1, 33: 4, 34: 4, 35: 2, 36: 1, 37: 4, 38: 4, 39: 1, 40: 2,
  41: 3, 42: 3, 43: 2, 44: 1, 45: 3,
  46: 2, 47: 4, 48: 3, 49: 3, 50: 4, 51: 2, 52: 4, 53: 4, 54: 2, 55: 1,
  56: 1, 57: 3, 58: 4, 59: 2, 60: 1, 61: 4, 62: 4, 63: 3, 64: 1, 65: 2,
  66: 4, 67: 2, 68: 2, 69: 2, 70: 1, 71: 1, 72: 2, 73: 2, 74: 2, 75: 1,
  76: 1, 77: 3, 78: 2, 79: 4, 80: 3, 81: 4, 82: 2, 83: 4, 84: 2, 85: 3,
  86: 1, 87: 2, 88: 1, 89: 2, 90: 3,
  91: 4, 92: 2, 93: 3, 94: 3, 95: 1, 96: 1, 97: 3, 98: 1, 99: 4, 100: 4,
  101: 4, 102: 2, 103: 4, 104: 4, 105: 2, 106: 3, 107: 1, 108: 1, 109: 3, 110: 1,
  111: 4, 112: 1, 113: 3, 114: 4, 115: 1, 116: 3, 117: 1, 118: 2, 119: 1, 120: 4,
  121: 4, 122: 2, 123: 2, 124: 1, 125: 4, 126: 3, 127: 3, 128: 3, 129: 4, 130: 2,
  131: 1, 132: 3, 133: 1, 134: 2, 135: 2,
  136: 3, 137: 4, 138: 3, 139: 1, 140: 3, 141: 3, 142: 4, 143: 1, 144: 1, 145: 3,
  146: 4, 147: 2, 148: 4, 149: 1, 150: 2, 151: 3, 152: 1, 153: 4, 154: 2, 155: 1,
  156: 2, 157: 3, 158: 4, 159: 1, 160: 1, 161: 4, 162: 2, 163: 2, 164: 4, 165: 2,
  166: 4, 167: 2, 168: 3, 169: 1, 170: 3, 171: 1, 172: 1, 173: 4, 174: 4, 175: 4,
  176: 3, 177: 1, 178: 1, 179: 3, 180: 3,
};

const OPTION_MAP: Record<1 | 2 | 3 | 4, "A" | "B" | "C" | "D"> = {
  1: "A",
  2: "B",
  3: "C",
  4: "D",
};

type ImportBody = {
  exam?: string;
  year?: number;
  booklet_code?: string;
};

class ImportError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function getSubject(questionNumber: number): "Physics" | "Chemistry" | "Biology" {
  if (questionNumber <= 45) return "Physics";
  if (questionNumber <= 90) return "Chemistry";
  return "Biology";
}

function isConfiguredAdmin(email: string | undefined): boolean {
  if (!email) return false;
  const configured = [
    process.env.ADMIN_EMAILS || "",
    process.env.NEXT_PUBLIC_ADMIN_EMAILS || "",
  ]
    .join(",")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return configured.includes(email.toLowerCase()) || email.toLowerCase().includes("admin");
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { authorized: false, email: undefined };
  if (isConfiguredAdmin(user.email)) return { authorized: true, email: user.email };

  const service = await createServiceClient();
  const { data } = await service
    .from("admin_users")
    .select("email")
    .ilike("email", user.email || "")
    .maybeSingle();

  return { authorized: Boolean(data), email: user.email };
}

async function getOrCreatePaper(supabase: Awaited<ReturnType<typeof createServiceClient>>, body: Required<ImportBody>) {
  const { data: existing, error: fetchError } = await supabase
    .from("pyq_papers")
    .select("id")
    .eq("exam", body.exam)
    .eq("year", body.year)
    .eq("booklet_code", body.booklet_code)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing?.id) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from("pyq_papers")
    .insert({
      exam: body.exam,
      year: body.year,
      booklet_code: body.booklet_code,
      total_questions: TOTAL_QUESTIONS,
    })
    .select("id")
    .single();

  if (createError) throw createError;
  return created.id as string;
}

async function getOrCreatePlaceholderQuestion(params: {
  supabase: Awaited<ReturnType<typeof createServiceClient>>;
  questionNumber: number;
  bookletCode: string;
}) {
  const { supabase, questionNumber, bookletCode } = params;
  const questionText = `NEET 2026 unique question placeholder Q${questionNumber} Set ${bookletCode}`;

  const { data: existing, error: fetchError } = await supabase
    .from("pyq_questions")
    .select("id")
    .eq("question_text", questionText)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing?.id) return { id: existing.id as string, created: false };

  const { data: created, error: createError } = await supabase
    .from("pyq_questions")
    .insert({
      subject: getSubject(questionNumber),
      chapter: null,
      topic: null,
      question_text: questionText,
      question_image_url: null,
      option_a: null,
      option_b: null,
      option_c: null,
      option_d: null,
      option_a_image_url: null,
      option_b_image_url: null,
      option_c_image_url: null,
      option_d_image_url: null,
      explanation: null,
    })
    .select("id")
    .single();

  if (createError) throw createError;
  return { id: created.id as string, created: true };
}

function validateImportBody(body: ImportBody): Required<ImportBody> {
  if (body.exam !== "NEET") {
    throw new ImportError("Only exam=NEET is supported for this importer.");
  }
  if (body.year !== 2026) {
    throw new ImportError("Only year=2026 is supported for this importer.");
  }
  if (String(body.booklet_code) !== "11") {
    throw new ImportError("Only booklet_code=11 is supported for this importer.");
  }

  return { exam: "NEET", year: 2026, booklet_code: "11" };
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin.authorized) {
      console.warn("[pyq-import] unauthorized import attempt", { email: admin.email });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = validateImportBody((await request.json()) as ImportBody);
    const supabase = await createServiceClient();

    console.info("[pyq-import] starting import", body);
    const paperId = await getOrCreatePaper(supabase, body);

    let questionsCreated = 0;
    const mappings = [];

    for (let questionNumber = 1; questionNumber <= TOTAL_QUESTIONS; questionNumber += 1) {
      const answerKey = SET_11_ANSWER_KEY[questionNumber];
      if (!answerKey) {
        throw new Error(`Missing answer key for question ${questionNumber}.`);
      }

      const question = await getOrCreatePlaceholderQuestion({
        supabase,
        questionNumber,
        bookletCode: body.booklet_code,
      });

      if (question.created) questionsCreated += 1;

      mappings.push({
        paper_id: paperId,
        question_id: question.id,
        question_number: questionNumber,
        correct_option: OPTION_MAP[answerKey],
        marks_correct: 4,
        marks_wrong: -1,
        marks_unattempted: 0,
      });
    }

    const { error: mappingError } = await supabase
      .from("pyq_paper_questions")
      .upsert(mappings, { onConflict: "paper_id,question_number" });

    if (mappingError) throw mappingError;

    console.info("[pyq-import] completed import", {
      paper_id: paperId,
      questions_created: questionsCreated,
      mappings_created_or_updated: mappings.length,
    });

    return NextResponse.json({
      success: true,
      paper_id: paperId,
      questions_created: questionsCreated,
      mappings_created_or_updated: mappings.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PYQ import error";
    const status = error instanceof ImportError ? error.status : 500;
    console.error("[pyq-import] failed", error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
