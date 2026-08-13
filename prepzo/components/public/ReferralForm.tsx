"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const roles = [
  "11th class preparing for NEET",
  "12th class preparing for NEET",
  "Dropper",
  "Teacher",
];

const promotionPlaces = [
  "Classmates",
  "Friends",
  "School",
  "Coaching group",
  "WhatsApp",
  "Telegram study group",
  "Instagram",
  "Other social media",
  "YouTube",
  "Others",
];

export function ReferralForm() {
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  function togglePlace(place: string) {
    setSelectedPlaces((current) =>
      current.includes(place)
        ? current.filter((item) => item !== place)
        : [...current, place],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedPlaces.length === 0) {
      setStatus("error");
      setErrorMessage("Select at least one place where you can promote Prepzo.");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.delete("promotion_place");
    selectedPlaces.forEach((place) => formData.append("promotion_place", place));
    formData.set("promotion_places", selectedPlaces.join(", "));

    try {
      const response = await fetch("https://formspree.io/f/mqeorwoe", {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Formspree rejected the submission.");
      }

      setStatus("success");
      form.reset();
      setSelectedPlaces([]);
    } catch {
      setStatus("error");
      setErrorMessage("Could not send the form. Please email collab@prepzo.study.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="_subject" value="Prepzo referral program signup" />
      <input type="hidden" name="source" value="Prepzo referral page" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="name" type="text" required placeholder="Your name" autoComplete="name" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone or WhatsApp">
          <input name="phone" type="tel" required placeholder="WhatsApp number" autoComplete="tel" />
        </Field>
        <Field label="Who are you?">
          <select name="role" required defaultValue="">
            <option value="" disabled>
              Select one
            </option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Where can you promote Prepzo?">
        <div className="referral-bubble-list">
          {promotionPlaces.map((place) => (
            <label key={place} className="referral-bubble-option">
              <input
                name="promotion_place"
                type="checkbox"
                value={place}
                checked={selectedPlaces.includes(place)}
                onChange={() => togglePlace(place)}
              />
              <span>{place}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Anything else we should know?">
        <textarea
          name="message"
          rows={4}
          placeholder="Example: I can share Prepzo with classmates, juniors, study groups, or my coaching circle."
        />
      </Field>

      {status === "success" && (
        <p className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-sm font-semibold text-[#15803D]">
          Referral interest captured. We will reach out with further details.
        </p>
      )}

      {status === "error" && (
        <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-5 text-sm font-bold text-white transition-colors hover:bg-[#162D6B] disabled:opacity-60"
      >
        {status === "submitting" ? "Sending..." : "Sign up for referral access"}
        <CheckCircle2 size={17} />
      </button>

      <p className="text-center text-xs leading-5 text-[#64748B] dark:text-[#CBD5E1]">
        Prefer email? Contact{" "}
        <a href="mailto:collab@prepzo.study" className="font-bold text-[#1E3A8A] hover:text-[#162D6B] dark:text-[#BFDBFE]">
          collab@prepzo.study
        </a>
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#334155] dark:text-[#CBD5E1]">
        {label}
      </span>
      <div className="referral-field">{children}</div>
    </div>
  );
}
