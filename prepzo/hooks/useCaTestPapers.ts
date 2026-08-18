"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeParseJson, uploadFileToStorage } from "@/lib/ca/clientUpload";

export type TestPaperStatus = "pending" | "processing" | "completed" | "failed";

export interface CaTestPaper {
  id: string;
  // Detected from the uploaded document's content after processing, not
  // chosen by the student — null until processing finishes (or if
  // processing failed before a paper could be identified).
  paper: string | null;
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

  async function uploadPaper(file: File, title?: string): Promise<{ test_paper_id: string }> {
    const { filePath, mimeType, pageCount } = await uploadFileToStorage({ file, bucket: "ca-test-papers" });

    const res = await fetch("/api/ca/test-papers/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path: filePath, mime_type: mimeType, page_count: pageCount, title }),
    });
    const json = await safeParseJson(res);
    if (!res.ok) throw new Error(json.error || "Upload failed");
    await fetchPapers();
    return json as { test_paper_id: string };
  }

  async function cancelPaper(testPaperId: string): Promise<void> {
    const res = await fetch("/api/ca/test-papers/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test_paper_id: testPaperId }),
    });
    const json = await safeParseJson(res);
    if (!res.ok) throw new Error(json.error || "Failed to cancel");
    await fetchPapers();
  }

  return { papers, loading, uploadPaper, cancelPaper, refetch: fetchPapers };
}
