"use client";

import React from "react";
import clsx from "clsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useBusEffect } from "@/lib/client/useBusEffect";
import type { AgoraEvent } from "@/lib/server/bus";
import { EventCard } from "./EventCard";
import { FiltersPanel } from "./FiltersPanels";
import { RightRail } from "./RightRail";
import { TopBar } from "./TopBar";
import { useFollowing } from "@/lib/client/useFollowing";
import { useStackFollowing } from "@/lib/client/useStackFollowing";
import DebateSheetReader from "@/components/agora/DebateSheetReader";
// import SheetPicker from '@/components/agora/SheetPicker';
import { RoomPicker, DebatePicker, SheetPicker } from '@/components/agora/RoomAndDebatePickers';
import ConfidenceControls from '@/components/agora/ConfidenceControls';
import { PlexusShell } from "./PlexusShell";
import { NewKbButton } from "@/components/kb/NewKbButton";
import { NewDeliberationButton } from "@/components/agora/NewDeliberationButton";
/* ------------------------------ helpers ------------------------------ */
function niceDomain(url?: string | null, fallback?: string | null) {
  if (fallback) return fallback;
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}
function titleFromUrl(url: string) {
  try {
    const u = new URL(url);
    const domain = u.hostname.replace(/^www\./, "");
    const tail = decodeURIComponent(
      u.pathname.split("/").filter(Boolean).pop() || ""
    ).slice(0, 80);
    return tail ? `${domain} · ${tail}` : domain;
  } catch {
    return url;
  }
}
function niceTitle(m: any) {
  const t = (m.title || "").trim();
  if (t && !/^https?:\/\//i.test(t)) return t;
  if (m.url && String(m.url).includes("doi.org")) {
    try {
      const u = new URL(m.url);
      return `doi:${decodeURIComponent(u.pathname.replace(/^\/+/, ""))}`;
    } catch {}
  }
  return m.url ? titleFromUrl(m.url) : m.domain || "Source";
}
function cleanPreview(s?: string | null) {
  if (!s) return "";
  const x = s.replace(/\s+/g, " ").trim();
  return /^sources:\s*$/i.test(x) ? "" : x;
}

/* ------------------------------ coalescer ---------------------------- */
const BUNDLE_WINDOW_MS = 3 * 60 * 1000;
const CITATION_BUNDLE_WINDOW_MS = 2 * 60 * 1000;

function coalesce(prev: AgoraEvent[], ev: AgoraEvent): AgoraEvent[] {
  // CITATIONS bundle by (targetType:targetId)
  if (ev.type === "citations:changed") {
    const tgtType = (ev as any).targetType;
    const tgtId = (ev as any).targetId;
    const tgtKey = `${tgtType}:${tgtId}`;

    const bundleIdx = prev.findIndex(
      (e: any) =>
        (e as any).type === "bundle" &&
        e.subtype === "citations" &&
        e.tgtKey === tgtKey &&
        ev.ts - e.ts <= CITATION_BUNDLE_WINDOW_MS
    );
    if (bundleIdx >= 0) {
      const b: any = prev[bundleIdx];
      const count = (b.count || 1) + 1;
      const upd = {
        ...b,
        ts: ev.ts,
        count,
        title: `${count} sources attached`,
        meta: b.meta,
      };
      return [upd, ...prev.filter((_, i) => i !== bundleIdx)];
    }

    const priorIdx = prev.findIndex(
      (e: any) =>
        (e as any).type === "citations:changed" &&
        `${e.targetType}:${e.targetId}` === tgtKey &&
        ev.ts - e.ts <= CITATION_BUNDLE_WINDOW_MS
    );
    if (priorIdx >= 0) {
      const base: any = prev[priorIdx];
      const bundle: any = {
        id: `bd:cit:${tgtKey}:${ev.ts}`,
        type: "bundle",
        subtype: "citations",
        ts: ev.ts,
        tgtKey,
        count: 2,
        title: "2 sources attached",
        meta: base.meta,
        chips: ["sources"],
        link: base.link,
        icon: "link",
      };
      const trimmed = prev.filter((_, i) => i !== priorIdx);
      return [bundle, ...trimmed];
    }

    return [ev, ...prev];
  }

  // DIALOGUE bundle by deliberationId
  if (ev.type === "dialogue:changed" && ev.deliberationId) {
    const room = ev.deliberationId;

    const roomBundleIdx = prev.findIndex(
      (e: any) =>
        (e as any).type === "bundle" &&
        e.deliberationId === room &&
        ev.ts - e.ts <= BUNDLE_WINDOW_MS
    );
    if (roomBundleIdx >= 0) {
      const b: any = prev[roomBundleIdx];
      const kinds = { ...(b.kinds || {}) };
      const k = (ev.chips?.[0] || "MOVE") as string;
      kinds[k] = (kinds[k] || 0) + 1;
      const upd = {
        ...b,
        ts: ev.ts,
        title: "Room burst",
        meta: Object.entries(kinds)
          .map(([kk, v]) => `${v} ${kk}`)
          .join(" · "),
        kinds,
      };
      return [upd, ...prev.filter((_, i) => i !== roomBundleIdx)];
    }

    const priorMoveIdx = prev.findIndex(
      (e) =>
        e.type === "dialogue:changed" &&
        e.deliberationId === room &&
        ev.ts - e.ts <= BUNDLE_WINDOW_MS
    );
    if (priorMoveIdx >= 0) {
      const base = prev[priorMoveIdx];
      const kinds: Record<string, number> = {};
      const k1 = (base.chips?.[0] || "MOVE") as string;
      const k2 = (ev.chips?.[0] || "MOVE") as string;
      kinds[k1] = (kinds[k1] || 0) + 1;
      kinds[k2] = (kinds[k2] || 0) + 1;

      const bundle: any = {
        id: `bd:${room}:${ev.ts}`,
        type: "bundle",
        ts: ev.ts,
        title: "Room burst",
        meta: Object.entries(kinds)
          .map(([kk, v]) => `${v} ${kk}`)
          .join(" · "),
        chips: [`room:${room.slice(0, 6)}…`],
        link: `/deliberation/${room}`,
        deliberationId: room,
        icon: "move",
        kinds,
      };
      const trimmed = prev.filter((_, i) => i !== priorMoveIdx);
      return [bundle, ...trimmed];
    }

    return [ev, ...prev];
  }

  return [ev, ...prev];
}


/* ------------------------------ component ---------------------------- */
export default function Agora({
  initialEvents,
}: {
  initialEvents: AgoraEvent[];
}) {
  const [events, setEvents] = React.useState<AgoraEvent[]>(initialEvents);
  const [paused, setPaused] = React.useState(false);
  const [tab, setTab] = React.useState<
    "all" | "following" | "calls" | "votes" | "accepted"
  >("all");
  const [view, setView] = React.useState<"feed" | "debates" | "plexus">("feed"); // ⬅️ NEW top-level view

  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<AgoraEvent | null>(null);

  const { roomSet, isFollowingRoom, isFollowingTag, followRoom, unfollowRoom } =
    useFollowing();
  const { stackSet, isFollowingStack } = useStackFollowing();

  const [pending, setPending] = React.useState<Set<string>>(new Set());
  const [ok, setOk] = React.useState<Set<string>>(new Set());

  const [currentSheetKey, setCurrentSheetKey] = React.useState<string | null>(null);
const [roomId, setRoomId] = React.useState<string|null>(null);
const [debateId, setDebateId] = React.useState<string|null>(null);
const [sheetKey, setSheetKey] = React.useState<string|null>(null);
  

React.useEffect(()=>{ if (debateId) setSheetKey(`delib:${debateId}`); }, [debateId]);

  // Fallback hydrate if SSR didn’t deliver
  React.useEffect(() => {
    if (events.length > 0) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/agora/events?limit=30", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!r.ok) return;
        const j = await r.json().catch(() => null);
        const items = Array.isArray(j?.items) ? j.items : [];
        if (alive && items.length) setEvents(items);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [events.length]);

  function setPendingOn(id: string, on: boolean) {
    setPending((prev) => {
      const n = new Set(prev);
      on ? n.add(id) : n.delete(id);
      return n;
    });
  }
  function flashOk(id: string, ms = 1200) {
    setOk((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
    setTimeout(() => {
      setOk((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }, ms);
  }

  async function doFollow(roomId: string) {
    setPendingOn(roomId, true);
    try {
      await followRoom(roomId);
      flashOk(roomId);
      window.dispatchEvent(
        new CustomEvent("follow:changed", {
          detail: { kind: "room", id: roomId, following: true },
        })
      );
    } finally {
      setPendingOn(roomId, false);
    }
  }
  async function doUnfollow(roomId: string) {
    setPendingOn(roomId, true);
    try {
      await unfollowRoom(roomId);
      flashOk(roomId);
      window.dispatchEvent(
        new CustomEvent("follow:changed", {
          detail: { kind: "room", id: roomId, following: false },
        })
      );
    } finally {
      setPendingOn(roomId, false);
    }
  }

  // ---------------- Active room selection ----------------
  const roomsFromEvents = React.useMemo(() => {
    const ids = new Set<string>();
    for (const e of events) if (e.deliberationId) ids.add(e.deliberationId);
    return Array.from(ids);
  }, [events]);

  const followedRooms = React.useMemo(() => Array.from(roomSet), [roomSet]);
  const allRooms = React.useMemo(() => {
    const s = new Set<string>([...followedRooms, ...roomsFromEvents]);
    return Array.from(s);
  }, [followedRooms, roomsFromEvents]);

  const [currentRoomId, setCurrentRoomId] = React.useState<string | null>(null);


// restore/persist:
React.useEffect(() => {
  try { const k = localStorage.getItem('agora:activeSheet'); if (k) setCurrentSheetKey(k); } catch {}
}, []);
React.useEffect(() => {
  if (currentSheetKey) try { localStorage.setItem('agora:activeSheet', currentSheetKey); } catch {}
}, [currentSheetKey]);

// when plexus/room changes, you can optionally mirror it:
React.useEffect(() => {
  if (currentRoomId && (!currentSheetKey || currentSheetKey.startsWith('delib:'))) {
    setCurrentSheetKey(`delib:${currentRoomId}`);
  }
}, [currentRoomId]); // optional


  // Initialize from localStorage or fallbacks
  React.useEffect(() => {
    if (currentRoomId) return; // already set
    try {
      const stored = localStorage.getItem("agora:activeRoom");
      if (stored) {
        setCurrentRoomId(stored);
        return;
      }
    } catch {}
    if (allRooms.length) setCurrentRoomId(allRooms[0]);
  }, [currentRoomId, allRooms]);

  // Persist when it changes
  React.useEffect(() => {
    if (currentRoomId) {
      try {
        localStorage.setItem("agora:activeRoom", currentRoomId);
      } catch {}
    }
  }, [currentRoomId]);

  // function RoomPicker({
  //   rooms,
  //   value,
  //   onChange,
  // }: {
  //   rooms: string[];
  //   value: string | null;
  //   onChange: (id: string) => void;
  // }) {
  //   if (!rooms.length) return null;
  //   return (
  //     <div className="flex items-center gap-2 p-2 text-sm">
  //       <label className="text-neutral-600">Active room:</label>
  //       <select
  //         className="menuv2--lite rounded px-2 py-1"
  //         value={value ?? ""}
  //         onChange={(e) => onChange(e.target.value)}
  //       >
  //         {!value && <option value="">Select…</option>}
  //         {rooms.map((rid) => (
  //           <option key={rid} value={rid}>
  //             room:{rid.slice(0, 20)}…
  //           </option>
  //         ))}
  //       </select>
  //     </div>
  //   );
  // }

  // 🔊 Live events
  useBusEffect("*", (m) => {
    if (paused) return;

    const t = String(m?.type ?? "");
    const ts = typeof m.ts === "number" ? m.ts : Date.parse(m.ts) || Date.now();
    let ev: AgoraEvent | null = null;

    switch (t) {
      case "dialogue:moves:refresh":
        ev = {
          id: `mv:${m.moveId || ts}`,
          type: "dialogue:changed",
          ts,
          title: `New move${m.kind ? ` (${m.kind})` : ""}`,
          meta: m.deliberationId
            ? `room:${String(m.deliberationId).slice(0, 6)}…`
            : undefined,
          chips: m.kind ? [m.kind] : [],
          link: m.deliberationId
            ? `/deliberation/${m.deliberationId}`
            : undefined,
          deliberationId: m.deliberationId,
          icon: "move",
        };
        break;

      case "dialogue:changed":
        ev = {
          id: `mv:${m.moveId || ts}`,
          type: "dialogue:changed",
          ts,
          title: `Room activity${m.kind ? ` (${m.kind})` : ""}`,
          meta: m.deliberationId
            ? `room:${String(m.deliberationId).slice(0, 6)}…`
            : undefined,
          chips: m.kind ? [m.kind] : [],
          link: m.deliberationId
            ? `/deliberation/${m.deliberationId}`
            : undefined,
          deliberationId: m.deliberationId,
          icon: "move",
        };
        break;

      case "citations:changed": {
        const titleTxt = niceTitle(m);
        const targetLabel =
          m.targetType === "comment"
            ? "Comment"
            : m.targetType === "claim"
            ? "Claim"
            : m.targetType || "Target";

        const loc = m.locator ? ` · ${m.locator}` : "";
        const domLabel = niceDomain(m.url, m.domain);
        const dom = domLabel ? ` · ${domLabel}` : "";
        const preview = cleanPreview(m.targetPreview);

        const quoteChip = m.quote
          ? `“${String(m.quote).slice(0, 120)}${
              String(m.quote).length > 120 ? "…" : ""
            }”`
          : null;
        const noteChip = m.note
          ? `Note: ${String(m.note).slice(0, 80)}${
              String(m.note).length > 80 ? "…" : ""
            }`
          : null;
        const kindChip = m.kind ? String(m.kind) : null;
        const platChip = m.platform ? String(m.platform) : null;

        const rawChips = [
          ...(quoteChip ? [quoteChip] : []),
          ...(noteChip ? [noteChip] : []),
          ...(kindChip ? [kindChip] : []),
          ...(platChip && platChip !== kindChip ? [platChip] : []),
          "source",
        ];
        const chips = Array.from(new Set(rawChips));

        const contextLink =
          m.stackId && m.targetType === "comment"
            ? `/stacks/${m.stackId}#c=${m.targetId}`
            : m.targetType === "claim"
            ? `/claim/${m.targetId}`
            : undefined;

        ev = {
          id: `ct:${ts}:${m.sourceId || ""}:${m.targetId || ""}`,
          type: "citations:changed",
          ts,
          title: `Added source: ${titleTxt}`,
          meta: `${targetLabel}${loc}${dom}${preview ? ` · ${preview}` : ""}`,
          chips,
          link: m.url || contextLink,
          contextLink,
          icon: "link",
          targetType: m.targetType,
          targetId: m.targetId,
          deliberationId: m.deliberationId || undefined,
        } as any;
        break;
      }

      case "decision:changed":
        ev = {
          id: `dc:${ts}`,
          type: "decision:changed",
          ts,
          title: "Decision recorded",
          meta: m.rationale || "",
          chips: [m.kind || "decision"],
          link: m.deliberationId
            ? `/deliberation/${m.deliberationId}`
            : undefined,
          deliberationId: m.deliberationId,
          icon: "check",
        };
        break;

      case "votes:changed":
        ev = {
          id: `vt:${ts}`,
          type: "votes:changed",
          ts,
          title: "Vote updated",
          meta: m.sessionId
            ? `session:${String(m.sessionId).slice(0, 6)}…`
            : undefined,
          chips: [m.method || "vote"],
          link: m.deliberationId
            ? `/deliberation/${m.deliberationId}`
            : undefined,
          deliberationId: m.deliberationId,
          icon: "vote",
        };
        break;

      case "xref:changed":
        ev = {
          id: `xr:${ts}`,
          type: "xref:changed",
          ts,
          title: "Cross-link added",
          meta: m.relation || "",
          chips: ["xref"],
          link:
            m.toType === "deliberation" ? `/deliberation/${m.toId}` : undefined,
          deliberationId: m.toType === "deliberation" ? m.toId : undefined,
          icon: "branch",
        };
        break;

      case "deliberations:created": {
        const delibId = m.id || m.deliberationId;
        ev = {
          id: `dl:${delibId || ts}`,
          type: "deliberations:created",
          ts,
          title: "Discussion opened",
          meta: `${m.hostType || ""}:${m.hostId || ""}`,
          chips: ["spawn"],
          link: delibId ? `/deliberation/${delibId}` : undefined,
          deliberationId: delibId,
          icon: "plus",
        };
        break;
      }

      case "stacks:changed": {
        const op = m.op || "update";
        const titleMap: Record<string, string> = {
          subscribe: "Subscribed to a stack",
          unsubscribe: "Unsubscribed from a stack",
          reorder: "Stack reordered",
          remove: "Item removed from stack",
        };
        ev = {
          id: `st:${ts}`,
          type: "stacks:changed",
          ts,
          title: titleMap[op] || "Stack updated",
          meta: m.stackId
            ? `stack:${String(m.stackId).slice(0, 6)}…`
            : undefined,
          chips: [op],
          link: m.stackId ? `/stacks/${m.stackId}` : undefined,
          icon: "stack",
        };
        break;
      }

      case "comments:changed": {
        const op = m.op || "update";
        const title =
          op === "add"
            ? "New comment on a stack"
            : op === "delete"
            ? "Comment removed"
            : "Comments updated";
        ev = {
          id: `cm:${ts}`,
          type: "comments:changed",
          ts,
          title,
          meta: m.stackId
            ? `stack:${String(m.stackId).slice(0, 6)}…`
            : undefined,
          chips: ["comment"],
          link: m.stackId ? `/stacks/${m.stackId}` : undefined,
          icon: "chat",
        };
        break;
      }

      default:
        // ignore unknowns like hello/ping; or turn them into generic cards if you prefer
        break;
    }

    if (ev) setEvents((prev) => coalesce(prev, ev).slice(0, 200));
  });

  /* ------------------------------ filters ---------------------------- */
  const hasFollowData = roomSet.size > 0 || stackSet.size > 0;

  const filtered = React.useMemo(() => {
    let list = events;

    if (tab === "accepted")
      list = list.filter((e) => e.type === "decision:changed");
    if (tab === "votes") list = list.filter((e) => e.type === "votes:changed");

    if (tab === "following") {
      if (!hasFollowData) {
        // No follow data yet → don't blank the feed
        return events;
      }
      list = list.filter((e) => {
        const inRooms = e.deliberationId
          ? roomSet.has(e.deliberationId)
          : false;
        const inTags = (e.chips || []).some((c) => isFollowingTag(c));

        const inStacks =
          (e.type === "stacks:changed" || e.type === "comments:changed") &&
          (e as any).link?.includes("/stacks/")
            ? isFollowingStack((e as any).link.split("/stacks/")[1])
            : false;

        // citations considered "following" if tied to a followed room or stack
        const cit = e.type === "citations:changed" ? (e as any) : null;
        const citInRoom = cit?.deliberationId
          ? roomSet.has(cit.deliberationId)
          : false;
        const citInStack = cit?.contextLink?.includes("/stacks/")
          ? isFollowingStack(cit.contextLink.split("/stacks/")[1].split("#")[0])
          : false;

        return inRooms || inTags || inStacks || citInRoom || citInStack;
      });
    }

    if (q) {
      const ql = q.toLowerCase();
      list = list.filter(
        (e) =>
          (e.title ?? "").toLowerCase().includes(ql) ||
          (e.meta ?? "").toLowerCase().includes(ql) ||
          (e.chips ?? []).some((c) => c.toLowerCase().includes(ql))
      );
    }

    return list;
  }, [
    events,
    tab,
    q,
    roomSet,
    isFollowingTag,
    isFollowingStack,
    hasFollowData,
  ]);

  /* ------------------------------ render ----------------------------- */
  return (

    <div className="mx-auto w-full max-w-screen  justify-center px-0 pb-10 pt-2">
      <TopBar
        tab={tab}
        onTab={setTab}
        q={q}
        onQ={setQ}
        paused={paused}
        onPause={() => setPaused((p) => !p)}
      />
      <div className="flex mt-3 mx-auto justify-end px-8">
        <NewDeliberationButton />
{/* <NewKbButton /> */}
</div>
  <div className="flex w-full justify-center items-center mb-2 mx-auto">
  <div className="inline-flex mt-1 justify-center mx-auto rounded-xl border border-indigo-300 bg-white/70 text-sm overflow-hidden">
    {(['feed','debates','plexus'] as const).map(v => (
      <button
        key={v}
        className={clsx(
          'px-5 py-1 border-r border-r-indigo-300 last:border-r-0 justify-end items-end mx-auto',
          view===v ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
        )}
        onClick={()=>setView(v)}
      >
        {v}
      </button>
    ))}
  </div>
  {/* <div className="inline-flex mt-3 rounded-xl border border-indigo-300 bg-white/70 text-sm overflow-hidden">
    {(['all','following','calls','votes','accepted'] as const).map(v => (
      <button
        key={v}
        className={clsx(
          'px-5 py-1 border-r border-r-indigo-300 last:border-r-0 ',
          view===v ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
        )}
        onClick={()=>setView(v)}
      >
        {v}
      </button>
    ))}
  </div> */}

</div>

{view === 'plexus' && (
  // <Plexus
  //   scope="public"
  //   selectedRoomId={currentRoomId}
  //   onSelectRoom={setCurrentRoomId}
  //   onLinkCreated={()=>{/* toast if you want */}}
  // />
  <PlexusShell scope="public" />
)}

{/* {view === 'sheet' && (
  currentRoomId
    ? (
        <div className="px-4">
          <RoomPicker
            rooms={allRooms}
            value={currentRoomId}
            onChange={setCurrentRoomId}
          />
          <DebateSheetReader sheetId={`delib:${currentRoomId}`} />
        </div>
      )
    : <div className="text-xs text-neutral-600 border rounded-xl bg-white/70 p-2">
        Pick an active room to load its Debate Sheet.
      </div>
)} */}

{view === 'debates' && (

<div className="space-y-2 px-4">
  <div className="flex flex-wrap gap-3 p-2">
    <RoomPicker  value={roomId}  onChange={(id)=>{ setRoomId(id); setDebateId(null); }} />
    <DebatePicker roomId={roomId} value={debateId} onChange={setDebateId} />
    <SheetPicker  deliberationId={debateId} value={sheetKey} onChange={setSheetKey} />
      <div className="flex gap-5">
   {/* <ConfidenceControls /> */}
   </div>
  </div>

  {sheetKey
    ? <DebateSheetReader sheetId={sheetKey} />
    : <div className="text-xs text-neutral-600 border rounded-xl bg-white/70 p-2">
        Pick a room → debate → sheet.
      </div>
  }
</div>
)}

{view === 'feed' && (
  
      <div className="grid grid-cols-12 gap-4 mt-3">
        <aside className="hidden px-2 lg:block col-span-3">
          <FiltersPanel />
        </aside>
        <div className="col-span-12 lg:col-span-6 space-y-2 ">
         
              {filtered.map((e) => {
                const rid = e.deliberationId || "";
                const following = !!rid && isFollowingRoom(rid);
                const isPending = !!rid && pending.has(rid);
                const isOk = !!rid && ok.has(rid);
                return (
                  <EventCard
                    key={e.id}
                    ev={e}
                    onSelect={(x) => setSelected(x)}
                    isFollowing={following}
                    onFollow={() =>
                      rid &&
                      (async () => {
                        await followRoom(rid);
                      })()
                    }
                    onUnfollow={() =>
                      rid &&
                      (async () => {
                        await unfollowRoom(rid);
                      })()
                    }
                    pending={isPending}
                    ok={isOk}
                  />
                );
              })}
              {!filtered.length && (
                <div className="text-sm text-slate-600 border rounded-xl bg-white/70 p-3">
                  No events yet.
                </div>
              )}
         
        </div>
             <aside className="hidden px-2 xl:block col-span-3">
          <RightRail selected={selected} />
        </aside>
      </div>
    )}

       </div>


  );
  
}
