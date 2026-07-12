"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import RichTextEditor from "../../../_components/RichTextEditor";
import SourcePicker from "../../../_components/SourcePicker";

type Genre =
  | "FRAGMENT"
  | "EXCERPT"
  | "OBSERVATION"
  | "MEDITATION"
  | "DIALOGUE"
  | "LETTER"
  | "LIST"
  | "POEM";

const GENRE_LABELS: Record<Genre, string> = {
  FRAGMENT: "Fragment",
  EXCERPT: "Excerpt",
  OBSERVATION: "Observation",
  MEDITATION: "Meditation",
  DIALOGUE: "Dialogue",
  LETTER: "Letter",
  LIST: "List",
  POEM: "Poem",
};

type Thread = {
  id: string;
  name: string | null;
  _count?: { entries: number };
};

type EntryShape = {
  id: string;
  body: unknown;
  genre: Genre;
  threadId: string | null;
  sourceId: string | null;
  locator: string | null;
};

export default function EditEntryPage({
  params,
}: {
  params: { entryId: string };
}) {
  const router = useRouter();

  const [entry, setEntry] = useState<EntryShape | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [genre, setGenre] = useState<Genre>("FRAGMENT");
  const [threadId, setThreadId] = useState<string>("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [newThreadName, setNewThreadName] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [locator, setLocator] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const [editor, setEditor] = useState<Editor | null>(null);

  // Load the entry.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entries/${params.entryId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`load_failed_${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const e = data.entry as {
          id: string;
          body: unknown;
          genre: Genre;
          thread: { id: string } | null;
          source: { id: string } | null;
          locator: string | null;
        };
        setEntry({
          id: e.id,
          body: e.body,
          genre: e.genre,
          threadId: e.thread?.id ?? null,
          sourceId: e.source?.id ?? null,
          locator: e.locator ?? null,
        });
        setGenre(e.genre);
        setThreadId(e.thread?.id ?? "");
        setSourceId(e.source?.id ?? null);
        setLocator(e.locator ?? "");
      })
      .catch((err) => {
        if (!cancelled) setLoadError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [params.entryId]);

  // Seed the editor once entry + editor are both ready. RichTextEditor is
  // gated on `entry` below and receives the body as initialContent, so this is
  // only a safety net for the case where the editor mounts before the fetch
  // (e.g. React fast-refresh) — it re-applies the loaded body.
  useEffect(() => {
    if (!editor || !entry) return;
    try {
      if (editor.isEmpty) editor.commands.setContent(entry.body as object, false);
    } catch {
      // ignore — corrupted body
    }
  }, [editor, entry]);

  // Load threads list when needed.
  useEffect(() => {
    if (genre !== "MEDITATION") return;
    let cancelled = false;
    fetch("/api/threads")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.threads)) setThreads(data.threads);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [genre]);

  const canSave = useMemo(
    () => !!editor && !!entry && !saving,
    [editor, entry, saving],
  );

  async function ensureThreadId(): Promise<string | null | undefined> {
    if (genre !== "MEDITATION") return null;
    if (threadId) return threadId;
    const name = newThreadName.trim();
    if (!name) return null;
    const res = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("thread_create_failed");
    const data = await res.json();
    return data.thread.id as string;
  }

  async function handleSave(commit?: boolean) {
    if (!canSave || !editor || !entry) return;
    setSaving(true);
    setError(null);
    try {
      const finalThreadId = await ensureThreadId();
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: editor.getJSON(),
          genre,
          threadId: finalThreadId,
          sourceId: genre === "EXCERPT" ? sourceId : null,
          locator: genre === "EXCERPT" ? locator.trim() || null : null,
          changeNote: changeNote.trim() || null,
          ...(commit !== undefined ? { commit } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "save_failed");
      }
      // A draft save (commit === false) keeps the author in the editor; a
      // commit (or a legacy save) returns to the entry to see the result.
      if (commit === false) {
        setSaving(false);
        setDraftSavedAt(new Date().toLocaleTimeString());
        setChangeNote("");
        return;
      }
      router.push(`/entry/${entry.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  // Cmd/Ctrl+Enter to save.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave(genre === "POEM" ? true : undefined);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, entry, genre, threadId, newThreadName, sourceId, locator, changeNote, saving]);

  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-700">Could not load entry: {loadError}</p>
        <Link href="/read" className="text-sm text-stone-700 hover:underline">
          ← Back to threads
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="font-sans text-xs text-stone-500">
        Editing entry —{" "}
        <Link
          href={`/entry/${params.entryId}`}
          className="text-stone-700 hover:underline"
        >
          cancel
        </Link>
      </div>

      {entry ? (
        <RichTextEditor
          genre={genre}
          initialContent={entry.body as object}
          autofocus="end"
          onReady={setEditor}
        />
      ) : (
        <p className="font-sans text-sm text-stone-400">Loading…</p>
      )}

      <div className="border-t border-stone-200 pt-6 space-y-4 font-sans">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Genre
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(GENRE_LABELS) as Genre[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenre(g)}
                className={`rounded border px-3 py-1 text-sm transition ${
                  genre === g
                    ? "border-stone-900 bg-stone-900 text-stone-50"
                    : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"
                }`}
              >
                {GENRE_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        {genre === "MEDITATION" && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-700">
              Thread
            </label>
            <select
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
              className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— New or unnamed —</option>
              {threads.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name ?? "(unnamed)"}{" "}
                  {t._count ? `· ${t._count.entries}` : ""}
                </option>
              ))}
            </select>
            {!threadId && (
              <input
                type="text"
                value={newThreadName}
                onChange={(e) => setNewThreadName(e.target.value)}
                placeholder="Name a new theme (optional)"
                className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm"
              />
            )}
          </div>
        )}

        {genre === "EXCERPT" && (
          <SourcePicker
            sourceId={sourceId}
            onSourceChange={setSourceId}
            locator={locator}
            onLocatorChange={setLocator}
          />
        )}

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Change note <span className="text-stone-400">(optional)</span>
          </label>
          <input
            type="text"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="Why this revision? (e.g. “sharpened the conclusion”)"
            className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-stone-500">
            Stored alongside this version in the revision history.
          </p>
        </div>

        {genre === "POEM" ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={!canSave}
              className="rounded bg-stone-900 px-4 py-2 text-sm text-stone-50 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Commit revision"}
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={!canSave}
              className="rounded border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:border-stone-500 disabled:opacity-50"
            >
              Save draft
            </button>
            <span className="text-xs text-stone-500">
              ⌘/Ctrl + Enter to commit
            </span>
            {draftSavedAt && (
              <span className="text-xs text-emerald-700">
                Draft saved {draftSavedAt} — not yet a revision
              </span>
            )}
            {error && <span className="text-xs text-rose-700">Error: {error}</span>}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={!canSave}
              className="rounded bg-stone-900 px-4 py-2 text-sm text-stone-50 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save revision"}
            </button>
            <span className="text-xs text-stone-500">⌘/Ctrl + Enter</span>
            {error && <span className="text-xs text-rose-700">Error: {error}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
