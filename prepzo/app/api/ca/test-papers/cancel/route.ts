import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";

const TEST_PAPERS_BUCKET = "ca-test-papers";

// Deletes a test paper that hasn't finished processing yet — see the
// equivalent comment on app/api/ca/notes/cancel/route.ts. This is also
// what processTestPaper.ts polls for to stop doing further work once
// cancelled.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { test_paper_id?: string } = await request.json();
    const { test_paper_id } = body;
    if (!test_paper_id) {
      return NextResponse.json({ error: "test_paper_id is required" }, { status: 400 });
    }

    const service = await createServiceClient();

    const { data: paper, error: paperError } = await service
      .from("ca_test_papers")
      .select("id, user_id, file_path, processed")
      .eq("id", test_paper_id)
      .single();
    if (paperError || !paper) {
      return NextResponse.json({ error: "Test paper not found" }, { status: 404 });
    }
    if (paper.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (paper.processed) {
      return NextResponse.json({ error: "This paper has already finished processing" }, { status: 400 });
    }

    await service.storage.from(TEST_PAPERS_BUCKET).remove([paper.file_path]);
    await service.from("processing_queue").delete().eq("test_paper_id", test_paper_id);
    await service.from("ca_test_papers").delete().eq("id", test_paper_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CA test paper cancel error:", error);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}
