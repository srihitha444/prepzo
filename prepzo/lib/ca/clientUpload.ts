// Shared browser-side file validation + direct-to-Supabase-Storage upload
// for CA uploads (notes, test papers). Vercel Serverless Functions have a
// hard ~4.5MB request body limit that Next.js route config cannot raise —
// routing the actual file bytes through a route handler silently broke any
// upload over that size (a plain-text 413 response crashing on the
// caller's res.json()), even though the app advertised "up to 20MB" and
// Supabase Storage itself has no such limit. Uploading directly from the
// browser to Supabase Storage bypasses the function entirely for the file
// bytes — only small JSON metadata (file_path, mime_type, page_count)
// passes through a route handler afterward to create the DB row and
// trigger background processing (see app/api/ca/notes/upload/route.ts /
// app/api/ca/test-papers/upload/route.ts, and lib/ca/processNote.ts /
// lib/ca/processTestPaper.ts, which already download the file by
// file_path and are unaffected by this change).

import { createClient } from "@/lib/supabase/client";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 1000;
export const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateUploadFile(file: File): string | null {
  if (!ALLOWED_MIME_TO_EXT[file.type]) {
    return "We only support PDF, JPG, PNG, and WEBP files.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "Your file is too large. Maximum size is 20MB. Please compress your file and try again.";
  }
  return null;
}

async function countPdfPages(file: File): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const buffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return doc.getPageCount();
}

export async function uploadFileToStorage(params: {
  file: File;
  bucket: string;
}): Promise<{ filePath: string; mimeType: string; pageCount: number }> {
  const { file, bucket } = params;
  const validationError = validateUploadFile(file);
  if (validationError) throw new Error(validationError);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in to upload.");

  let pageCount = 1;
  if (file.type === "application/pdf") {
    try {
      pageCount = await countPdfPages(file);
    } catch {
      throw new Error("This file could not be opened. Please check the file and try again.");
    }
    if (pageCount > MAX_PDF_PAGES) {
      throw new Error("Your file has more than 1,000 pages. Please split it into smaller files and upload each separately.");
    }
  }

  const ext = ALLOWED_MIME_TO_EXT[file.type];
  const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  return { filePath, mimeType: file.type, pageCount };
}

// Response bodies are usually JSON, but a platform-level error (a gateway
// timeout, an oversized response, etc) can return plain text instead —
// parsing that with a bare res.json() throws a confusing raw SyntaxError
// instead of a usable message. Always read as text first, then try to
// parse, falling back to the raw text/status.
export async function safeParseJson(res: Response): Promise<{ error?: string; [key: string]: unknown }> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 200) || res.statusText || `Request failed (${res.status})` };
  }
}
