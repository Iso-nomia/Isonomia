// components/agora/RightRail.tsx
"use client";
import useSWR from "swr";
import { useFollowing } from "@/lib/client/useFollowing";
import type { AgoraEvent } from "@/lib/server/bus";
import { StackSummaryCard } from "./StackSummaryCard";

const fetcher = (u:string)=>fetch(u,{cache:"no-store"}).then(r=>r.json());

export function RightRail({ selected }: { selected: AgoraEvent | null }) {
  // Prefer event’s room if present (works for moves & now citations)
  const toDelib =
    selected?.deliberationId ||
    (selected as any)?.toId ||                 // legacy
    null;

  const { isFollowingRoom, followRoom, unfollowRoom } = useFollowing();

  const { data } = useSWR(
    toDelib ? `/api/xref?toType=deliberation&toId=${encodeURIComponent(toDelib)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const backlinks = data?.items ?? [];

  // Derive stack from either `link` OR `contextLink`
  const link = (selected as any)?.contextLink || selected?.link || "";
  const stackMatch = typeof link === "string" ? link.match(/\/stacks\/([^/?#]+)/) : null;
  const stackIdOrSlug = stackMatch?.[1];

  // Optionally parse stack from meta "stack:xxxx…" (for stacks:changed)
  const stackId =
    selected?.type === "stacks:changed"
      ? (selected.meta?.startsWith?.("stack:") ? selected.meta.split(":")[1].replace("…", "") : null)
      : stackIdOrSlug || null;

  return (
    <div className="space-y-3">
      {/* Room (follow + open) */}
      {toDelib && (
        <div className="rounded-xl border bg-white/70 p-3">
          <div className="text-sm font-medium">Room {toDelib}</div>
          <div className="mt-2 flex items-center gap-2">
            <a className="text-xs underline" href={`/deliberation/${toDelib}`}>Open Deliberation</a>
              <a className="text-xs underline" href={`/deliberation/${toDelib}/dialoguetimeline`}>Open Dialogue Timeline</a>
            {isFollowingRoom(toDelib) ? (
              <button className="text-xs px-2 py-1 rounded border bg-emerald-50 border-emerald-200 text-emerald-700"
                onClick={() => unfollowRoom(toDelib)}>Following ✓</button>
            ) : (
              <button className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50"
                onClick={() => followRoom(toDelib)}>Follow</button>
            )}
          </div>
        </div>
      )}

      {/* Navigator (XRef) */}
      <div className="rounded-xl border bg-white/70 p-3">
        <div className="text-sm font-medium">Navigator</div>
        {!toDelib ? (
          <div className="text-[12px] text-slate-600 mt-1">Select a card to see backlinks.</div>
        ) : backlinks.length ? (
          <ul className="mt-2 space-y-1 text-[12px]">
            {backlinks.map((x:any)=>(
              <li key={x.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{x.relation} from {x.fromType}:{String(x.fromId).slice(0,6)}…</span>
                {x.fromType==='deliberation' && <a className="underline" href={`/deliberation/${x.fromId}`}>Open</a>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[12px] text-slate-600 mt-1">No backlinks.</div>
        )}
      </div>

      {/* Stack summary when present */}
      {stackId && (
        <div>
          <div className="text-[11px] text-slate-500 mb-1">Stack</div>
          <StackSummaryCard stackId={stackId} />
        </div>
      )}
    </div>
  );
}
