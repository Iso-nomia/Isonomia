// app/deliberation/[id]/forum/ui/ForumLens.tsx
"use client";
import useSWR from "swr";
const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

export default function ForumLens({ deliberationId }: { deliberationId: string }) {
  const { data } = useSWR(`/api/dialogue/moves?deliberationId=${encodeURIComponent(deliberationId)}`, fetcher);
  const moves = data?.items ?? [];
  return (
    <div className="p-3 space-y-3">
      {moves.map((m: any) => (
        <div key={m.id} className="rounded border bg-white/70 p-2">
          <div className="text-[11px] text-slate-500">
            {m.kind} · {m.actorId}
          </div>
          <div className="text-sm">
            {m.payload?.expression || m.payload?.text || m.payload?.brief || m.payload?.note || ""}
          </div>
        </div>
      ))}
      {!moves.length && <div className="text-sm text-slate-600">No posts yet.</div>}
    </div>
  );
}
