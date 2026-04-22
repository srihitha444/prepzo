"use client";

import { Modal } from "@/components/ui/Modal";
import { Crown, Check, X } from "lucide-react";
import Link from "next/link";

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
}

export function PaywallModal({ open, onClose }: PaywallModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="text-center">
        <div className="w-16 h-16 bg-[#FEF3C7] rounded-full flex items-center justify-center mx-auto mb-4">
          <Crown size={28} className="text-[#D97706]" />
        </div>
        <h2 className="font-[family-name:var(--font-fraunces)] text-xl font-bold text-[#0F172A] mb-2">
          Daily Limit Reached
        </h2>
        <p className="text-sm text-[#64748B] mb-6">
          You&apos;ve used your 15 free questions for today. Upgrade to Pro for full access to MCQs every day.
        </p>

        <div className="bg-[#F8FAFF] rounded-xl p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">What you get with Pro</p>
          {[
            "Full access to MCQs",
            "All 3 exams (JEE Main, NEET, CUET)",
            "Advanced Recall with spaced repetition",
            "Speed Mode flashcards",
            "Detailed analytics & weak topics",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 py-1.5">
              <Check size={14} className="text-[#16A34A] shrink-0" />
              <span className="text-sm text-[#0F172A]">{f}</span>
            </div>
          ))}
        </div>

        <Link
          href="/upgrade"
          onClick={onClose}
          className="block w-full py-3.5 rounded-xl bg-[#1E3A8A] text-white font-semibold text-sm hover:bg-[#162D6B] transition-all mb-3"
        >
          Upgrade — from ₹99/mo
        </Link>
        <button
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 w-full py-3 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <X size={14} /> Maybe tomorrow
        </button>
      </div>
    </Modal>
  );
}
