import { after, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { processTestPaper } from "@/lib/ca/processTestPaper";

// The file itself is uploaded directly from the browser to Supabase
// Storage (see lib/ca/clientUpload.ts) — Vercel Serverless Functions have
// a hard ~4.5MB request body limit that can't be raised via Next.js
// config, which silently broke any upload over that size even though this
// route only ever advertised a 20MB cap. This route now just registers
// the already-uploaded file's metadata and kicks off background
// processing, so its own request body is always small JSON.
export const maxDuration = 30;

const MAX_PAGES = 1000;
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const filePath = body.file_path;
    const mimeType = body.mime_type;
    const pageCount = body.page_count;
    const title = body.title;

    if (typeof filePath !== "string" || !filePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Invalid file reference" }, { status: 400 });
    }
    if (typeof mimeType !== "string" || !ALLOWED_MIME_TO_EXT[mimeType]) {
      return NextResponse.json({ error: "We only support PDF, JPG, PNG, and WEBP files." }, { status: 400 });
    }
    const safePageCount = typeof pageCount === "number" && pageCount > 0 ? Math.floor(pageCount) : 1;
    if (safePageCount > MAX_PAGES) {
      return NextResponse.json(
        { error: "Your file has more than 1,000 pages. Please split it into smaller files and upload each separately." },
        { status: 400 }
      );
    }

    const { data: paperRow, error: insertError } = await supabase
      .from("ca_test_papers")
      .insert({
        user_id: user.id,
        title: typeof title === "string" && title.trim() ? title.trim() : filePath.split("/").pop(),
        file_path: filePath,
        mime_type: mimeType,
        page_count: safePageCount,
      })
      .select("id")
      .single();

    if (insertError || !paperRow) {
      console.error("CA ca_test_papers insert failed:", insertError);
      return NextResponse.json({ error: "Failed to save upload record" }, { status: 500 });
    }

    // processing_queue is service-managed by design (users only get a
    // SELECT policy) — same reasoning as the notes upload route.
    const serviceClient = await createServiceClient();
    const { error: queueError } = await serviceClient.from("processing_queue").insert({
      test_paper_id: paperRow.id,
      user_id: user.id,
      status: "pending",
    });
    if (queueError) {
      console.error("CA test paper processing_queue insert failed:", queueError);
      return NextResponse.json({ error: "Failed to queue processing" }, { status: 500 });
    }

    after(() => processTestPaper(paperRow.id));

    return NextResponse.json({
      success: true,
      test_paper_id: paperRow.id,
      status: "queued",
      page_count: safePageCount,
    });
  } catch (error) {
    console.error("CA test paper upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
