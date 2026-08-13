"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, LogOut, Shield, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CaAccountSection({ userId, initialName }: { userId: string; initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [sendingEmailChange, setSendingEmailChange] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveProfile() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ name }).eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("Something went wrong. Please try again");
      return;
    }
    toast.success("Profile saved");
    router.refresh();
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function submitEmailChange() {
    if (!EMAIL_RE.test(newEmail)) {
      toast.error("Enter a valid email address");
      return;
    }
    setSendingEmailChange(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setSendingEmailChange(false);
    if (error) {
      toast.error(error.message || "Failed to start email change");
      return;
    }
    toast.success(`Confirmation link sent to ${newEmail} — click it to finish the change`);
    setChangingEmail(false);
    setNewEmail("");
  }

  async function handleDeleteAccount() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete account");

      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Account deleted");
      router.push("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete account");
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-5 text-base font-bold text-[#0F172A]">Edit Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#374151]">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#374151]">Target Exam</label>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] px-4 py-3 text-sm font-semibold text-[#0F172A]">
              CA
            </div>
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="rounded-xl bg-[#1E3A8A] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#162D6B] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-bold text-[#0F172A]">Account Actions</h2>
        <div className="space-y-1">
          <button
            onClick={async () => {
              const supabase = createClient();
              const { data: { user } } = await supabase.auth.getUser();
              if (user?.email) {
                await supabase.auth.resetPasswordForEmail(user.email);
                toast.success("Password reset email sent");
              }
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-[#0F172A] transition-all hover:bg-[#F8FAFF]"
          >
            <Shield size={16} className="text-[#64748B]" />
            <span className="flex-1">
              <span className="block">Update Password</span>
              <span className="block text-xs font-normal text-[#64748B]">Change your login password</span>
            </span>
          </button>

          <button
            onClick={() => setChangingEmail((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-[#0F172A] transition-all hover:bg-[#F8FAFF]"
          >
            <Bell size={16} className="text-[#64748B]" />
            <span className="flex-1">
              <span className="block">Change Email</span>
              <span className="block text-xs font-normal text-[#64748B]">Update your email address</span>
            </span>
          </button>
          {changingEmail && (
            <div className="ml-4 flex gap-2 rounded-xl bg-[#F8FAFF] p-3">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="New email address"
                className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm focus:border-[#1E3A8A] focus:outline-none"
              />
              <button
                onClick={submitEmailChange}
                disabled={sendingEmailChange || !newEmail.trim()}
                className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-[#162D6B] disabled:opacity-50"
              >
                {sendingEmailChange ? "Sending..." : "Send link"}
              </button>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-bold text-[#0F172A]">Session</h2>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-[#64748B] transition-all hover:bg-[#FEE2E2] hover:text-[#DC2626]"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </Card>

      <Card className="border-[#FECACA]">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#DC2626]" />
          <div>
            <h2 className="text-base font-bold text-[#DC2626]">Delete Account</h2>
            <p className="mt-1 text-xs text-[#64748B]">
              This immediately and permanently deletes your account and all your data. This cannot be undone.
            </p>
          </div>
        </div>
        {deleteConfirm && (
          <div className="mb-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#DC2626]">
            Are you sure? Tap again to permanently delete your account.
          </div>
        )}
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="flex items-center gap-2 rounded-xl border-2 border-[#DC2626] px-5 py-2.5 text-sm font-semibold text-[#DC2626] transition-all hover:bg-[#FEF2F2] disabled:opacity-60"
        >
          <Trash2 size={14} />
          {deleting ? "Deleting..." : deleteConfirm ? "Confirm Delete" : "Delete Account"}
        </button>
      </Card>
    </div>
  );
}
