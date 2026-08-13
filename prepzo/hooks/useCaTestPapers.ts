"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TestPaperStatus = "pending" | "processing" | "completed" | "failed";

export interface CaTestPaper {
  id: string;
  paper: string;
  title: string;
  page_count: number;
  processed: boolean;
  processing_error: string | null;
  question_count: number;
  created_at: string;
  status: TestPaperStatus;
}

const POLL_MS = 4000;

export function useCaTestPapers() {
  const [papers, setPapers] = useState<CaTestPaper[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPapers = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPapers([]);
      setLoading(false);
      return;
    }

    const { data: papersRaw } = await supabase
      .from("ca_test_papers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const papersList = papersRaw || [];
    const paperIds = papersList.map((p) => p.id);

    if (paperIds.length === 0) {
      setPapers([]);
      setLoading(false);
      return;
    }

    const { data: queueRaw } = await supabase
      .from("processing_queue")
      .select("test_paper_id, status")
      .in("test_paper_id", paperIds);

    const statusByPaper = new Map<string, TestPaperStatus>(
      (queueRaw || []).map((q) => [q.test_paper_id, q.status as TestPaperStatus])
    );

    setPapers(
      papersList.map((p) => ({
        ...p,
        status: statusByPaper.get(p.id) || (p.processed ? "completed" : "pending"),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount via a memoized async helper; setState happens after an await
    fetchPapers();
  }, [fetchPapers]);

  useEffect(() => {
    const hasActiveWork = papers.some((p) => p.status === "pending" || p.status === "processing");
    if (!hasActiveWork) return;
    const interval = setInterval(fetchPapers, POLL_MS);
    return () => clearInterval(interval);
  }, [papers, fetchPapers]);

  async function uploadPaper(file: File, paperCode: string, title?: string): Promise<{ test_paper_id: string }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("paper", paperCode);
    if (title) formData.append("title", title);

    const res = await fetch("/api/ca/test-papers/upload", { method: "POST", body: formData });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Upload failed");
    await fetchPapers();
    return json;
  }

  return { papers, loading, uploadPaper, refetch: fetchPapers };
}
