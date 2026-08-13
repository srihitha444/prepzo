// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export interface PyqPaperQuestion {
  id: string;
  paper_id: string;
  question_id: string;
  question_number: number;
  correct_option: "A" | "B" | "C" | "D" | null;
  marks_correct: number;
  marks_wrong: number;
  marks_unattempted: number;
  question: {
    id: string;
    subject: string | null;
    chapter: string | null;
    topic: string | null;
    question_text: string | null;
    question_image_url: string | null;
    option_a: string | null;
    option_b: string | null;
    option_c: string | null;
    option_d: string | null;
    option_a_image_url: string | null;
    option_b_image_url: string | null;
    option_c_image_url: string | null;
    option_d_image_url: string | null;
    explanation: string | null;
  };
}

export interface PyqPaperWithQuestions {
  paper: {
    id: string;
    exam: string;
    year: number;
    booklet_code: string;
    total_questions: number;
    created_at: string;
  };
  questions: PyqPaperQuestion[];
}

export async function fetchPyqPaperWithQuestions(
  supabase: AnySupabase,
  params: {
    paperId?: string;
    exam?: string;
    year?: number;
    bookletCode?: string;
  }
): Promise<PyqPaperWithQuestions | null> {
  let paperId = params.paperId;

  if (!paperId) {
    if (!params.exam || !params.year || !params.bookletCode) {
      throw new Error("paperId or exam/year/bookletCode is required.");
    }

    const { data: paper, error: paperError } = await supabase
      .from("pyq_papers")
      .select("id")
      .eq("exam", params.exam)
      .eq("year", params.year)
      .eq("booklet_code", params.bookletCode)
      .maybeSingle();

    if (paperError) throw paperError;
    if (!paper?.id) return null;
    paperId = paper.id;
  }

  const { data, error } = await supabase
    .from("pyq_paper_questions")
    .select(`
      id,
      paper_id,
      question_id,
      question_number,
      correct_option,
      marks_correct,
      marks_wrong,
      marks_unattempted,
      pyq_papers!inner(id, exam, year, booklet_code, total_questions, created_at),
      pyq_questions!inner(
        id,
        subject,
        chapter,
        topic,
        question_text,
        question_image_url,
        option_a,
        option_b,
        option_c,
        option_d,
        option_a_image_url,
        option_b_image_url,
        option_c_image_url,
        option_d_image_url,
        explanation
      )
    `)
    .eq("paper_id", paperId)
    .order("question_number", { ascending: true });

  if (error) throw error;
  const rows = data || [];
  if (rows.length === 0) return null;

  const first = rows[0];
  const paper = Array.isArray(first.pyq_papers) ? first.pyq_papers[0] : first.pyq_papers;

  return {
    paper,
    questions: rows.map((row: Record<string, unknown>) => {
      const question = Array.isArray(row.pyq_questions)
        ? row.pyq_questions[0]
        : row.pyq_questions;

      return {
        id: row.id,
        paper_id: row.paper_id,
        question_id: row.question_id,
        question_number: row.question_number,
        correct_option: row.correct_option,
        marks_correct: row.marks_correct,
        marks_wrong: row.marks_wrong,
        marks_unattempted: row.marks_unattempted,
        question,
      } as PyqPaperQuestion;
    }),
  };
}
