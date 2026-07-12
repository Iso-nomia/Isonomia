// components/citations/CitePickerInlinePro.tsx
"use client";

import * as React from "react";
import LibrarySearchModal from "@/components/citations/LibrarySearchModal";
import { IntentSelector, CitationIntentType } from "@/components/citations/IntentSelector";

/** Resolve/create a Source row */
async function resolveSource(payload: any) {
  const r = await fetch("/api/citations/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json();
  if (!r.ok || j.error || !j.source?.id) throw new Error(j.error || "Resolve failed");
  return j.source as { id: string };
}

/** Attach a Source to a target (comment/claim/argument/card/move) */
async function attachCitation(args: {
  targetType: string;
  targetId: string;
  sourceId: string;
  locator?: string;
  quote?: string;
  note?: string;
  relevance?: number;
  // Phase 2.1: Anchor fields
  anchorType?: string;
  anchorId?: string;
  anchorData?: Record<string, unknown>;
  // Phase 2.3: Citation intent
  intent?: CitationIntentType | null;
}) {
  const r = await fetch("/api/citations/attach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || "Attach failed");
  return j.citation;
}

type Props = {
  targetType: "comment" | "claim" | "argument" | "card" | "move" | "work" | "proposition";
  targetId: string;
  onDone?: () => void;

  /** Optional prefill (e.g., from PDF selection overlay) */
  initialUrl?: string;
  initialDOI?: string;
  initialLocator?: string;
  initialQuote?: string;
  initialNote?: string;

  /** Phase 2.1: Anchor data for executable citations */
  anchorType?: "annotation" | "text_range" | "timestamp" | "page" | "coordinates";
  anchorId?: string;
  anchorData?: Record<string, unknown>;

  /** Phase 2.3: Optional initial intent */
  initialIntent?: CitationIntentType | null;
};

export default function CitePickerInlinePro({
  targetType,
  targetId,
  onDone,
  initialUrl,
  initialDOI,
  initialLocator,
  initialQuote,
  initialNote,
  anchorType,
  anchorId,
  anchorData,
  initialIntent,
}: Props) {
  const [tab, setTab] = React.useState<"url" | "doi" | "library">(
    initialDOI ? "doi" : initialUrl ? "url" : "library"
  );

  // URL tab
  const [url, setUrl] = React.useState(initialUrl ?? "");
  // DOI tab
  const [doi, setDoi] = React.useState(initialDOI ?? "");
  // Library tab
  const [libraryId, setLibraryId] = React.useState(""); // LibraryPost.id (set by modal)
  const [libraryTitle, setLibraryTitle] = React.useState<string | undefined>(undefined);

  // Common fields
  const [locator, setLocator] = React.useState(initialLocator ?? "");
  const [quote, setQuote] = React.useState(initialQuote ?? "");
  const [note, setNote] = React.useState(initialNote ?? "");

  // Phase 2.3: Citation intent (optional)
  const [intent, setIntent] = React.useState<CitationIntentType | null>(initialIntent ?? null);

  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [libOpen, setLibOpen] = React.useState(false);

  async function doAttach() {
    setBusy(true);
    setErr(null);
    try {
      let sourceId: string | null = null;

      if (tab === "url") {
        const v = url.trim();
        if (!v) throw new Error("Add a URL");
        const s = await resolveSource({ url: v });
        sourceId = s.id;
      } else if (tab === "doi") {
        const v = doi.trim();
        if (!v) throw new Error("Add a DOI");
        const s = await resolveSource({ doi: v });
        sourceId = s.id;
      } else {
        const id = libraryId.trim();
        if (!id) throw new Error("Pick a library item");
        const s = await resolveSource({ libraryPostId: id, meta: { title: libraryTitle } });
        sourceId = s.id;
      }

      await attachCitation({
        targetType,
        targetId,
        sourceId,
        locator: locator || undefined,
        quote: quote || undefined,
        note: note || undefined,
        // Phase 2.1: Pass anchor data
        anchorType: anchorType || undefined,
        anchorId: anchorId || undefined,
        anchorData: anchorData || undefined,
        // Phase 2.3: Pass intent
        intent: intent || undefined,
      });

      // fan-out to live listeners (optional; SSE also covers this when your route emits)
      try {
        window.dispatchEvent(new CustomEvent("citations:changed", { detail: { targetType, targetId } }));
      } catch {}

      onDone?.();
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border rounded-xl px-3 bg-white/70 w-full max-w-[680px] py-3">
      {/* Tabs */}
      <div className="flex gap-2 mb-2">
        {(["url", "doi", "library"] as const).map((t) => (
          <button
            key={t}
            className={`text-[11px] px-2 py-1 rounded border ${tab === t ? "bg-slate-300" : "bg-white"}`}
            onClick={() => setTab(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab bodies */}
      {tab === "url" && (
        <div className="mb-2 flex items-center gap-2">
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          {!!url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] underline text-slate-600"
              title="Open link"
            >
              Open
            </a>
          )}
        </div>
      )}

      {tab === "doi" && (
        <div className="mb-2 flex items-center gap-2">
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="10.xxxx/xxxxxxx"
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
          />
          {!!doi && (
            <a
              href={`https://doi.org/${doi}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] underline text-slate-600"
              title="Open DOI"
            >
              Open
            </a>
          )}
        </div>
      )}

      {tab === "library" && (
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 border rounded px-2 py-1 text-sm"
              placeholder="LibraryPost ID (or browse)"
              value={libraryId}
              onChange={(e) => setLibraryId(e.target.value)}
            />
            <LibrarySearchModal
              open={libOpen}
              onOpenChange={setLibOpen}
              onPick={(id, item) => {
                setLibraryId(id);
                // Store title from the selected item for display
                setLibraryTitle(item?.title || item?.linkUrl || item?.file_url || undefined);
              }}
              trigger={
                <button
                  type="button"
                  className="px-2 py-1 text-[11px] rounded border bg-white/80"
                  onClick={() => setLibOpen(true)}
                >
                  Browse…
                </button>
              }
            />
          </div>
          {!!libraryId && (
            <div className="mt-1 text-[11px] text-slate-600 truncate">
              Selected: {libraryTitle || libraryId}
            </div>
          )}
        </div>
      )}

      {/* Common fields */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          className="border rounded px-2 py-1 text-sm"
          placeholder="Locator (p. 13, 08:14, fig. 2)"
          value={locator}
          onChange={(e) => setLocator(e.target.value)}
        />
        <input
          className="border rounded px-2 py-1 text-sm"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <textarea
        className="w-full border rounded px-2 py-1 text-sm commentfield"
        rows={2}
        placeholder="Quote (optional, <280 chars)"
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
      />

      {/* Phase 2.3: Intent selector */}
      <div className="mt-0">
        {/* <label className="text-[11px] text-slate-500 mb-1 block">
         Add note
        </label> */}
        <IntentSelector
          value={intent}
          onChange={setIntent}
          compact
          clearable
        />
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          className="text-xs px-3 py-1.5 rounded-lg btnv2--ghost bg-emerald-600 text-white disabled:opacity-50"
          onClick={doAttach}
          disabled={busy}
          title="Attach citation to the current target"
        >
          {busy ? "Attaching…" : "Attach citation"}
        </button>
        {err && <div className="text-[11px] text-rose-600">{err}</div>}
      </div>
    </div>
  );
}
