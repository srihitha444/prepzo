"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Plus, Search, Eye, EyeOff, Upload, Users, DollarSign } from "lucide-react";
import toast from "react-hot-toast";
import type { Question } from "@/lib/supabase/types";

type AdminTab = "questions" | "add" | "analytics";

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("questions");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterExam, setFilterExam] = useState("NEET");
  const [analytics, setAnalytics] = useState({ users: 0, paid: 0, revenue: 0 });

  const [form, setForm] = useState({
    exam: "NEET",
    subject: "",
    topic: "",
    question_text: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_option: "A",
    explanation: "",
    difficulty: "Medium",
  });

  const checkAdmin = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAuthorized(false); return; }

    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map((e) => e.trim());
    setAuthorized(!!(adminEmails.includes(user.email || "") || user.email?.includes("admin")));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkAdmin();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [checkAdmin]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase.from("questions").select("*").eq("exam", filterExam).order("created_at", { ascending: false }).limit(50);
    if (search) query = query.ilike("question_text", `%${search}%`);
    const { data } = await query;
    setQuestions(data || []);
    setLoading(false);
  }, [filterExam, search]);

  const loadAnalytics = useCallback(async () => {
    const supabase = createClient();
    const { count: users } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    const { count: paid } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("plan", "paid");
    const { data: subs } = await supabase.from("subscriptions").select("amount").eq("status", "active");
    const revenue = (subs || []).reduce((s: number, sub: { amount: number | null }) => s + (sub.amount || 0), 0);
    setAnalytics({ users: users || 0, paid: paid || 0, revenue: revenue / 100 });
  }, []);

  useEffect(() => {
    if (authorized) {
      const timer = window.setTimeout(() => {
        void loadQuestions();
        void loadAnalytics();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [authorized, loadQuestions, loadAnalytics]);

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.from("questions").insert({
      ...form,
      correct_option: form.correct_option as "A" | "B" | "C" | "D",
      difficulty: form.difficulty as "Easy" | "Medium" | "Hard",
      is_active: true,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Question added!");
    setForm({ exam: "NEET", subject: "", topic: "", question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A", explanation: "", difficulty: "Medium" });
    setActiveTab("questions");
    loadQuestions();
  }

  async function toggleActive(id: string, current: boolean) {
    const supabase = createClient();
    await supabase.from("questions").update({ is_active: !current }).eq("id", id);
    setQuestions((qs) => qs.map((q) => q.id === id ? { ...q, is_active: !current } : q));
    toast.success(`Question ${!current ? "activated" : "deactivated"}`);
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split("\n").slice(1); // skip header
    const questions = lines.filter(Boolean).map((line) => {
      const [, subject, topic, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty] = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      return { exam: "NEET", subject, topic, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, is_active: true };
    });

    const supabase = createClient();
    const { error } = await supabase.from("questions").insert(questions);
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return;
    }
    toast.success(`Uploaded ${questions.length} questions!`);
    loadQuestions();
    e.target.value = "";
  }

  if (authorized === null) {
    return <div className="p-8 text-center text-[#64748B]">Checking access...</div>;
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#DC2626] font-semibold text-lg mb-2">Access Denied</p>
          <p className="text-[#64748B] text-sm">You don&apos;t have admin access.</p>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A] transition-all";

  return (
    <div className="min-h-screen bg-[#F8FAFF]">
      <header className="bg-white border-b border-[#E2E8F0] px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <h1 className="font-[family-name:var(--font-fraunces)] text-xl font-bold text-[#1E3A8A]">
            Prepzo Admin
          </h1>
          <Badge variant="error">Admin Panel</Badge>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* Analytics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="flex items-center gap-3">
              <Users size={20} className="text-[#1E3A8A]" />
              <div>
                <p className="text-2xl font-bold font-[family-name:var(--font-dm-mono)] text-[#0F172A]">{analytics.users}</p>
                <p className="text-xs text-[#64748B]">Total users</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <Users size={20} className="text-[#16A34A]" />
              <div>
                <p className="text-2xl font-bold font-[family-name:var(--font-dm-mono)] text-[#0F172A]">{analytics.paid}</p>
                <p className="text-xs text-[#64748B]">Paid subscribers</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <DollarSign size={20} className="text-[#D97706]" />
              <div>
                <p className="text-2xl font-bold font-[family-name:var(--font-dm-mono)] text-[#0F172A]">₹{analytics.revenue}</p>
                <p className="text-xs text-[#64748B]">Total revenue</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["questions", "add"] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab ? "bg-[#1E3A8A] text-white" : "bg-white border border-[#E2E8F0] text-[#64748B]"
              }`}
            >
              {tab === "questions" ? "All Questions" : "Add Question"}
            </button>
          ))}

          {/* CSV Upload */}
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-[#E2E8F0] text-[#64748B] cursor-pointer hover:bg-[#F8FAFF] transition-all">
            <Upload size={14} />
            Bulk CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
          </label>
        </div>

        {/* Questions tab */}
        {activeTab === "questions" && (
          <div>
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadQuestions()}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                />
              </div>
              {["NEET"].map((exam) => (
                <button
                  key={exam}
                  onClick={() => setFilterExam(exam)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filterExam === exam ? "bg-[#1E3A8A] text-white" : "bg-white border border-[#E2E8F0] text-[#64748B]"}`}
                >
                  {exam}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {loading ? (
                <p className="text-[#64748B] text-sm text-center py-8">Loading...</p>
              ) : questions.length === 0 ? (
                <p className="text-[#64748B] text-sm text-center py-8">No questions found.</p>
              ) : (
                questions.map((q) => (
                  <Card key={q.id}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#0F172A] font-medium line-clamp-2 mb-2">{q.question_text}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="primary">{q.exam}</Badge>
                          <Badge variant="muted">{q.subject}</Badge>
                          {q.topic && <Badge variant="muted">{q.topic}</Badge>}
                          {q.difficulty && (
                            <Badge variant={q.difficulty === "Easy" ? "success" : q.difficulty === "Hard" ? "error" : "warning"}>
                              {q.difficulty}
                            </Badge>
                          )}
                          <Badge variant={q.is_active ? "success" : "error"}>
                            {q.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleActive(q.id, q.is_active)}
                        className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-all shrink-0"
                        title={q.is_active ? "Deactivate" : "Activate"}
                      >
                        {q.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* Add Question tab */}
        {activeTab === "add" && (
          <Card>
            <h2 className="font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
              <Plus size={18} className="text-[#1E3A8A]" />
              Add New Question
            </h2>
            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Exam</label>
                  <select value={form.exam} onChange={(e) => setForm({ ...form, exam: e.target.value })} className={inputClass}>
                    <option>NEET</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Subject</label>
                  <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required className={inputClass} placeholder="Physics" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Topic</label>
                  <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className={inputClass} placeholder="Mechanics" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Difficulty</label>
                  <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className={inputClass}>
                    <option>Easy</option><option>Medium</option><option>Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Question</label>
                <textarea value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} required rows={3} className={`${inputClass} resize-none`} placeholder="Enter the question..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {["a", "b", "c", "d"].map((opt) => (
                  <div key={opt}>
                    <label className="block text-xs font-medium text-[#64748B] mb-1">Option {opt.toUpperCase()}</label>
                    <input
                      value={form[`option_${opt}` as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [`option_${opt}`]: e.target.value })}
                      required
                      className={inputClass}
                      placeholder={`Option ${opt.toUpperCase()}`}
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Correct Option</label>
                  <select value={form.correct_option} onChange={(e) => setForm({ ...form, correct_option: e.target.value })} className={inputClass}>
                    <option>A</option><option>B</option><option>C</option><option>D</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Explanation</label>
                <textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2} className={`${inputClass} resize-none`} placeholder="Explain the correct answer..." />
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-[#1E3A8A] text-white font-semibold text-sm hover:bg-[#162D6B] transition-all">
                Add Question
              </button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
