import { randomUUID } from "crypto";
import { after, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { processNote } from "@/lib/ca/processNote";

export const maxDuration = 60;

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 1000;
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function fileTypeFor(mimeType: string): "pdf" | "image" {
  return mimeType === "application/pdf" ? "pdf" : "image";
}

async function countPdfPages(buffer: Buffer): Promise<number> {
  // pdf-lib, not pdf-parse/pdfjs-dist: the latter tries to spin up a
  // worker thread for parsing, which doesn't bundle correctly under
  // Next.js/Turbopack for server routes ("Setting up fake worker failed:
  // Cannot find module '.../pdf.worker.mjs'") — broke on every real PDF,
  // not just malformed ones. pdf-lib has no worker/canvas dependency and
  // is enough for a page count.
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return doc.getPageCount();
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const title = formData.get("title");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const mimeType = file.type;
    const ext = ALLOWED_MIME_TO_EXT[mimeType];
    if (!ext) {
      return NextResponse.json({ error: "We only support PDF, JPG, PNG, and WEBP files." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Your file is too large. Maximum size is 20MB. Please compress your file and try again." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let pageCount = 1;
    if (mimeType === "application/pdf") {
      try {
        pageCount = await countPdfPages(buffer);
      } catch (pdfError) {
        console.error("[ca/notes/upload] PDF could not be parsed:", pdfError);
        return NextResponse.json(
          { error: "This file could not be opened. Please check the file and try again." },
          { status: 400 }
        );
      }
      if (pageCount > MAX_PAGES) {
        return NextResponse.json(
          {
            error:
              "Your file has more than 1,000 pages. Please split it into smaller files and upload each separately.",
          },
          { status: 400 }
        );
      }
    }

    const noteUuid = randomUUID();
    const filePath = `${user.id}/${noteUuid}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("ca-notes").upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (uploadError) {
      console.error("CA notes storage upload failed:", uploadError);
      return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
    }

    const { data: noteRow, error: insertError } = await supabase
      .from("user_notes")
      .insert({
        user_id: user.id,
        title: typeof title === "string" && title.trim() ? title.trim() : file.name,
        file_path: filePath,
        file_type: fileTypeFor(mimeType),
        mime_type: mimeType,
        page_count: pageCount,
      })
      .select("id")
      .single();

    if (insertError || !noteRow) {
      console.error("CA user_notes insert failed:", insertError);
      return NextResponse.json({ error: "Failed to save upload record" }, { status: 500 });
    }

    // processing_queue is service-managed by design (users only get a
    // SELECT policy, to check status — see ca-notes-pipeline-schema.sql) —
    // the initial row has to be inserted with the service client, not the
    // user-scoped one used above for user_notes.
    const serviceClient = await createServiceClient();
    const { error: queueError } = await serviceClient.from("processing_queue").insert({
      note_id: noteRow.id,
      user_id: user.id,
      status: "pending",
    });
    if (queueError) {
      console.error("CA processing_queue insert failed:", queueError);
      return NextResponse.json({ error: "Failed to queue processing" }, { status: 500 });
    }

    after(() => processNote(noteRow.id));

    return NextResponse.json({
      success: true,
      note_id: noteRow.id,
      status: "queued",
      file_type: fileTypeFor(mimeType),
      page_count: pageCount,
    });
  } catch (error) {
    console.error("CA notes upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
