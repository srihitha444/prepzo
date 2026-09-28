import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { consumeQuota, releaseQuota, resolvePlan } from "@/lib/ca/usage";

/**
 * Claims one mock-test allowance AND creates the attempt row.
 *
 * Creating the row here is what makes the quota enforceable. Previously the
 * browser inserted its own attempt (hooks/useCaMockTest.ts) under a
 * `for all using (auth.uid() = user_id)` policy, so a student could simply
 * skip this route and write the row directly — the meter was advisory. Now
 * ca_mock_test_attempts is service-write only (see
 * supabase/ca-plans-and-metering.sql), so an attempt cannot exist unless this
 * route made it, and this route charges for it.
 *
 * Metering at START rather than on submission is deliberate: the product
 * sells "1 mock test a month", and a student who abandons a test has used
 * their attempt — otherwise the limit is bypassed by never finishing.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { paper?: string; test_paper_id?: string } = await request.json().catch(() => ({}));
    const paper = typeof body.paper === "string" && body.paper.trim() ? body.paper.trim() : "Unknown";

    const service = await createServiceClient();
    const plan = await resolvePlan(service, user.id);
    const quota = await consumeQuota(service, user.id, plan.id, "mock_tests");

    if (!quota.ok) {
      return NextResponse.json({ error: quota.message, quota_exhausted: true }, { status: 402 });
    }

    // completed_at stays null until /finish, which is how an abandoned test
    // is told apart from a finished one everywhere it's read.
    const { data: attempt, error } = await service
      .from("ca_mock_test_attempts")
      .insert({
        user_id: user.id,
        paper,
        test_paper_id: body.test_paper_id ?? null,
        completed_at: null,
      })
      .select("id")
      .single();

    if (error || !attempt) {
      console.error("CA mock attempt insert failed:", error);
      // The student got nothing, so don't spend their allowance on it.
      await releaseQuota(service, user.id, "mock_tests", quota.periodStart);
      return NextResponse.json({ error: "Could not start the test" }, { status: 500 });
    }

    return NextResponse.json({ success: true, attempt_id: attempt.id, used: quota.used, cap: quota.cap });
  } catch (error) {
    console.error("CA mock test start error:", error);
    return NextResponse.json({ error: "Could not start the test" }, { status: 500 });
  }
}
