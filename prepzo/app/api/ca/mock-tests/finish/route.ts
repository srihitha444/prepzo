import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";

/**
 * Records the result against an attempt that /start already created and
 * charged for.
 *
 * Scores are still computed in the browser, which is worth being honest
 * about: a determined student could report a better score than they earned.
 * That's a cosmetic lie about their own practice history, not a way to take
 * more tests than they paid for — which is what this change set out to fix.
 * Grading server-side would mean moving the whole answer model across, a much
 * larger change for a much smaller problem.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: {
      attempt_id?: string;
      mcq_answers?: unknown;
      descriptive_answers?: unknown;
      mcq_score?: number;
      descriptive_score?: number;
      total_score?: number;
      total_possible?: number;
    } = await request.json();

    if (!body.attempt_id) {
      return NextResponse.json({ error: "attempt_id is required" }, { status: 400 });
    }

    const service = await createServiceClient();
    const { data: attempt } = await service
      .from("ca_mock_test_attempts")
      .select("id, user_id, completed_at")
      .eq("id", body.attempt_id)
      .maybeSingle();

    if (!attempt) {
      return NextResponse.json({ error: "We couldn't find that attempt." }, { status: 404 });
    }
    if (attempt.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Finishing twice would let one charged attempt overwrite its own result
    // repeatedly; harmless, but there's no reason to allow it.
    if (attempt.completed_at) {
      return NextResponse.json({ success: true, already_recorded: true });
    }

    const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

    const { error } = await service
      .from("ca_mock_test_attempts")
      .update({
        mcq_answers: body.mcq_answers ?? {},
        descriptive_answers: body.descriptive_answers ?? {},
        mcq_score: num(body.mcq_score),
        descriptive_score: num(body.descriptive_score),
        total_score: num(body.total_score),
        total_possible: num(body.total_possible),
        completed_at: new Date().toISOString(),
      })
      .eq("id", attempt.id);

    if (error) {
      console.error("CA mock attempt update failed:", error);
      return NextResponse.json({ error: "Could not save your result" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CA mock test finish error:", error);
    return NextResponse.json({ error: "Could not save your result" }, { status: 500 });
  }
}
