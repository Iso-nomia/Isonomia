"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const GENRES = [
  { value: "", label: "All genres" },
  { value: "FRAGMENT", label: "Fragment" },
  { value: "EXCERPT", label: "Excerpt" },
  { value: "OBSERVATION", label: "Observation" },
  { value: "MEDITATION", label: "Meditation" },
  { value: "DIALOGUE", label: "Dialogue" },
  { value: "LETTER", label: "Letter" },
  { value: "LIST", label: "List" },
];

export default function SearchForm({
  initialQuery,
  initialGenre,
  initialThreadId,
  threads,
}: {
  initialQuery: string;
  initialGenre: string;
  initialThreadId: string;
  threads: { id: string; name: string | null }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(initialQuery);
  const [genre, setGenre] = useState(initialGenre);
  const [threadId, setThreadId] = useState(initialThreadId);

  // Keep state in sync with URL changes (back/forward).
  useEffect(() => {
    setQ(params?.get("q") ?? "");
    setGenre(params?.get("genre") ?? "");
    setThreadId(params?.get("threadId") ?? "");
  }, [params]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (genre) sp.set("genre", genre);
    if (threadId) sp.set("threadId", threadId);
    router.push(`/search${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  return (
    <form onSubmit={submit} className="space-y-3 font-sans">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
        placeholder="Find a phrase…"
        className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-base focus:border-stone-500 focus:outline-none"
      />
      <div className="flex flex-wrap gap-2 text-sm">
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="rounded border border-stone-300 bg-white px-2 py-1"
        >
          {GENRES.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <select
          value={threadId}
          onChange={(e) => setThreadId(e.target.value)}
          className="rounded border border-stone-300 bg-white px-2 py-1"
        >
          <option value="">All threads</option>
          {threads.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name ?? "(unnamed)"}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-stone-900 px-3 py-1 text-stone-50"
        >
          Search
        </button>
      </div>
    </form>
  );
}
