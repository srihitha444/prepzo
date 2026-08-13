"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import { Bot, Send, ShieldCheck, User, FileText } from "lucide-react";
import { useAiTeacherChat } from "@/hooks/useAiTeacherChat";

const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  h1: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1.5 mt-2 text-sm font-bold first:mt-0">{children}</h3>,
  h2: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1.5 mt-2 text-sm font-bold first:mt-0">{children}</h3>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1.5 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-black/10 px-1 py-0.5 font-[family-name:var(--font-dm-mono)] text-xs">{children}</code>
  ),
  hr: () => <hr className="my-2 border-current/10" />,
};

export function TutorChat({
  caLevel,
  currentTopic,
  recentAccuracy,
  noteId,
  noteTitle,
  initialSessionId,
  onSessionCreated,
}: {
  caLevel: string | null;
  currentTopic: string | null;
  recentAccuracy: number | null;
  noteId?: string;
  noteTitle?: string | null;
  initialSessionId?: string;
  onSessionCreated?: (sessionId: string) => void;
}) {
  const { messages, loadingHistory, sending, sendMessage } = useAiTeacherChat({
    caLevel,
    currentTopic,
    recentAccuracy,
    noteId,
    initialSessionId,
    onSessionCreated,
  });
  const [input, setInput] = useState("");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input;
    setInput("");
    try {
      await sendMessage(text);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-[var(--shadow-card)] md:h-[calc(100vh-6rem)]">
      <div className="border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <ShieldCheck size={14} className="text-[#16A34A]" />
          Ask about your CA papers — off-topic or inappropriate messages will be declined.
        </div>
        {noteTitle && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#1E3A8A]">
            <FileText size={13} />
            Grounded in: {noteTitle}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {loadingHistory ? (
          <p className="text-center text-xs text-[#64748B]">Loading conversation...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-[#64748B]">
            Ask anything about your CA syllabus — concepts, sections, or a question you&apos;re stuck on.
          </p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  msg.role === "user" ? "bg-[#1E3A8A] text-white" : "bg-[#DBEAFE] text-[#1E3A8A]"
                }`}
              >
                {msg.role === "user" ? <User size={15} /> : <Bot size={15} />}
              </div>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-tr-sm bg-[#1E3A8A] text-white whitespace-pre-wrap"
                    : "rounded-tl-sm bg-[#F8FAFF] text-[#0F172A]"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown components={MARKDOWN_COMPONENTS}>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}

        {sending && (
          <div className="flex gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[#1E3A8A]">
              <Bot size={15} />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-[#F8FAFF] px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#94A3B8]"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-[#E2E8F0] p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 500))}
          disabled={sending}
          placeholder="Ask a question about your CA papers..."
          className="flex-1 rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:border-[#1E3A8A] focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E3A8A] text-white transition-all hover:bg-[#162D6B] disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
