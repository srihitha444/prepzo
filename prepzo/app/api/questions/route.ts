import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const exam = searchParams.get("exam");
  const subject = searchParams.get("subject");
  const difficulty = searchParams.get("difficulty");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

  if (!exam) {
    return NextResponse.json({ error: "exam parameter required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query = supabase
    .from("questions")
    .select("*")
    .eq("exam", exam)
    .eq("is_active", true)
    .range(offset, offset + limit - 1);

  if (subject) query = query.eq("subject", subject);
  if (difficulty && difficulty !== "All") query = query.eq("difficulty", difficulty);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ questions: data, count, offset, limit });
}
