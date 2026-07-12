"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ArtifactSummary = {
  id: string;
  title: string;
  publishedAt: string | null;
};

type Props = { entryId: string };

/**
 * Quiet "Send to artifact" affordance on the entry detail page. Opens
 * a small panel listing the author's drafts (published artifacts shown
 * dimmed at the bottom); clicking one appends this entry as a new
 * block. A "+ new draft" option creates an artifact and appends in one
 * step, then navigates to the editor.
 */
export default function SendToArtifact({ entryId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<ArtifactSummary[] | null>(null);
  const [busyId, setBusyId] = useState<string | "new" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || artifacts !== null) return;
    setLoading(true);
    fetch("/api/artifacts")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setArtifacts(
          (data.artifacts ?? []).map(
            (a: { id: string; title: string; publishedAt: string | null }) => ({
              id: a.id,
              title: a.title || "Untitled",
              publishedAt: a.publishedAt,
            }),
          ),
        );
      })
      .catch(() => setError("Could not load artifacts."))
      .finally(() => setLoading(false));
  }, [open, artifacts]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const appendTo = async (artifactId: string) => {
    setBusyId(artifactId);
    setError(null);
    try {
      const res = await fetch(
        `/api/artifacts/${artifactId}/append-entry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId, includeProvenance: true }),
        },
      );
      if (!res.ok) {
        setError("Could not append.");
        setBusyId(null);
        return;
      }
      setDone(artifactId);
      setBusyId(null);
      setTimeout(() => {
        setOpen(false);
        setDone(null);
      }, 900);
    } catch {
      setError("Could not append.");
      setBusyId(null);
    }
  };

  const createAndAppend = async () => {
    setBusyId("new");
    setError(null);
    try {
      const create = await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!create.ok) {
        setError("Could not create draft.");
        setBusyId(null);
        return;
      }
      const data = await create.json();
      const newId: string = data.artifact.id;
      const append = await fetch(
        `/api/artifacts/${newId}/append-entry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId, includeProvenance: true }),
        },
      );
      if (!append.ok) {
        setError("Created draft but append failed.");
        setBusyId(null);
        return;
      }
      router.push(`/compose/${newId}`);
    } catch {
      setError("Could not create draft.");
      setBusyId(null);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-sans text-xs text-stone-500 hover:text-stone-900"
      >
        Send to artifact
      </button>
    );
  }

  const drafts = (artifacts ?? []).filter((a) => !a.publishedAt);
  const published = (artifacts ?? []).filter((a) => a.publishedAt);

  return (
    <div className="space-y-3 rounded border border-stone-300 bg-stone-50 p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-sans text-xs uppercase tracking-wide text-stone-500">
          Send to artifact
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-sans text-xs text-stone-500 hover:text-stone-900"
        >
          Cancel
        </button>
      </div>

      {loading && (
        <p className="font-sans text-xs text-stone-400">Loading…</p>
      )}

      {!loading && (
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={createAndAppend}
              disabled={busyId !== null}
              className="font-sans text-xs text-amber-700 hover:underline disabled:text-stone-400"
            >
              {busyId === "new" ? "Creating…" : "+ New draft"}
            </button>
          </li>
          {drafts.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => appendTo(a.id)}
                disabled={busyId !== null}
                className="font-serif text-sm text-stone-700 hover:text-stone-900 hover:underline disabled:text-stone-400"
              >
                {a.title}
                {busyId === a.id && (
                  <span className="ml-2 font-sans text-xs text-stone-400">
                    appending…
                  </span>
                )}
                {done === a.id && (
                  <span className="ml-2 font-sans text-xs text-amber-700">
                    appended
                  </span>
                )}
              </button>
            </li>
          ))}
          {published.length > 0 && (
            <>
              <li className="pt-2 font-sans text-xs uppercase tracking-wide text-stone-400">
                Published
              </li>
              {published.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => appendTo(a.id)}
                    disabled={busyId !== null}
                    className="font-serif text-sm text-stone-500 hover:text-stone-900 hover:underline disabled:text-stone-400"
                  >
                    {a.title}
                    {busyId === a.id && (
                      <span className="ml-2 font-sans text-xs text-stone-400">
                        appending…
                      </span>
                    )}
                    {done === a.id && (
                      <span className="ml-2 font-sans text-xs text-amber-700">
                        appended
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </>
          )}
          {drafts.length === 0 && published.length === 0 && (
            <li className="font-serif italic text-sm text-stone-500">
              No artifacts yet.
            </li>
          )}
        </ul>
      )}

      {error && (
        <p className="font-sans text-xs text-rose-700">{error}</p>
      )}
    </div>
  );
}
