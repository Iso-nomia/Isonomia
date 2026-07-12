"use client";

// From-scratch deliberation create surface
// (docs/DELIBERATION_CREATION_DEV_SPEC.md §4.3).
//
// Fields: name (editable), visibility (public/unlisted/private), moderators
// (user search → `moderatorIds`), optional tags.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ModeratorPicker, { type PickedUser } from "@/components/forms/ModeratorPicker";

const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: "public" | "unlisted" | "private";
  label: string;
  hint: string;
}> = [
  { value: "public", label: "Public", hint: "Listed and world-readable — surfaced in the Agora." },
  { value: "unlisted", label: "Unlisted", hint: "Link-only — not surfaced in feeds." },
  { value: "private", label: "Private", hint: "Restricted to you and assigned moderators." },
];

export default function CreateDeliberation() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [visibility, setVisibility] =
    React.useState<"public" | "unlisted" | "private">("public");
  const [moderators, setModerators] = React.useState<PickedUser[]>([]);
  const [tagsRaw, setTagsRaw] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch("/api/deliberations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          visibility,
          moderatorIds: moderators.map((m) => m.id),
          tags,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ? "Could not create deliberation." : "Request failed.");
      }
      const data = await res.json();
      router.push(data.redirect ?? `/deliberation/${data.id}`);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-2xl flex-col cardv2 gap-6 p-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="delib-title" className="text-[18px] tracking-wider font-semibold text-dark-2">
          Title
        </label>
        <Input
          id="delib-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is this deliberation about?"
          maxLength={200}
          className="articlesearchfield py-2 px-3 text-[16px] border border-indigo-200 placeholder:text-dark-1 text-dark-2 "
          autoFocus
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[18px] mb-2 tracking-wider font-semibold text-dark-2">Visibility</legend>
        <div className="flex flex-col gap-2">
          {VISIBILITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 hover:border-slate-500"
            >
              <input
                type="radio"
                name="visibility"
                value={opt.value}
                checked={visibility === opt.value}
                onChange={() => setVisibility(opt.value)}
                className="mt-1"
              />
              <span className="flex flex-col">
                <span className="text-[16px] p-1 font-medium text-dark-2">{opt.label}</span>
                <span className="text-[14px] p-1 text-gray-500">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label className="text-[18px] tracking-wider font-semibold text-dark-2">
          Moderators <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <ModeratorPicker value={moderators} onChange={setModerators} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="delib-tags" className="text-[18px] tracking-wider font-semibold placeholder:text-dark-1 text-dark-2">
          Tags <span className="font-normal text-gray-500">(optional, comma-separated)</span>
        </label>
        <Input
          id="delib-tags"
          type="text"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="ethics, policy, methodology"
          className="articlesearchfield py-2 px-3 text-[16px] border border-indigo-200 placeholder:text-dark-1 text-dark-2 "
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex rounded-full w-fit justify-center items-center px-4 py-3 btnv2 text-[18px] text-dark-2 font-medium tracking-wide bg-white  disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create deliberation"}
      </button>
    </form>
  );
}
