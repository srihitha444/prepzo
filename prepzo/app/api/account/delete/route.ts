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

    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Account deletion failed:", deleteError);
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
