"use client";

import { useEffect, useState } from "react";
import { Download, Eye, Pencil, Save } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { QuestionText } from "@/components/ca/QuestionText";
import { exportCheatsheetPdf } from "@/lib/ca/exportCheatsheetPdf";

export function CheatsheetEditor({
  cheatsheetId,
  noteTitle,
  onChanged,
}: {
  cheatsheetId: string;
  noteTitle: string;
  onChanged: () => void;
}) {
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("ca_cheatsheets")
      .select("content")
      .eq("id", cheatsheetId)
      .single()
      .then(({ data }: { data: { content: string } | null }) => {
        if (cancelled) return;
        setContent(data?.content || "");
        setSavedContent(data?.content || "");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cheatsheetId]);

  const dirty = content !== savedContent;

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("ca_cheatsheets")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", cheatsheetId);
    setSaving(false);
    if (error) {
      toast.error("Failed to save");
      return;
    }
    setSavedContent(content);
    toast.success("Saved");
    onChanged();
  }

  async function handleDownload() {
    try {
      await exportCheatsheetPdf(noteTitle, content);
    } catch {
      toast.error("Failed to create PDF");
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-[var(--shadow-card)] md:h-[calc(100vh-6rem)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate font-[family-name:var(--font-fraunces)] text-lg font-bold text-[#0F172A]">{noteTitle}</h2>
          <p className="text-xs text-[#64748B]">{dirty ? "Unsaved changes" : "All changes saved"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setPreviewing((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] hover:border-[#3B5FBF]"
          >
            {previewing ? <Pencil size={13} /> : <Eye size={13} />}
            {previewing ? "Edit" : "Preview"}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] hover:border-[#3B5FBF]"
          >
            <Download size={13} /> PDF
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:bg-[#162D6B] disabled:opacity-50"
          >
            <Save size={13} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <p className="text-center text-xs text-[#64748B]">Loading...</p>
        ) : previewing ? (
          <QuestionText text={content || "*Nothing here yet.*"} className="text-sm leading-relaxed text-[#0F172A]" />
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Your cheatsheet content..."
            className="h-full w-full resize-none rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-4 font-[family-name:var(--font-dm-mono)] text-sm text-[#0F172A] focus:border-[#3B5FBF] focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}
