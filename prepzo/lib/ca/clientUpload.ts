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

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_MB = MAX_FILE_BYTES / (1024 * 1024);
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
    return `Your file is too large. Maximum size is ${MAX_FILE_MB}MB. Please compress your file and try again.`;
  }
  return null;
}

// Returns null (rather than throwing) if pdf-lib can't determine the page
// count — this is informational only (shown in the UI, and checked against
// MAX_PDF_PAGES as a sanity cap), never required for actual processing:
// Gemini receives the raw file bytes directly and never touches pdf-lib's
// result. Some real, valid PDFs (institute-produced study material was the
// case that surfaced this) trip pdf-lib's internal page-tree resolution
// with errors like "Expected instance of PDFDict, but got instance of
// undefined" even with throwOnInvalidObject: false, which covers a
// different failure mode (individual invalid objects, not xref/page-tree
// structure) — blocking the whole upload over a count pdf-lib can't
// compute would reject files that Gemini can process just fine.
async function countPdfPages(file: File): Promise<number | null> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const buffer = await file.arrayBuffer();
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, throwOnInvalidObject: false });
    return doc.getPageCount();
  } catch (error) {
    console.error("[clientUpload] Could not count PDF pages — proceeding without a count (page count is informational only, not required for processing):", error);
    return null;
  }
}

// Below this, compressing isn't worth the CPU/latency for the (small) gain.
const COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024;
// Generous cap — preserves fine print/handwriting readability for Gemini's
// vision input; this is about cutting bytes from an oversized photo/scan
// (phone cameras routinely produce 4000px+ images), not shrinking the page
// itself. Re-encoded as JPEG regardless of the source format: document
// photos/scans never rely on PNG transparency, and JPEG compresses this
// kind of content far better than PNG at a size a text-heavy page still
// reads cleanly at.
const MAX_DIMENSION_PX = 2600;
const JPEG_QUALITY = 0.85;

// Only ever used to REDUCE upload/processing time for an image that
// already passed validateUploadFile — never a way to let an
// over-the-limit file through, and never applied to PDFs (no equivalent
// lightweight client-side path for those — see the conversation this was
// scoped from). Falls back to the original file untouched on any failure,
// or if compression didn't actually make it smaller.
async function compressImageIfWorthwhile(file: File): Promise<File> {
  if (file.size < COMPRESS_THRESHOLD_BYTES) return file;
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return file;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
      const scale = MAX_DIMENSION_PX / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const compressedName = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
    return new File([blob], compressedName, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export async function uploadFileToStorage(params: {
  file: File;
  bucket: string;
}): Promise<{ filePath: string; mimeType: string; pageCount: number; fileHash: string | null }> {
  const { bucket } = params;
  let file = params.file;
  const validationError = validateUploadFile(file);
  if (validationError) throw new Error(validationError);

  if (file.type !== "application/pdf") {
    file = await compressImageIfWorthwhile(file);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in to upload.");

  let pageCount = 1;
  if (file.type === "application/pdf") {
    const counted = await countPdfPages(file);
    if (counted !== null) {
      pageCount = counted;
      if (pageCount > MAX_PDF_PAGES) {
        throw new Error("Your file has more than 1,000 pages. Please split it into smaller files and upload each separately.");
      }
    }
    // counted === null: pdf-lib couldn't introspect this file, but that
    // doesn't mean it's actually broken — proceed with pageCount left at
    // the placeholder default (1, display-only) rather than blocking the
    // upload. The MAX_FILE_BYTES file-size cap and the 165s processing timeout
    // remain as the real safety nets against a genuinely huge document.
  }

  const fileHash = await hashFile(file);

  const ext = ALLOWED_MIME_TO_EXT[file.type];
  const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  return { filePath, mimeType: file.type, pageCount, fileHash };
}

// sha256 of the exact bytes being uploaded — the shared-derivation cache
// key (supabase/ca-generation-cache.sql). Hashed AFTER any image
// compression, so it matches the file the server will actually download
// and process.
//
// Returns null rather than throwing if the platform can't do it: the hash
// is an optimisation, and a note that can't be hashed should still upload
// and process normally, just always missing the cache. crypto.subtle is
// unavailable on insecure origins, which is why this can't be assumed.
async function hashFile(file: File): Promise<string | null> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return null;
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (error) {
    console.error("[clientUpload] Could not hash file — proceeding without a cache key:", error);
    return null;
  }
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
