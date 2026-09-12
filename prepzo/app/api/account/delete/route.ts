import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";

// Shared between NEET and CA — one auth.users/profiles table, so there's
// nothing exam-specific here. Deleting auth.users cascades through every
// user-owned table via `references profiles(id) on delete cascade`
// (profiles itself cascades from `references auth.users on delete cascade`
// — see supabase/schema.sql), so no manual per-table deletion is needed.
// Storage isn't part of that FK graph, so the user's files in the two
// user-scoped buckets are cleaned up separately, best-effort.
const USER_SCOPED_BUCKETS = ["ca-notes", "ca-test-papers"];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = await createServiceClient();

    for (const bucket of USER_SCOPED_BUCKETS) {
      try {
        const { data: files } = await serviceClient.storage.from(bucket).list(user.id);
        if (files && files.length > 0) {
          await serviceClient.storage.from(bucket).remove(files.map((f: { name: string }) => `${user.id}/${f.name}`));
        }
      } catch (storageError) {
        console.error(`Account deletion: failed to clean up ${bucket} for user ${user.id}:`, storageError);
      }
    }

    // Which documents this user held. Read BEFORE deleting the auth user,
    // because user_notes cascades away with them.
    const { data: ownNotes } = await serviceClient
      .from("user_notes")
      .select("file_hash")
      .eq("user_id", user.id)
      .not("file_hash", "is", null);
    const ownHashes = Array.from(new Set<string>((ownNotes || []).map((n: { file_hash: string }) => n.file_hash)));

    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Account deletion failed:", deleteError);
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    await pruneOrphanedCache(serviceClient, ownHashes);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}

/**
 * Retention rule for the shared derivation cache (DPDP Act 2023).
 *
 * A cached derivation is kept only while at least one live user still holds
 * the document it came from. Run right after the departing user's rows have
 * cascaded away, so the "does anyone else still have this?" check reflects
 * reality:
 *
 *   - another user still has the same file_hash -> the derivation stays,
 *     effectively transferring to them. Students who legitimately hold the
 *     same document keep the benefit, and so does anyone who uploads it later.
 *   - nobody else has it -> the derivation is deleted with its only holder.
 *     This is what keeps a private document (handwritten notes, which no one
 *     else will ever upload byte-identically) from lingering in a shared
 *     store after its owner has gone.
 *
 * Best-effort: the account is already deleted by this point and must not be
 * reported as failed because a cache row survived. Anything left behind is
 * unreachable — no user_notes row references the hash — and gets cleaned up
 * on the next deletion that touches it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pruneOrphanedCache(serviceClient: any, hashes: string[]): Promise<void> {
  if (hashes.length === 0) return;

  try {
    const { data: survivingNotes } = await serviceClient
      .from("user_notes")
      .select("file_hash")
      .in("file_hash", hashes);
    const stillHeld = new Set((survivingNotes || []).map((n: { file_hash: string }) => n.file_hash));
    const orphaned = hashes.filter((h) => !stillHeld.has(h));
    if (orphaned.length === 0) return;

    await serviceClient.from("ca_generation_cache").delete().in("file_hash", orphaned);
    await serviceClient.from("ca_extraction_cache").delete().in("file_hash", orphaned);
  } catch (error) {
    console.error("Account deletion: failed to prune orphaned derivation cache:", error);
  }
}
