"use client";

/**
 * Connections — cross-references between entries.
 *
 * Client component used on the entry detail page. Responsibilities:
 *  - fetch outgoing + incoming links for the current entry
 *  - render them as typographic rows (one line each)
 *  - offer an inline picker for adding a new connection
 *  - allow removing outgoing links the author has created
 *
 * The visual register mirrors the rest of the chrome: sans labels,
 * stone palette, no decoration. Connections are *quiet annotations*
 * on the body — never the body itself.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Genre =
  | "FRAGMENT"
  | "EXCERPT"
  | "OBSERVATION"
  | "MEDITATION"
  | "DIALOGUE"
  | "LETTER"
  | "LIST"
  | "POEM";

type LinkType =
  | "REFERENCE"
  | "DEVELOPS"
  | "RESPONDS_TO"
  | "CONTRADICTS"
  | "SHARED_SOURCE";

const LINK_TYPES: LinkType[] = [
  "REFERENCE",
  "DEVELOPS",
  "RESPONDS_TO",
  "CONTRADICTS",
  "SHARED_SOURCE",
];

// Verb forms ("X develops Y", "X responds to Y") read better than the
// SCREAMING_SNAKE enum values when shown next to body text.
const TYPE_VERB: Record<LinkType, string> = {
  REFERENCE: "references",
  DEVELOPS: "develops",
  RESPONDS_TO: "responds to",
  CONTRADICTS: "contradicts",
  SHARED_SOURCE: "shares a source with",
};

const TYPE_VERB_PASSIVE: Record<LinkType, string> = {
  REFERENCE: "referenced by",
  DEVELOPS: "developed by",
  RESPONDS_TO: "answered by",
  CONTRADICTS: "contradicted by",
  SHARED_SOURCE: "shares a source with",
};

type EntrySummary = {
  id: string;
  genre: Genre;
  plainText: string | null;
  createdAt: string;
  thread: { id: string; name: string | null } | null;
};

type OutgoingLink = {
  id: string;
  type: LinkType;
  note: string | null;
  createdAt: string;
  to: EntrySummary;
};

type IncomingLink = {
  id: string;
  type: LinkType;
  note: string | null;
  createdAt: string;
  from: EntrySummary;
};

type Props = {
  entryId: string;
};

function snippet(text: string | null, max = 120): string {
  if (!text) return "(empty)";
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

export default function Connections({ entryId }: Props) {
  const [outgoing, setOutgoing] = useState<OutgoingLink[]>([]);
  const [incoming, setIncoming] = useState<IncomingLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);

  // Picker state.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntrySummary[]>([]);
  const [selected, setSelected] = useState<EntrySummary | null>(null);
  const [type, setType] = useState<LinkType>("REFERENCE");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch of existing links.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entries/${entryId}/links`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setOutgoing(Array.isArray(data.outgoing) ? data.outgoing : []);
        setIncoming(Array.isArray(data.incoming) ? data.incoming : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  // Search-as-you-type for the picker. Excludes the current entry and
  // any already-linked outgoing targets so the writer only sees fresh
  // candidates.
  useEffect(() => {
    const q = query.trim();
    if (!adding || selected || q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const taken = new Set([entryId, ...outgoing.map((l) => l.to.id)]);
          setResults(
            (data.entries as EntrySummary[]).filter((e) => !taken.has(e.id)),
          );
        })
        .catch(() => {});
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, adding, selected, entryId, outgoing]);

  async function handleSubmit() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/entries/${entryId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toId: selected.id,
          type,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "save_failed");
      }
      const data = await res.json();
      setOutgoing((prev) => [data.link, ...prev]);
      // Reset.
      setSelected(null);
      setQuery("");
      setNote("");
      setType("REFERENCE");
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(linkId: string) {
    const prev = outgoing;
    setOutgoing((cur) => cur.filter((l) => l.id !== linkId));
    try {
      const res = await fetch(`/api/entries/${entryId}/links/${linkId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete_failed");
    } catch {
      // Roll back on failure so the UI doesn't lie about state.
      setOutgoing(prev);
    }
  }

  const empty = useMemo(
    () => loaded && outgoing.length === 0 && incoming.length === 0 && !adding,
    [loaded, outgoing, incoming, adding],
  );

  return (
    <section className="border-t border-stone-200 pt-6 space-y-4 font-sans">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-stone-700">Connections</h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-stone-500 hover:text-stone-900 hover:underline"
          >
            + add a connection
          </button>
        )}
      </div>

      {empty && (
        <p className="text-xs text-stone-400">
          No connections yet. An entry stands alone until you draw a thread.
        </p>
      )}

      {(outgoing.length > 0 || incoming.length > 0) && (
        <ul className="space-y-2 text-sm">
          {outgoing.map((l) => (
            <li key={l.id} className="flex items-baseline gap-2">
              <span className="text-stone-500">
                {TYPE_VERB[l.type]}
              </span>
              <Link
                href={`/entry/${l.to.id}`}
                className="text-stone-800 hover:underline"
              >
                {snippet(l.to.plainText, 90)}
              </Link>
              {l.note && (
                <span className="text-xs text-stone-500">— {l.note}</span>
              )}
              <button
                type="button"
                onClick={() => handleDelete(l.id)}
                className="ml-auto text-xs text-stone-400 hover:text-rose-700"
                title="Remove connection"
              >
                ×
              </button>
            </li>
          ))}
          {incoming.map((l) => (
            <li key={l.id} className="flex items-baseline gap-2">
              <span className="text-stone-500">
                {TYPE_VERB_PASSIVE[l.type]}
              </span>
              <Link
                href={`/entry/${l.from.id}`}
                className="text-stone-800 hover:underline"
              >
                {snippet(l.from.plainText, 90)}
              </Link>
              {l.note && (
                <span className="text-xs text-stone-500">— {l.note}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="space-y-3 rounded border border-stone-200 bg-stone-50 p-3">
          {!selected ? (
            <>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find an entry by its words…"
                className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
                autoFocus
              />
              {results.length > 0 && (
                <ul className="space-y-1 border border-stone-200 bg-white">
                  {results.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(e)}
                        className="block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
                      >
                        <span className="text-xs uppercase tracking-wide text-stone-400">
                          {e.genre.toLowerCase()}
                        </span>
                        <span className="ml-2 text-stone-700">
                          {snippet(e.plainText, 80)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-stone-700">
                  <span className="text-xs uppercase tracking-wide text-stone-400 mr-2">
                    {selected.genre.toLowerCase()}
                  </span>
                  {snippet(selected.plainText, 100)}
                </p>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs text-stone-500 hover:text-stone-900 hover:underline"
                >
                  change
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-stone-500">Relation</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as LinkType)}
                  className="rounded border border-stone-300 bg-white px-2 py-1 text-sm"
                >
                  {LINK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_VERB[t]}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional — why this connection?)"
                className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
            </>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selected || submitting}
              className="rounded bg-stone-900 px-3 py-1 text-xs text-stone-50 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Connect"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setSelected(null);
                setQuery("");
                setNote("");
                setError(null);
              }}
              className="text-xs text-stone-500 hover:text-stone-900 hover:underline"
            >
              cancel
            </button>
            {error && (
              <span className="text-xs text-rose-700">
                Error: {error === "duplicate_link" ? "already connected" : error}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
