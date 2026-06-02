import Link from "next/link";

interface TextDocumentPageProps {
  title: string;
  content: string;
}

export function TextDocumentPage({ title, content }: TextDocumentPageProps) {
  return (
    <main className="min-h-screen bg-[#F8FAFF] text-[#0F172A]">
      <header className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#1E3A8A]">
            Prepzo
          </Link>
          <Link href="/" className="text-sm font-semibold text-[#1E3A8A] hover:underline">
            Back Home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-[var(--shadow-card)] sm:p-8">
          <h1 className="mb-6 font-[family-name:var(--font-fraunces)] text-3xl font-bold text-[#0F172A]">
            {title}
          </h1>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-[#334155]">
            {content}
          </pre>
        </div>
      </article>
    </main>
  );
}

