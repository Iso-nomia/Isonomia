// components/discussion/ThreadListSidebar.tsx
"use client";
import * as React from "react";
import useSWR from "swr";

type Row = { id: string; body?: any; bodyText?: string | null; score: number; createdAt: string };
const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

function plainFromNode(n: any): string {
  if (!n) return "";
  if (typeof n === "string") return n;
  if (Array.isArray(n)) return n.map(plainFromNode).join("");
  if (n.type === "text") return n.text || "";
  if (Array.isArray(n.content)) return n.content.map(plainFromNode).join("");
  return "";
}
function pickTitle(row: Row) {
  const raw = row.bodyText && (row.bodyText.trim().startsWith("{") || row.bodyText.trim().startsWith("["))
    ? plainFromNode(row.body)
    : (row.bodyText ?? "");
  const oneLine = (raw || "").split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? "(no text)";
  return oneLine.slice(0, 80);
}
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  const y = Math.floor(mo / 12);
  return `${y}y`;
}

export default function ThreadListSidebar({ discussionId }: { discussionId: string }) {
  const { data, isLoading } = useSWR<{ items: Row[] }>(`/api/discussions/${discussionId}/forum?limit=100`, fetcher);
  const [q, setQ] = React.useState("");

  const list = React.useMemo(() => {
    const rows = data?.items ?? [];
    const filtered = q.trim()
      ? rows.filter((r) => pickTitle(r).toLowerCase().includes(q.trim().toLowerCase()))
      : rows;
    // Simple "active" sorting: score desc then newest
    return [...filtered].sort((a, b) => b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data?.items, q]);

  function jump(id: string) {
    const anchor = `c-${id}`;
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${anchor}`);
    } else {
      // fallback to hash (ForumPane highlight effect will apply on next render)
      location.hash = `#${anchor}`;
    }
  }

  return (
    <aside className="absolute rounded border bg-white/80 p-3">
      <div className="mb-2 text-sm font-medium">Threads</div>
      <input
        className="mb-2 w-full text-sm bg-white/70 border rounded px-2 py-1 outline-none"
        placeholder="Filter threads…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="space-y-2 max-h-[60vh] overflow-auto">
        {isLoading && <li className="text-xs text-slate-500">Loading…</li>}
        {!isLoading && list.length === 0 && (
          <li className="text-xs text-slate-500">No threads found.</li>
        )}
        {list.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => jump(r.id)}
              className="w-full text-left rounded px-2 py-1 hover:bg-white border"
            >
              <div className="text-[12px] text-slate-600 flex items-center justify-between">
                <span>+{r.score}</span>
                <span>{timeAgo(r.createdAt)}</span>
              </div>
              <div className="text-[13px] line-clamp-2">{pickTitle(r)}</div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
