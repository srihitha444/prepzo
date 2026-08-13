"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { NotesUploadZone } from "@/components/ca/NotesUploadZone";
import { createClient } from "@/lib/supabase/client";
import { useCaTestPapers, type CaTestPaper, type TestPaperStatus } from "@/hooks/useCaTestPapers";
import { getPaperByCode, type CaPaper } from "@/lib/ca-syllabus";

const STATUS_LABEL: Record<TestPaperStatus, string> = {
  pending: "Queued",
  processing: "Processing",
  completed: "Ready",
  failed: "Failed",
};
const STATUS_VARIANT: Record<TestPaperStatus, "success" | "warning" | "muted" | "error"> = {
  pending: "muted",
  processing: "warning",
  completed: "success",
  failed: "error",
};

interface AttemptLogRow {
  id: string;
  total_score: number;
  total_possible: number;
  completed_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function useAttemptHistory(userId: string, testPaperIds: string[]) {
  const [history, setHistory] = useState<Map<string, AttemptLogRow[]>>(new Map());
  const idsKey = testPaperIds.join(",");

  const fetchHistory = useCallback(async () => {
    if (testPaperIds.length === 0) {
      setHistory(new Map());
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("ca_mock_test_attempts")
      .select("id, test_paper_id, total_score, total_possible, completed_at")
      .eq("user_id", userId)
      .in("test_paper_id", testPaperIds)
      .order("completed_at", { ascending: false });

    const map = new Map<string, AttemptLogRow[]>();
    for (const row of (data || []) as Array<AttemptLogRow & { test_paper_id: string | null }>) {
      if (!row.test_paper_id) continue;
      const list = map.get(row.test_paper_id) || [];
      list.push(row);
      map.set(row.test_paper_id, list);
    }
    setHistory(map);
  }, [userId, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a memoized async helper; setState happens after an await
    fetchHistory();
  }, [fetchHistory]);

  return { history, refetchHistory: fetchHistory };
}

function AttemptHistory({ attempts }: { attempts: AttemptLogRow[] }) {
  const [expanded, setExpanded] = useState(false);
  if (attempts.length === 0) return null;

  return (
    <div className="mt-2">
      <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-[#1E3A8A]">
        {attempts.length} past attempt{attempts.length === 1 ? "" : "s"}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {attempts.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs text-[#64748B]">
              <span>{formatDate(a.completed_at)}</span>
              <span>{a.total_score}/{a.total_possible}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaperRow({
  paper,
  attempts,
  onAttempt,
}: {
  paper: CaTestPaper;
  attempts: AttemptLogRow[];
  onAttempt: () => void;
}) {
  const caPaper = getPaperByCode(paper.paper);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#1E3A8A]">
          <FileText size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#0F172A]">{paper.title}</p>
          <p className="truncate text-xs text-[#64748B]">
            {caPaper?.name || paper.paper}
            {" · "}
            {paper.status === "completed"
              ? `${paper.question_count} question${paper.question_count === 1 ? "" : "s"}`
              : paper.status === "failed"
                ? paper.processing_error || "Something went wrong"
                : `${paper.page_count} page${paper.page_count === 1 ? "" : "s"}`}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[paper.status]}>{STATUS_LABEL[paper.status]}</Badge>
      </div>

      {paper.status === "completed" && (
        <div className="mt-3 border-t border-[#E2E8F0] pt-3">
          <button
            onClick={onAttempt}
            disabled={paper.question_count === 0}
            className="rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:bg-[#162D6B] disabled:opacity-50"
          >
            {attempts.length > 0 ? "Retake" : "Attempt"}
          </button>
          <AttemptHistory attempts={attempts} />
        </div>
      )}
    </Card>
  );
}

export function TestPapersPanel({
  userId,
  papers,
  onAttempt,
}: {
  userId: string;
  papers: CaPaper[];
  onAttempt: (testPaperId: string, paper: CaPaper) => void;
}) {
  const { papers: uploaded, loading, uploadPaper } = useCaTestPapers();
  const [selectedPaper, setSelectedPaper] = useState(papers[0]?.code || "");
  const { history, refetchHistory } = useAttemptHistory(userId, uploaded.map((p) => p.id));

  return (
    <div>
      <p className="text-sm text-[#64748B]">
        Upload a real past or mock paper — questions are transcribed exactly as printed, not AI-generated, so you can attempt the actual paper.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <label className="text-xs font-semibold text-[#64748B]">Paper</label>
        <select
          value={selectedPaper}
          onChange={(e) => setSelectedPaper(e.target.value)}
          className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs text-[#0F172A]"
        >
          {papers.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <NotesUploadZone
          onUpload={async (file) => {
            if (!selectedPaper) {
              toast.error("Select a paper first");
              return;
            }
            await uploadPaper(file, selectedPaper);
          }}
        />
      </div>

      {!loading && uploaded.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploaded.map((paper) => (
            <PaperRow
              key={paper.id}
              paper={paper}
              attempts={history.get(paper.id) || []}
              onAttempt={() => {
                const caPaper = getPaperByCode(paper.paper);
                if (!caPaper) return;
                onAttempt(paper.id, caPaper);
                refetchHistory();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
