"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ArtifactBlock, ArtifactBody } from "../../../lib/artifact-types";

type EntrySummary = {
  id: string;
  genre: string;
  plainText: string;
  createdAt: string;
};

type Props = {
  artifactId: string;
  initialTitle: string;
  initialSubtitle: string | null;
  initialBody: ArtifactBody;
  initialEntries: EntrySummary[];
  publishedAt: string | null;
};

const SAVE_DEBOUNCE_MS = 800;

export default function ArtifactEditor({
  artifactId,
  initialTitle,
  initialSubtitle,
  initialBody,
  initialEntries,
  publishedAt: initialPublishedAt,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle ?? "");
  const [blocks, setBlocks] = useState<ArtifactBlock[]>(initialBody.blocks);
  const [entryCache, setEntryCache] = useState<Map<string, EntrySummary>>(
    () => new Map(initialEntries.map((e) => [e.id, e])),
  );
  const [publishedAt, setPublishedAt] = useState<string | null>(
    initialPublishedAt,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [pendingDelete, setPendingDelete] = useState(false);

  // Debounced autosave on title / subtitle / blocks.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  const persist = async () => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/artifacts/${artifactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Untitled",
          subtitle: subtitle.trim() || null,
          body: { blocks },
        }),
      });
      if (!res.ok) {
        setSaveState("error");
        return;
      }
      setSaveState("saved");
      dirtyRef.current = false;
    } catch {
      setSaveState("error");
    }
  };

  useEffect(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      return; // skip the initial mount-driven effect
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, blocks]);

  // ─── Block mutations ──────────────────────────────────

  const addEntry = (entry: EntrySummary) => {
    setEntryCache((prev) => {
      const next = new Map(prev);
      next.set(entry.id, entry);
      return next;
    });
    setBlocks((prev) => [
      ...prev,
      { kind: "entry", entryId: entry.id, includeProvenance: true },
    ]);
    setPickerOpen(false);
  };

  const addProse = () =>
    setBlocks((prev) => [...prev, { kind: "prose", text: "" }]);

  const addHeading = () =>
    setBlocks((prev) => [...prev, { kind: "heading", text: "", level: 2 }]);

  const updateBlock = (i: number, patch: Partial<ArtifactBlock>) => {
    setBlocks((prev) =>
      prev.map((b, idx) =>
        idx === i ? ({ ...b, ...patch } as ArtifactBlock) : b,
      ),
    );
  };

  const moveBlock = (i: number, dir: -1 | 1) => {
    setBlocks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const removeBlock = (i: number) =>
    setBlocks((prev) => prev.filter((_, idx) => idx !== i));

  // ─── Publish / unpublish / delete ─────────────────────

  const togglePublish = async () => {
    const action = publishedAt ? { unpublish: true } : { publish: true };
    const res = await fetch(`/api/artifacts/${artifactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    if (res.ok) {
      const data = await res.json();
      setPublishedAt(data.artifact.publishedAt ?? null);
    }
  };

  const deleteArtifact = async () => {
    if (!pendingDelete) {
      setPendingDelete(true);
      setTimeout(() => setPendingDelete(false), 4000);
      return;
    }
    const res = await fetch(`/api/artifacts/${artifactId}`, {
      method: "DELETE",
    });
    if (res.ok) router.push("/compose");
  };

  // ─── Render ───────────────────────────────────────────

  const wordCount = useMemo(() => {
    let total = 0;
    for (const b of blocks) {
      if (b.kind === "prose" || b.kind === "heading") {
        total += b.text.trim().split(/\s+/).filter(Boolean).length;
      } else {
        const e = entryCache.get(b.entryId);
        if (e)
          total += e.plainText.trim().split(/\s+/).filter(Boolean).length;
      }
    }
    return total;
  }, [blocks, entryCache]);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between font-sans text-xs text-stone-500">
        <Link href="/compose" className="hover:text-stone-900">
          ← All artifacts
        </Link>
        <span>
          {saveState === "saving" && "saving…"}
          {saveState === "saved" && "saved"}
          {saveState === "error" && (
            <span className="text-rose-700">save failed</span>
          )}
        </span>
      </div>

      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full border-none bg-transparent font-display text-3xl text-stone-900 placeholder:text-stone-300 focus:outline-none"
        />
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Subtitle (optional)"
          className="w-full border-none bg-transparent font-serif italic text-base text-stone-600 placeholder:text-stone-300 focus:outline-none"
        />
      </div>

      {/* Blocks */}
      <div className="space-y-4">
        {blocks.length === 0 && (
          <p className="font-serif italic text-stone-500">
            An empty page. Add an entry, a heading, or a paragraph below.
          </p>
        )}
        {blocks.map((block, i) => (
          <BlockRow
            key={i}
            index={i}
            total={blocks.length}
            block={block}
            entry={
              block.kind === "entry"
                ? entryCache.get(block.entryId) ?? null
                : null
            }
            onUpdate={(patch) => updateBlock(i, patch)}
            onMove={(dir) => moveBlock(i, dir)}
            onRemove={() => removeBlock(i)}
          />
        ))}
      </div>

      {/* Insert toolbar */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-stone-200 pt-4 font-sans text-sm text-stone-600">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="hover:text-stone-900"
        >
          + Entry
        </button>
        <button
          type="button"
          onClick={addProse}
          className="hover:text-stone-900"
        >
          + Prose
        </button>
        <button
          type="button"
          onClick={addHeading}
          className="hover:text-stone-900"
        >
          + Heading
        </button>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-200 pt-4 font-sans text-xs text-stone-500">
        <span>
          {blocks.length} {blocks.length === 1 ? "block" : "blocks"} ·{" "}
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <span>·</span>
        <Link
          href={`/artifact/${artifactId}`}
          className="hover:text-stone-900"
        >
          View
        </Link>
        <span>·</span>
        <a
          href={`/api/artifacts/${artifactId}/export.md`}
          className="hover:text-stone-900"
        >
          Export Markdown
        </a>
        <span>·</span>
        <button
          type="button"
          onClick={togglePublish}
          className="text-amber-700 hover:underline"
        >
          {publishedAt ? "Unpublish" : "Publish"}
        </button>
        {publishedAt && (
          <span className="font-serif italic text-stone-500">
            published {publishedAt.slice(0, 10)}
          </span>
        )}
        <span className="ml-auto">
          <button
            type="button"
            onClick={deleteArtifact}
            className={
              pendingDelete
                ? "text-rose-700 hover:underline"
                : "text-stone-400 hover:text-rose-700"
            }
          >
            {pendingDelete ? "Click again to delete" : "Delete"}
          </button>
        </span>
      </div>

      {pickerOpen && (
        <EntryPicker
          onPick={addEntry}
          onClose={() => setPickerOpen(false)}
          excludeIds={new Set(
            blocks
              .filter(
                (b): b is Extract<ArtifactBlock, { kind: "entry" }> =>
                  b.kind === "entry",
              )
              .map((b) => b.entryId),
          )}
        />
      )}
    </div>
  );
}

// ─── Block row ──────────────────────────────────────────

function BlockRow({
  index,
  total,
  block,
  entry,
  onUpdate,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  block: ArtifactBlock;
  entry: EntrySummary | null;
  onUpdate: (patch: Partial<ArtifactBlock>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative rounded border border-transparent px-3 py-2 hover:border-stone-200">
      {/* Block content */}
      {block.kind === "heading" && (
        <div className="flex items-baseline gap-3">
          <select
            value={block.level}
            onChange={(e) =>
              onUpdate({ level: Number(e.target.value) as 1 | 2 | 3 })
            }
            className="bg-transparent font-sans text-xs text-stone-500 focus:outline-none"
          >
            <option value={1}>H1</option>
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <input
            value={block.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Heading"
            className={
              "flex-1 border-none bg-transparent placeholder:text-stone-300 focus:outline-none " +
              (block.level === 1
                ? "font-display text-2xl text-stone-900"
                : block.level === 2
                  ? "font-serif text-xl text-stone-900"
                  : "font-serif text-lg text-stone-800")
            }
          />
        </div>
      )}

      {block.kind === "prose" && (
        <textarea
          value={block.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder="Write a paragraph…"
          rows={Math.max(2, block.text.split("\n").length)}
          className="w-full resize-none border-none bg-transparent font-serif text-base leading-relaxed text-stone-800 placeholder:text-stone-300 focus:outline-none"
        />
      )}

      {block.kind === "entry" && (
        <div className="space-y-1">
          {entry ? (
            <>
              <div className="font-sans text-xs uppercase tracking-wide text-stone-400">
                {entry.genre.toLowerCase()} ·{" "}
                {entry.createdAt.slice(0, 10)}
              </div>
              <blockquote className="border-l-2 border-stone-300 pl-3 font-serif text-base leading-relaxed text-stone-700">
                {entry.plainText.trim() || "(empty)"}
              </blockquote>
              <label className="flex items-center gap-2 font-sans text-xs text-stone-500">
                <input
                  type="checkbox"
                  checked={block.includeProvenance}
                  onChange={(e) =>
                    onUpdate({ includeProvenance: e.target.checked })
                  }
                />
                Include provenance line on export
              </label>
            </>
          ) : (
            <div className="font-serif italic text-stone-500">
              (entry no longer available)
            </div>
          )}
        </div>
      )}

      {/* Row controls — appear on hover */}
      <div className="absolute right-2 top-2 hidden gap-2 font-sans text-xs text-stone-400 group-hover:flex">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          className="hover:text-stone-700 disabled:opacity-30"
          aria-label="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          className="hover:text-stone-700 disabled:opacity-30"
          aria-label="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="hover:text-rose-700"
          aria-label="Remove"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ─── Entry picker ───────────────────────────────────────

function EntryPicker({
  onPick,
  onClose,
  excludeIds,
}: {
  onPick: (entry: EntrySummary) => void;
  onClose: () => void;
  excludeIds: Set<string>;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<EntrySummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const url = q.trim()
          ? `/api/search?q=${encodeURIComponent(q.trim())}&limit=30`
          : "/api/entries?limit=30";
        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) setResults([]);
          return;
        }
        const data = await res.json();
        const list: EntrySummary[] = (data.entries ?? data.results ?? []).map(
          (e: {
            id: string;
            genre: string;
            plainText?: string;
            snippet?: string;
            createdAt: string;
          }) => ({
            id: e.id,
            genre: e.genre,
            plainText: e.plainText ?? e.snippet ?? "",
            createdAt:
              typeof e.createdAt === "string"
                ? e.createdAt
                : new Date(e.createdAt).toISOString(),
          }),
        );
        if (!cancelled) setResults(list);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/30 px-4 py-16"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl space-y-3 rounded border border-stone-300 bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h3 className="font-sans text-sm text-stone-900">Insert an entry</h3>
          <button
            type="button"
            onClick={onClose}
            className="font-sans text-xs text-stone-500 hover:text-stone-900"
          >
            Cancel
          </button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your archive…"
          className="w-full border border-stone-300 px-2 py-1 font-serif text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
        />
        <div className="max-h-96 space-y-2 overflow-auto">
          {loading && (
            <p className="font-sans text-xs text-stone-400">Searching…</p>
          )}
          {!loading && results.length === 0 && (
            <p className="font-serif italic text-stone-500">No entries.</p>
          )}
          {results.map((e) => {
            const already = excludeIds.has(e.id);
            return (
              <button
                key={e.id}
                type="button"
                disabled={already}
                onClick={() => onPick(e)}
                className="block w-full space-y-0.5 rounded border border-transparent px-2 py-1.5 text-left hover:border-stone-200 disabled:opacity-40"
              >
                <div className="font-sans text-xs uppercase tracking-wide text-stone-400">
                  {e.genre.toLowerCase()} ·{" "}
                  {e.createdAt.slice(0, 10)}
                  {already && (
                    <span className="ml-2 text-stone-500">· already added</span>
                  )}
                </div>
                <div className="line-clamp-2 font-serif text-sm text-stone-700">
                  {e.plainText.trim() || "(empty)"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
