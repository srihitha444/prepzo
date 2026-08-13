import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { getPaperByCode } from "@/lib/ca-syllabus";
import type { ContentBlock, ContentMap } from "@/lib/ca/extraction";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { note_id?: string; block_id?: string; confirmed_paper?: string; action?: "confirm" | "skip" } =
      await request.json();
    const { note_id, block_id, confirmed_paper, action } = body;

    if (!note_id || !block_id || (action !== "confirm" && action !== "skip")) {
      return NextResponse.json({ error: "note_id, block_id, and a valid action are required" }, { status: 400 });
    }
    if (action === "confirm" && !confirmed_paper) {
      return NextResponse.json({ error: "confirmed_paper is required to confirm a block" }, { status: 400 });
    }

    const service = await createServiceClient();

    const { data: note, error: noteError } = await service
      .from("user_notes")
      .select("id, user_id, content_map")
      .eq("id", note_id)
      .single();
    if (noteError || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    if (note.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: profile } = await service.from("profiles").select("ca_level").eq("id", user.id).single();
    if (!profile?.ca_level) {
      return NextResponse.json({ error: "CA onboarding not completed" }, { status: 400 });
    }

    const contentMap = note.content_map as ContentMap | null;
    const block = contentMap?.blocks.find((b) => b.block_id === block_id);
    if (!contentMap || !block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    let updatedBlock: ContentBlock;
    if (action === "skip") {
      updatedBlock = { ...block, status: "skipped", student_confirmed: true };
    } else {
      const paper = getPaperByCode(confirmed_paper!);
      if (!paper) {
        return NextResponse.json({ error: "Unknown paper code" }, { status: 400 });
      }
      updatedBlock = {
        ...block,
        paper: paper.code,
        paper_name: paper.name,
        status: "auto",
        confidence: 100,
        student_confirmed: true,
      };
    }

    const nextBlocks = contentMap.blocks.map((b) => (b.block_id === block_id ? updatedBlock : b));
    const nextContentMap: ContentMap = { ...contentMap, blocks: nextBlocks };
    await service.from("user_notes").update({ content_map: nextContentMap }).eq("id", note_id);

    // Confirming just fixes the block's paper mapping — it doesn't generate
    // anything. Once confirmed, this block has status "auto" like any other
    // mapped block, so it's picked up the next time the student clicks
    // "Create Practice Session" / "Generate Flashcards" (POST /api/ca/notes/generate).

    return NextResponse.json({ success: true, block_id, action });
  } catch (error) {
    console.error("CA confirm-mapping error:", error);
    return NextResponse.json({ error: "Failed to update block mapping" }, { status: 500 });
  }
}
