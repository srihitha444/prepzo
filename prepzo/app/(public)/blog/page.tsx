import type { Metadata } from "next";
import { ArrowRight, BookOpenText } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "NEET Preparation Blog | Prepzo",
  description: "Smart NEET preparation strategies, study systems, revision guidance, and exam tips from Prepzo.",
};

const posts = [
  {
    title: "How NEET Toppers Study: 7 Smart Habits That Help Them Crack NEET",
    description:
      "Learn the study habits NEET toppers use to master NCERT, revise consistently, practise MCQs, analyse mistakes, and build reliable systems.",
    tag: "NEET Strategy",
    href: "/blog/how-neet-toppers-study",
    readTime: "6 min read",
  },
];

export default function BlogPage() {
  return (
    <main className="public-blog mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 md:py-20">
      <section className="mb-10 max-w-3xl">
        <p className="public-blog-eyebrow text-xs font-bold uppercase tracking-[0.18em] text-[#1E3A8A]">Prepzo Blog</p>
        <h1 className="public-blog-title mt-3 font-[family-name:var(--font-fraunces)] text-4xl font-bold text-[#0F172A] md:text-5xl">
          Clear NEET guidance for focused preparation
        </h1>
        <p className="public-blog-muted mt-4 text-base leading-7 text-[#64748B]">
          Practical study systems, subject strategies, and exam guidance for students doing the real work.
        </p>
      </section>

      <section className="grid gap-4" aria-label="Blog posts">
        {posts.map((post) => (
          <Link
            key={post.href}
            href={post.href}
            className="public-blog-card group rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-[var(--shadow-card)] transition-all hover:border-[#1E3A8A]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="public-blog-tag inline-flex items-center gap-2 rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-bold text-[#1E3A8A]">
                <BookOpenText size={14} />
                {post.tag}
              </span>
              <span className="public-blog-muted text-xs font-semibold text-[#64748B]">{post.readTime}</span>
            </div>
            <h2 className="public-blog-heading font-[family-name:var(--font-fraunces)] text-2xl font-bold text-[#0F172A]">
              {post.title}
            </h2>
            <p className="public-blog-muted mt-3 max-w-3xl text-sm leading-6 text-[#64748B]">{post.description}</p>
            <span className="public-blog-link mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#1E3A8A]">
              Read article
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
