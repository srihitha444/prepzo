"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface UseAiTeacherChatOptions {
  caLevel: string | null;
  currentTopic: string | null;
  recentAccuracy: number | null;
  initialSessionId?: string;
  noteId?: string;
  onSessionCreated?: (sessionId: string) => void;
}

export function useAiTeacherChat({
  caLevel,
  currentTopic,
  recentAccuracy,
  initialSessionId,
  noteId,
  onSessionCreated,
}: UseAiTeacherChatOptions) {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(Boolean(initialSessionId));
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!initialSessionId) return;
    const supabase = createClient();
    supabase
      .from("ai_teacher_sessions")
      .select("messages")
      .eq("id", initialSessionId)
      .single()
      .then(({ data }: { data: { messages: ChatMessage[] } | null }) => {
        setMessages(data?.messages || []);
        setLoadingHistory(false);
      });
  }, [initialSessionId]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    const optimisticUser: ChatMessage = { role: "user", content: trimmed, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, optimisticUser]);

    try {
      const res = await fetch("/api/ca/tutor/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: trimmed,
          note_id: noteId,
          context: { ca_level: caLevel, current_topic: currentTopic, recent_accuracy: recentAccuracy },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send message");

      if (!sessionId && json.session_id) {
        onSessionCreated?.(json.session_id);
      }
      setSessionId(json.session_id);
      setMessages((prev) => [...prev, { role: "assistant", content: json.response, timestamp: new Date().toISOString() }]);
    } catch (error) {
      setMessages((prev) => prev.slice(0, -1));
      throw error;
    } finally {
      setSending(false);
    }
  }

  return { sessionId, messages, loadingHistory, sending, sendMessage };
}
