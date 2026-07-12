"use client";
import React from "react";

type Quote = {
  sourceMessageId: string;
  sourceFacetId?: string | null;
  status: "ok" | "redacted" | "unavailable";
  body?: unknown | string | null;
  attachments?: Array<{ id: string; name?: string; mime: string; size: number; sha256?: string; path?: string | null }>;
  isEdited?: boolean;
  sourceAuthor?: { name: string | null; image: string | null } | null;
  updatedAt?: string | null;
};

function textFromTipTap(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textFromTipTap).join("");
  if (typeof node === "object") {
    // TipTap nodes: { type, text?, content? }
    if (node.text) return String(node.text);
    if (Array.isArray(node.content)) return node.content.map(textFromTipTap).join("");
    return textFromTipTap(node.content);
  }
  return "";
}

function toSnippet(raw: string, max = 240) {
  const s = raw.replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function QuoteBlock({
  q,
  compact = true,
}: {
  q: Quote;
  compact?: boolean;
}) {
  if (q.status === "redacted")
    return <div className="rounded-md border bg-slate-50/70 px-2 py-1.5 text-slate-500 italic">(redacted)</div>;
  if (q.status === "unavailable")
    return <div className="rounded-md border bg-slate-50/70 px-2 py-1.5 text-slate-500 italic">(unavailable)</div>;

  // Normalize body to text
  const textRaw =
    typeof q.body === "string"
      ? q.body
      : q.body
      ? textFromTipTap(q.body)
      : "";
  const snippet = toSnippet(textRaw || "");

  const handleJump = () => {
    const el = document.querySelector(`[data-msg-id="${q.sourceMessageId}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-white/10", "rounded-xl", "shadow-xl");
    setTimeout(() => el.classList.remove("bg-white/10", "rounded-xl", "shadow-xl"), 1200);
  };

  return (
    <button
      type="button"
      onClick={handleJump}
      className="group text-left inline-block max-w-full"
      title="Jump to quoted message"
    >
     <div className="rounded-md bg-white/50 px-4 py-1 likebutton max-w-full">
        {/* Header: author + (edited) if not using the outer label */}
        {!compact && (q.sourceAuthor?.name || q.isEdited) && (
          <div className="text-[11px] text-slate-500 mb-0.5">
            {q.sourceAuthor?.name ?? "Quoted message"}
            {q.isEdited ? <span className="ml-1 italic">(edited)</span> : null}
          </div>
        )}

        {/* Body text */}
        <div className="text-[13px] leading-snug whitespace-pre-wrap break-words text-slate-800 max-w-full">
          {snippet || <span className="text-slate-500 italic">(no text)</span>}
        </div>

        {/* Attachments hint */}
        {Array.isArray(q.attachments) && q.attachments.length > 0 && (
          <div className="mt-1 text-[11px] text-slate-500">
            {q.attachments.length} attachment{q.attachments.length === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </button>
  );
}
