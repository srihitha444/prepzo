import { EXTRACTION_PROMPT_HASH, type ContentMap } from "@/lib/ca/extraction";

/**
 * Shared cache for the expensive half of processing: the Gemini vision call
 * that reads a document and splits it into blocks. Students upload the same
 * files as each other (ICAI study material, coaching handouts), and today
 * every upload re-derives from scratch even when the bytes are identical.
 *
 * Keyed on (file_hash, ca_level). Level is in the key because the same
 * document must map to different papers and generate structurally different
 * content at Foundation vs Intermediate vs Final.
 *
 * Only PDFs realistically hit this — photos and scans of the same page
 * differ byte-for-byte between students. That's expected; see the header of
 * supabase/ca-generation-cache.sql.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = any;

export async function getCachedExtraction(
  supabase: ServiceClient,
  fileHash: string | null,
  caLevel: string
): Promise<ContentMap | null> {
  if (!fileHash) return null;

  const { data } = await supabase
    .from("ca_extraction_cache")
    .select("content_map, prompt_hash")
    .eq("file_hash", fileHash)
    .eq("ca_level", caLevel)
    .maybeSingle();

  if (!data) return null;

  // The entry was produced by an older version of the extraction rules.
  // Treat it as a miss so the caller re-derives; putCachedExtraction then
  // overwrites this row in place. The entry is never deleted — it is
  // replaced by a better one — which is what keeps a prompt improvement
  // from being permanently locked out of already-cached documents.
  if (data.prompt_hash !== EXTRACTION_PROMPT_HASH) return null;

  return (data.content_map as ContentMap) || null;
}

export async function putCachedExtraction(
  supabase: ServiceClient,
  fileHash: string | null,
  caLevel: string,
  contentMap: ContentMap
): Promise<void> {
  if (!fileHash) return;

  const { error } = await supabase.from("ca_extraction_cache").upsert(
    {
      file_hash: fileHash,
      ca_level: caLevel,
      prompt_hash: EXTRACTION_PROMPT_HASH,
      content_map: contentMap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "file_hash,ca_level" }
  );

  // A cache write failing must never fail the upload — the student's note
  // has already been extracted successfully at this point, and the only
  // cost of not caching it is that the next student pays for it again.
  if (error) console.error("[extractionCache] Could not cache extraction:", error);
}
