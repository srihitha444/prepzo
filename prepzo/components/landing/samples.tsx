import { Camera, Check, ClipboardCheck, FileText, Layers, MessageCircle, X } from "lucide-react";

/**
 * Mock-ups of output the product genuinely produces, in the shape it produces
 * it: the grading card mirrors AnswerEvaluation (marks, what_was_correct,
 * what_was_missed, presentation feedback), review intervals match
 * lib/questions.ts on the default "daily" setting, and Inter MCQs carry no
 * negative marking because CA_SYLLABUS says they don't. These are product
 * demonstrations, not social proof — no counts, quotes or outcomes.
 */

const label = "text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]";

export function McqSample() {
  return (
    <div>
      <p className={label}>CA Inter · Advanced Accounting · MCQ</p>
      <p className="mt-2 text-sm font-medium leading-relaxed text-[#0F172A]">
        A company values its closing inventory at &#8377;4,20,000 (cost), whose net realisable value
        is &#8377;3,85,000. As per AS 2, the amount carried in the balance sheet is:
      </p>
      <Options options={PRACTICE_OPTIONS} />
      <div className="mt-4 rounded-xl bg-[#F8FAFF] p-3.5">
        <p className={label}>Explanation</p>
        <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">
          AS 2 carries inventories at the lower of cost and net realisable value. NRV (&#8377;3,85,000)
          is below cost, so the &#8377;35,000 write-down goes to the statement of profit and loss.
        </p>
      </div>
    </div>
  );
}

export function DescriptiveSample({ compact }: { compact?: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={label}>Corporate and Other Laws · Descriptive</p>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-[#0F172A]">
            State any four conditions a company must comply with under Section 73(2) of the
            Companies Act, 2013 before accepting deposits from its members.
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-xs font-bold text-white">
          2 / 4 marks
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-[#F8FAFF] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className={label}>Your answer</p>
          <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-[#64748B] ring-1 ring-[#E2E8F0]">
            <Camera size={11} /> Read from 1 handwritten page
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">
          The company must issue a circular to its members showing its financial position, and file
          it with the Registrar. It also has to certify that it has not defaulted in repaying any
          earlier deposits.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#16A34A]/30 bg-[#16A34A]/5 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#15803D]">
            <Check size={13} strokeWidth={3} /> What earned marks
          </p>
          <ul className="mt-2 space-y-1.5">
            {GOT_RIGHT.map((t) => (
              <li key={t} className="text-[11px] leading-relaxed text-[#475569]">&bull; {t}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/5 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#B91C1C]">
            <X size={13} strokeWidth={3} /> What you missed
          </p>
          <ul className="mt-2 space-y-1.5">
            {MISSED.map((t) => (
              <li key={t} className="text-[11px] leading-relaxed text-[#475569]">&bull; {t}</li>
            ))}
          </ul>
        </div>
      </div>

      {!compact && (
        <div className="mt-3 rounded-xl border border-[#E2E8F0] p-3.5">
          <p className={label}>Presentation tip</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#475569]">
            For a &ldquo;state any four&rdquo; question, number your points and keep each to a line
            &mdash; marks go per condition, so four short points beat two long ones.
          </p>
        </div>
      )}
    </div>
  );
}

export function TutorSample() {
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#DBEAFE] text-[#1E3A8A]">
          <MessageCircle size={15} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#0F172A]">AI Teacher</p>
          <p className="truncate text-[10px] text-[#94A3B8]">Chat for: Accounting &mdash; AS 2 Inventories.pdf</p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#1E3A8A] px-3.5 py-2.5 text-xs leading-relaxed text-white">
          Why does AS 2 use net realisable value instead of market price?
        </p>
      </div>

      <div className="mt-3 flex justify-start">
        <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[#F8FAFF] px-3.5 py-2.5 text-xs leading-relaxed text-[#475569]">
          Because NRV is what <em>this</em> business expects to actually recover &mdash; the
          estimated selling price less the costs still needed to complete and sell the item. Market
          price ignores both. Your notes make the same point under &ldquo;Measurement&rdquo;:
          inventory should never sit on the books above what it can recover.
        </p>
      </div>

      <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#DBEAFE] px-2.5 py-1.5 text-[10px] font-semibold text-[#1E3A8A]">
        <FileText size={11} /> Answered from your upload
      </div>
    </div>
  );
}

export function CheatsheetSample() {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
        <p className="text-sm font-semibold text-[#0F172A]">AS 2 &mdash; Valuation of Inventories</p>
        <span className="shrink-0 rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[10px] font-semibold text-[#64748B]">
          Export PDF
        </span>
      </div>
      <div className="mt-3.5 space-y-3">
        {CHEATSHEET_ROWS.map((r) => (
          <div key={r.h}>
            <p className="text-[11px] font-bold text-[#1E3A8A]">{r.h}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#475569]">{r.b}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] italic text-[#94A3B8]">
        Editable &mdash; change any line and save it. PDF export is on Pro and Premium.
      </p>
    </div>
  );
}

export function RealPaperSample() {
  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl bg-[#F8FAFF] px-4 py-3">
        <ClipboardCheck size={18} className="shrink-0 text-[#1E3A8A]" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#0F172A]">Mock paper &mdash; Advanced Accounting</p>
          <p className="text-[11px] text-[#94A3B8]">Your upload &middot; questions transcribed as written</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-[#E2E8F0] p-4">
        <span className="inline-block rounded-md bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-bold text-[#1E3A8A]">
          Case study
        </span>
        <p className="mt-2 text-[11px] leading-relaxed text-[#475569]">
          Sunrise Ltd. holds 12,000 units of inventory purchased at &#8377;35 each. At year end the
          market has fallen and each unit can be sold for &#8377;32, after selling costs of
          &#8377;1.50 per unit&hellip;
        </p>
        <div className="mt-3 space-y-2 border-t border-[#E2E8F0] pt-3">
          {PAPER_SUBQUESTIONS.map((q) => (
            <p key={q} className="text-[11px] font-medium leading-relaxed text-[#0F172A]">{q}</p>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[10px] italic text-[#94A3B8]">
        The passage stays attached to every sub-question that reads off it.
      </p>
    </div>
  );
}

export function RecallSample() {
  return (
    <div>
      <p className={label}>Up next in practice</p>
      <div className="mt-3 space-y-2.5">
        {RECALL_CARDS.map((c) => (
          <div key={c.t} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] px-3.5 py-3">
            <div
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                c.bad ? "bg-[#DC2626]/10 text-[#B91C1C]" : "bg-[#16A34A]/10 text-[#15803D]"
              }`}
            >
              <Layers size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[#0F172A]">{c.t}</p>
              <p className="text-[10px] text-[#94A3B8]">{c.s}</p>
            </div>
            <span className="shrink-0 text-[10px] font-semibold text-[#1E3A8A]">{c.due}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] italic text-[#94A3B8]">
        Shown on the default &ldquo;daily&rdquo; review setting.
      </p>
    </div>
  );
}

/** Small cards cycled through in the hero's "file → practice" visual. */
export function HeroOutput({ kind }: { kind: "descriptive" | "mcq" | "flashcard" }) {
  if (kind === "mcq") {
    return (
      <div>
        <Tag>MCQ</Tag>
        <p className="mt-2 text-sm font-medium leading-relaxed text-[#0F172A]">As per AS 2, inventories are valued at:</p>
        <Options options={HERO_OPTIONS} dense />
      </div>
    );
  }
  if (kind === "flashcard") {
    return (
      <div>
        <Tag>Flashcard</Tag>
        <p className="mt-2 text-sm font-medium leading-relaxed text-[#0F172A]">
          Which cost formulas does AS 2 permit?
        </p>
        <div className="mt-3 rounded-lg border border-dashed border-[#BFDBFE] bg-[#F8FAFF] px-3 py-2.5 text-xs leading-relaxed text-[#475569]">
          FIFO or weighted average cost. LIFO is not permitted.
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Tag>Descriptive</Tag>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">4 marks</span>
      </div>
      <p className="mt-2 text-sm font-medium leading-relaxed text-[#0F172A]">
        Explain the measurement of inventories under AS 2, with the components included in cost.
      </p>
      <div className="mt-3 space-y-1.5">
        {["Lower of cost and NRV — 1 mark", "Costs of purchase & conversion — 2 marks", "Exclusions from cost — 1 mark"].map((t) => (
          <p key={t} className="rounded-md bg-[#F8FAFF] px-2.5 py-1.5 text-[11px] text-[#475569]">{t}</p>
        ))}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-semibold text-[#1E3A8A]">
      {children}
    </span>
  );
}

function Options({ options, dense }: { options: { k: string; t: string; ok: boolean }[]; dense?: boolean }) {
  return (
    <div className={`mt-3 ${dense ? "space-y-1.5" : "space-y-2"}`}>
      {options.map((o) => (
        <div
          key={o.k}
          className={`flex items-center gap-2.5 rounded-lg border px-3 ${dense ? "py-1.5" : "py-2.5"} text-xs ${
            o.ok ? "border-[#16A34A] bg-[#16A34A]/5 font-semibold text-[#15803D]" : "border-[#E2E8F0] text-[#64748B]"
          }`}
        >
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
              o.ok ? "bg-[#16A34A] text-white" : "bg-[#F1F5F9] text-[#94A3B8]"
            }`}
          >
            {o.ok ? <Check size={11} strokeWidth={3} /> : o.k}
          </span>
          {o.t}
        </div>
      ))}
    </div>
  );
}

const HERO_OPTIONS = [
  { k: "A", t: "Cost", ok: false },
  { k: "B", t: "Net realisable value", ok: false },
  { k: "C", t: "Lower of cost and net realisable value", ok: true },
  { k: "D", t: "Higher of cost and net realisable value", ok: false },
];

const PRACTICE_OPTIONS = [
  { k: "A", t: "₹4,20,000", ok: false },
  { k: "B", t: "₹3,85,000", ok: true },
  { k: "C", t: "₹4,02,500", ok: false },
  { k: "D", t: "₹8,05,000", ok: false },
];

const GOT_RIGHT = [
  "Circular to members showing the company’s financial position",
  "Certificate of no default on earlier deposit repayments",
];

const MISSED = [
  "Circular must be filed with the Registrar at least 30 days before issue",
  "20% of deposits maturing next financial year held in a deposit repayment reserve account",
];

const CHEATSHEET_ROWS = [
  { h: "Measurement", b: "Lower of cost and net realisable value." },
  {
    h: "Cost includes",
    b: "Purchase price, non-recoverable duties and taxes, freight inwards and conversion costs. Excludes abnormal waste, storage (unless necessary) and selling costs.",
  },
  { h: "Cost formulas", b: "FIFO or weighted average. LIFO is not permitted." },
  {
    h: "Net realisable value",
    b: "Estimated selling price less the estimated costs of completion and the costs necessary to make the sale.",
  },
];

const PAPER_SUBQUESTIONS = [
  "(a) Compute the value of closing inventory as per AS 2.",
  "(b) State the accounting treatment of the resulting write-down.",
];

const RECALL_CARDS = [
  { t: "Cost formulas permitted under AS 2", s: "Answered wrong", due: "Within a day", bad: true },
  { t: "Definition of net realisable value", s: "Answered right", due: "Tomorrow", bad: false },
  { t: "Items excluded from cost of inventory", s: "Right twice", due: "In 3 days", bad: false },
];
