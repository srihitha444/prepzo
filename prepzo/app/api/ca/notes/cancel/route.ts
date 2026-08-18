import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";

const NOTES_BUCKET = "ca-notes";

// Deletes a note that hasn't finished processing yet, rather than just
// flagging it — a queued/processing/failed note has no generated content
// to preserve, and this doubles as the mechanism processNote.ts polls for
// ("does this row still exist?") to stop doing further work once cancelled,
// since a background job triggered via after() can't be reached and
// interrupted directly from a later, separate request.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { note_id?: string } = await request.json();
    const { note_id } = body;
    if (!note_id) {
      return NextResponse.json({ error: "note_id is required" }, { status: 400 });
    }

    const service = await createServiceClient();

    const { data: note, error: noteError } = await service
      .from("user_notes")
      .select("id, user_id, file_path, processed")
      .eq("id", note_id)
      .single();
    if (noteError || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    if (note.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (note.processed) {
      return NextResponse.json({ error: "This note has already finished processing" }, { status: 400 });
    }

    await service.storage.from(NOTES_BUCKET).remove([note.file_path]);
    await service.from("processing_queue").delete().eq("note_id", note_id);
    await service.from("user_notes").delete().eq("id", note_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CA note cancel error:", error);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}
