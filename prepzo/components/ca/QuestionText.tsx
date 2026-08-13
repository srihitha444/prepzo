import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Question text sometimes carries tabular content (balance sheets, ledgers,
// trial balances) — both the notes-derived generation prompt and the
// verbatim test-paper extraction prompt are instructed to emit that as a
// real markdown table (lib/ca/generateContent.ts, lib/ca/extractTestPaper.ts),
// so it needs an actual markdown+GFM renderer here rather than a plain <p>,
// or the table collapses into one unreadable run-on line of "|"-separated text.
const QUESTION_MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-2 mt-4 text-base font-bold text-[#0F172A] first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-2 mt-4 text-sm font-bold text-[#1E3A8A] first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1.5 mt-3 text-sm font-semibold text-[#0F172A] first:mt-0">{children}</h3>
  ),
  hr: () => <hr className="my-4 border-t border-[#E2E8F0]" />,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-[#F1F5F9] px-1 py-0.5 font-mono text-[0.85em] text-[#0F172A]">{children}</code>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-2 mt-1 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-[#F8FAFF]">{children}</thead>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-[#E2E8F0] px-2 py-1.5 text-left font-semibold text-[#0F172A]">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-[#E2E8F0] px-2 py-1.5 text-[#0F172A]">{children}</td>
  ),
};

export function QuestionText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={QUESTION_MARKDOWN_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
