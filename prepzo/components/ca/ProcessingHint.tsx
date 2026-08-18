"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// Matches lib/ca/processingTimeout.ts's own 45s internal cutoff, plus
// buffer for the download/DB round-trips around it — "usually takes about
// a minute" is accurate for the common case, and the "stuck" warning below
// only fires well past where a normal run (or the app's own timeout) would
// have already finished and recorded a real reason.
const EXPECTED_SECONDS = 60;
const STUCK_THRESHOLD_SECONDS = 120;

function elapsedSeconds(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
}

/**
 * Shown under a note/test-paper's status badge while it's queued or
 * processing — a live elapsed-time readout that switches to a "this may
 * have failed silently" warning past STUCK_THRESHOLD_SECONDS, plus a
 * Cancel button. A background job triggered via after() can't be reached
 * and interrupted directly from a later request, so "cancel" here means
 * deleting the row (see app/api/ca/notes/cancel, .../test-papers/cancel) —
 * the still-running job cooperatively checks whether its row still exists
 * before doing further work or writing results.
 */
export function ProcessingHint({
  createdAt,
  onCancel,
  reasons,
}: {
  createdAt: string;
  onCancel: () => Promise<void>;
  // Once it's actually stuck (past the threshold), we genuinely can't tell
  // WHICH of these is the real cause — the app's own 45s timeout already
  // catches slow-but-normal cases and records a specific reason as a
  // regular "Failed" status; getting all the way to "stuck" past 120s means
  // something bypassed even that. So this lists the known candidate causes
  // as separate, scannable lines (context-specific per upload type) rather
  // than guessing which one it is — the student is often the one who can
  // actually tell (e.g. they know if they uploaded notes by mistake).
  reasons: string[];
}) {
  const [elapsed, setElapsed] = useState(() => elapsedSeconds(createdAt));
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setElapsed(elapsedSeconds(createdAt)), 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const stuck = elapsed > STUCK_THRESHOLD_SECONDS;

  async function handleCancel() {
    setCancelling(true);
    try {
      await onCancel();
    } finally {
      setCancelling(false);
    }
  }

  if (!stuck) {
    return (
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-[#64748B]">
          Usually takes about {EXPECTED_SECONDS}s — {elapsed}s elapsed
        </p>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-[#E2E8F0] px-2 py-1 text-xs font-semibold text-[#64748B] transition-all hover:border-[#DC2626] hover:text-[#DC2626] disabled:opacity-50"
        >
          <X size={12} /> {cancelling ? "Cancelling..." : "Cancel"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg bg-[#FEF3C7] px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-[#92400E]">
          Taking longer than usual ({elapsed}s) — this may have failed silently. Likely reasons:
        </p>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-[#FDE68A] bg-white px-2 py-1 text-xs font-semibold text-[#92400E] transition-all hover:border-[#DC2626] hover:text-[#DC2626] disabled:opacity-50"
        >
          <X size={12} /> {cancelling ? "Cancelling..." : "Cancel"}
        </button>
      </div>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
        {reasons.map((reason) => (
          <li key={reason} className="text-xs text-[#92400E]">
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
