import Link from "next/link";

export default function CaNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8FAFF] p-4 text-center">
      <span className="font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#1E3A8A]">
        Prepzo CA
      </span>
      <h1 className="text-lg font-semibold text-[#0F172A]">This part of Prepzo CA isn&apos;t ready yet</h1>
      <p className="max-w-sm text-sm text-[#64748B]">
        We&apos;re still building this page. Check back soon.
      </p>
      <Link
        href="/dashboard"
        className="rounded-xl bg-[#1E3A8A] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#162D6B]"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
