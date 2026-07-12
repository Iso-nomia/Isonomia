"use client";

/**
 * SourcePicker
 *
 * Used in the capture and edit flows when an entry's genre is EXCERPT.
 * Lets the writer pick an existing source (typeahead by title or
 * author), or create a new one inline (title + optional author + year).
 * Always paired with a free-form `locator` field — the per-entry
 * pointer ("p. 47", "§12.3", "prologue").
 *
 * Visual register: same as the rest of the capture chrome — sans
 * labels, stone-300 borders, no decoration. The picker is a quiet
 * affordance, never a wizard.
 */

import { useEffect, useMemo, useState } from "react";

export type SourceSummary = {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
};

type Props = {
  // Currently-selected source id, or null for none.
  sourceId: string | null;
  onSourceChange: (sourceId: string | null) => void;
  // Per-excerpt locator, free-form.
  locator: string;
  onLocatorChange: (locator: string) => void;
};

export default function SourcePicker({
  sourceId,
  onSourceChange,
  locator,
  onLocatorChange,
}: Props) {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  // New-source draft fields.
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAuthor, setDraftAuthor] = useState("");
  const [draftYear, setDraftYear] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Load sources once on mount.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sources")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.sources)) setSources(data.sources);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => sources.find((s) => s.id === sourceId) ?? null,
    [sources, sourceId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sources.slice(0, 10);
    return sources
      .filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.author ?? "").toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [query, sources]);

  async function handleCreate() {
    const title = draftTitle.trim();
    if (!title) return;
    setCreateError(null);
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author: draftAuthor.trim() || null,
          year: draftYear.trim() ? Number(draftYear.trim()) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "create_failed");
      }
      const data = await res.json();
      const created: SourceSummary = data.source;
      setSources((prev) => [created, ...prev]);
      onSourceChange(created.id);
      setCreating(false);
      setDraftTitle("");
      setDraftAuthor("");
      setDraftYear("");
      setQuery("");
    } catch (e) {
      setCreateError((e as Error).message);
    }
  }

  // Selected-source rendering.
  if (selected) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-stone-700">Source</label>
        <div className="flex items-baseline justify-between gap-3 rounded border border-stone-200 bg-stone-50 px-3 py-2">
          <span className="text-sm text-stone-800">
            <span className="italic">{selected.title}</span>
            {selected.author && (
              <span className="text-stone-600"> — {selected.author}</span>
            )}
            {selected.year && (
              <span className="text-stone-500"> ({selected.year})</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => onSourceChange(null)}
            className="text-xs text-stone-500 hover:text-stone-900 hover:underline"
          >
            change
          </button>
        </div>
        <div>
          <label className="block text-xs text-stone-500">
            Locator <span className="text-stone-400">(optional)</span>
          </label>
          <input
            type="text"
            value={locator}
            onChange={(e) => onLocatorChange(e.target.value)}
            placeholder="p. 47 · §12.3 · prologue · l. 1145"
            className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
        </div>
      </div>
    );
  }

  // Empty / picking state.
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-stone-700">Source</label>

      {!creating && (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or author…"
            className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
          {filtered.length > 0 && (
            <ul className="space-y-1 border border-stone-200 bg-white">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSourceChange(s.id)}
                    className="block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
                  >
                    <span className="italic">{s.title}</span>
                    {s.author && (
                      <span className="text-stone-500"> — {s.author}</span>
                    )}
                    {s.year && (
                      <span className="text-stone-400"> ({s.year})</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setDraftTitle(query);
            }}
            className="text-xs text-stone-600 hover:text-stone-900 hover:underline"
          >
            + add a source not in the list
          </button>
        </>
      )}

      {creating && (
        <div className="space-y-2 rounded border border-stone-200 bg-stone-50 p-3">
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            autoFocus
          />
          <input
            type="text"
            value={draftAuthor}
            onChange={(e) => setDraftAuthor(e.target.value)}
            placeholder="Author (optional)"
            className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
          <input
            type="text"
            inputMode="numeric"
            value={draftYear}
            onChange={(e) => setDraftYear(e.target.value)}
            placeholder="Year (optional)"
            className="w-32 rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!draftTitle.trim()}
              className="rounded bg-stone-900 px-3 py-1 text-xs text-stone-50 disabled:opacity-50"
            >
              Add source
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setCreateError(null);
              }}
              className="text-xs text-stone-500 hover:text-stone-900 hover:underline"
            >
              cancel
            </button>
            {createError && (
              <span className="text-xs text-rose-700">Error: {createError}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
