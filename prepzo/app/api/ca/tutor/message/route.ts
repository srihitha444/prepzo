import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/api-auth";
import { getChatModel, generateWithRetry, isRetryableGeminiError } from "@/lib/gemini";
import { fetchNoteContext } from "@/lib/ca/tutorContext";

export const maxDuration = 60;
import {
  buildSystemPrompt,
  classifyTopic,
  detectInjection,
  filterOutput,
  BLOCKED_OUTPUT_REPLY,
  INJECTION_REPLY,
  OUT_OF_SCOPE_REPLY,
} from "@/lib/ca/aiTeacher";

const MAX_MESSAGE_LENGTH = 500;
const MIN_MS_BETWEEN_MESSAGES = 5_000;
const MAX_MESSAGES_PER_MINUTE = 10;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

function checkRateLimit(recentMessages: ChatMessage[]): string | null {
  const userTimestamps = recentMessages.filter((m) => m.role === "user").map((m) => new Date(m.timestamp).getTime());
  if (userTimestamps.length === 0) return null;

  const now = Date.now();
  const last = Math.max(...userTimestamps);
  if (now - last < MIN_MS_BETWEEN_MESSAGES) {
    return "Please slow down. Wait a moment before sending another message.";
  }

  const lastMinute = userTimestamps.filter((t) => now - t < 60_000);
  if (lastMinute.length >= MAX_MESSAGES_PER_MINUTE) {
    return "You've sent a lot of messages quickly — please wait a few minutes before continuing.";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getRequestUser(request, supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: {
      session_id?: string;
      message?: string;
      note_id?: string;
      context?: { current_topic?: string; ca_level?: string; recent_accuracy?: number };
    } = await request.json();
    const { session_id, message, note_id, context } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message exceeds ${MAX_MESSAGE_LENGTH} characters` }, { status: 400 });
    }

    // Rate limit against the user's most recently active session, regardless
    // of which session this message will be appended to — otherwise starting
    // a fresh session would trivially reset the limit.
    const { data: recentSession } = await supabase
      .from("ai_teacher_sessions")
      .select("messages")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const rateLimitError = checkRateLimit((recentSession?.messages || []) as ChatMessage[]);
    if (rateLimitError) {
      return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    let sessionRow: { id: string; ca_level: string | null; current_topic: string | null; messages: ChatMessage[]; messages_count: number };

    if (session_id) {
      const { data, error } = await supabase.from("ai_teacher_sessions").select("*").eq("id", session_id).single();
      if (error || !data || data.user_id !== user.id) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      sessionRow = data;
    } else {
      // Each note gets one persistent chat — resume it if it already exists
      // instead of always starting a new one, so the AI Teacher sidebar can
      // show a stable, growing conversation per note (note_id null = the
      // general, not-note-scoped chat).
      let existingQuery = supabase.from("ai_teacher_sessions").select("*").eq("user_id", user.id);
      existingQuery = note_id ? existingQuery.eq("note_id", note_id) : existingQuery.is("note_id", null);
      const { data: existing } = await existingQuery.order("updated_at", { ascending: false }).limit(1).maybeSingle();

      if (existing) {
        sessionRow = existing;
      } else {
        const { data, error } = await supabase
          .from("ai_teacher_sessions")
          .insert({
            user_id: user.id,
            note_id: note_id || null,
            ca_level: context?.ca_level || null,
            current_topic: context?.current_topic || null,
            messages: [],
            messages_count: 0,
          })
          .select("*")
          .single();
        if (error || !data) {
          return NextResponse.json({ error: "Failed to start session" }, { status: 500 });
        }
        sessionRow = data;
      }
    }

    const userMessage: ChatMessage = { role: "user", content: message.trim(), timestamp: new Date().toISOString() };

    async function respond(replyText: string, blockReason: string | null) {
      const assistantMessage: ChatMessage = { role: "assistant", content: replyText, timestamp: new Date().toISOString() };
      const nextMessages = [...sessionRow.messages, userMessage, assistantMessage];

      await supabase
        .from("ai_teacher_sessions")
        .update({ messages: nextMessages, messages_count: nextMessages.length, updated_at: new Date().toISOString() })
        .eq("id", sessionRow.id);

      return NextResponse.json({
        session_id: sessionRow.id,
        response: replyText,
        was_blocked: blockReason !== null,
        block_reason: blockReason,
      });
    }

    if (classifyTopic(message) === "out_of_scope") {
      return await respond(OUT_OF_SCOPE_REPLY, "out_of_scope");
    }
    if (detectInjection(message)) {
      return await respond(INJECTION_REPLY, "prompt_injection");
    }

    const systemPrompt = buildSystemPrompt({
      level: context?.ca_level || sessionRow.ca_level || "Foundation",
      currentTopic: context?.current_topic || sessionRow.current_topic || "",
      recentAccuracy: typeof context?.recent_accuracy === "number" ? context.recent_accuracy : null,
    });

    const noteContext = await fetchNoteContext(supabase, user.id, note_id);
    const noteContextBlock = noteContext
      ? `\n\nSTUDENT'S OWN UPLOADED NOTES (prioritise explaining using this material and terminology when relevant to their question):\n\n${noteContext}`
      : "";

    const history = sessionRow.messages
      .slice(-10)
      .map((m) => `${m.role === "user" ? "Student" : "Prepzo Tutor"}: ${m.content}`)
      .join("\n");

    const prompt = `${systemPrompt}${noteContextBlock}\n\n${history ? `Conversation so far:\n${history}\n\n` : ""}Student: ${message.trim()}\n\nRespond as Prepzo Tutor:`;

    const model = getChatModel();
    const result = await generateWithRetry(model, prompt);
    const replyText = result.response.text().trim();

    if (!replyText || filterOutput(replyText)) {
      return await respond(BLOCKED_OUTPUT_REPLY, "output_filtered");
    }

    return await respond(replyText, null);
  } catch (error) {
    console.error("CA tutor message error:", error);
    if (isRetryableGeminiError(error)) {
      return NextResponse.json(
        { error: "Prepzo Tutor is experiencing high demand right now. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to get a response" }, { status: 500 });
  }
}
