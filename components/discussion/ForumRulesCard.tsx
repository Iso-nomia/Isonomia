// components/discussion/ForumRulesCard.tsx
"use client";
import * as React from "react";

export default function ForumRulesCard({
  title = "Forum rules",
  updated = null,
  rules = [
    "Be civil; attack ideas, not people.",
    "Stay on topic; start a new thread when needed.",
    "Share sources where possible.",
    "No spam, harassment, or doxxing.",
  ],
  links = [
    { label: "Guidelines", href: "/guidelines" },
    { label: "Code of Conduct", href: "/coc" },
  ],
}: {
  title?: string;
  updated?: string | null; // ISO or free text
  rules?: string[];
  links?: { label: string; href: string }[];
}) {
  return (
    <aside className="rounded border bg-white/80 p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        {updated && <div className="text-[11px] text-slate-500">Updated {updated}</div>}
      </div>
      <ol className="mt-2 list-decimal pl-5 space-y-1 text-[13px]">
        {rules.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ol>
      {links?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map((l) => (
            <a key={l.href} className="text-[12px] underline" href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
