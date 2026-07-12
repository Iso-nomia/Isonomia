//  PlexusBoard.tsx
"use client";
import * as React from "react";
import useSWR from "swr";
import clsx from "clsx";
import { useConfidence } from "./useConfidence";
import { useRoomGraphPrefetch } from "@/components/agora/useRoomGraphPrefetch";

/** ---- Types from your network endpoint ---- */
type EdgeKind = "xref" | "overlap" | "stack_ref" | "imports" | "shared_author";

type RoomNode = {
  id: string;
  title?: string | null;
  nArgs: number;
  nEdges: number;
  accepted: number;
  rejected: number;
  undecided: number;
  tags?: string[];
  updatedAt?: string | null;
};

type MetaEdge = { from: string; to: string; kind: EdgeKind; weight: number };
type Network = {
  scope: "public" | "following";
  version: number;
  rooms: RoomNode[];
  edges: MetaEdge[];
};

const KCOL: Record<EdgeKind, string> = {
  xref: "#6366f1",
  overlap: "#ef4444",
  stack_ref: "#f59e0b",
  imports: "#14b8a6",
  shared_author: "#64748b",
};
const KLBL: Record<EdgeKind, string> = {
  xref: "xref",
  overlap: "overlap",
  stack_ref: "stack",
  imports: "imports",
  shared_author: "authors",
};

type OrderBy = "recent" | "size" | "accept" | "alpha";
type SketchAction = EdgeKind | "transport";

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) => r.json());

/** ---------- utilities ---------- */
function usePersistentState<T>(key: string, initial: T) {
  const [state, set] = React.useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, set] as const;
}
function useDebounced<T>(value: T, ms = 150) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** ---------- Small presentational components ---------- */
function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded"
      style={{ background: color }}
    />
  );
}
function Chip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-[2px] rounded border"
      style={{ borderColor: color + "40", background: color + "12" }}
    >
      <Dot color={color} />
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function Donut({
  r = 18,
  acc,
  rej,
  und,
  tauShare,
  selected,
}: {
  r?: number;
  acc: number;
  rej: number;
  und: number;
  tauShare?: number | undefined | null;
  selected?: boolean;
}) {
  const L = (rad: number) => 2 * Math.PI * rad;
  const Ring = ({
    rad,
    col,
    w,
    share,
  }: {
    rad: number;
    col: string;
    w: number;
    share: number;
  }) => (
    <circle
      r={rad}
      stroke={col}
      strokeWidth={w}
      strokeDasharray={`${L(rad) * share} ${L(rad)}`}
      transform="rotate(-90)"
      fill="none"
      strokeLinecap="round"
      opacity={0.85}
    />
  );
  return (
    <svg
      width={(r + 20) * 2}
      height={(r + 20) * 2}
      viewBox={`${-(r + 20)} ${-(r + 20)} ${(r + 20) * 2} ${(r + 20) * 2}`}
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))" }}
    >
      {/* Soft glow/shadow behind */}
      <circle
        r={r + 2}
        fill={selected ? "rgba(167, 243, 208, 0.2)" : "rgba(186, 230, 253, 0.2)"}
        stroke="none"
      />
      
      {/* Main center circle with glass effect */}
      <circle
        r={r}
        fill={selected ? "rgba(209, 250, 229, 0.7)" : "rgba(224, 242, 254, 0.7)"}
        stroke={selected ? "rgba(167, 243, 208, 0.6)" : "rgba(186, 230, 253, 0.6)"}
        strokeWidth={1.5}
      />
      
      {/* Inner subtle gradient circle for depth */}
      <circle
        r={r * 0.6}
        fill={selected ? "rgba(236, 253, 245, 0.5)" : "rgba(240, 249, 255, 0.5)"}
        stroke="none"
      />
      
      {/* Acceptance ring - soft green/mint */}
      <Ring rad={r + 4} col="rgba(134, 239, 172, 0.8)" w={2.5} share={acc} />
      
      {/* Rejection ring - soft coral/rose */}
      <Ring rad={r + 8} col="rgba(252, 165, 165, 0.75)" w={2} share={rej} />
      
      {/* Undecided ring - soft lavender/gray */}
      <Ring rad={r + 12} col="rgba(203, 213, 225, 0.7)" w={2} share={und} />
      
      {/* Tau confidence ring - soft purple/violet */}
      {typeof tauShare === "number" && (
        <Ring rad={r + 16} col="rgba(196, 181, 253, 0.75)" w={2} share={tauShare} />
      )}
    </svg>
  );
}

/** ----------------------- Main ----------------------- */
export default function PlexusBoard({
  scope = "public",
  onLinkCreated,
}: {
  scope?: "public" | "following";
  onLinkCreated?: () => void;
}) {
  const { data, error, mutate } = useSWR<Network>(
    `/api/agora/network?scope=${scope}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { mode, tau } = useConfidence();
  const prefetch = useRoomGraphPrefetch();

  // NEW: centralized opener
  const openTransport = React.useCallback((fromId: string, toId: string) => {
    const url = `/functor/transport?from=${encodeURIComponent(
      fromId
    )}&to=${encodeURIComponent(toId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  // helper: open URL in new tab (for "sheet" new tab if you prefer later)
const openBlank = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

// helper: copy text to clipboard with fallback
async function copyText(s: string) {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      return true;
    } catch { return false; }
  }
}
// context menu state
const [menuOpen, setMenuOpen] = React.useState(false);
const [menuAt, setMenuAt] = React.useState<{ x:number; y:number }>({ x: 0, y: 0 });
const [menuRoomId, setMenuRoomId] = React.useState<string | null>(null);

// close menu on ESC / click outside
React.useEffect(() => {
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
  const onClick = () => setMenuOpen(false);
  if (menuOpen) {
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
  }
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('click', onClick);
  };
}, [menuOpen]);

  // τ‑gated cache (per room) re‑computed when confidence knobs change
  const gatedShare = React.useRef(new Map<string, number>());
  React.useEffect(() => {
    gatedShare.current.clear();
  }, [mode, tau]);

  const fetchGated = React.useCallback(
    async (rid: string) => {
      if (gatedShare.current.has(rid)) return gatedShare.current.get(rid)!;
      const gm = mode === "logodds" ? "product" : mode;
      const qs = new URLSearchParams({
        semantics: "preferred",
        mode: gm,
        ...(tau != null ? { confidence: String(tau) } : {}),
      });
      const r = await fetch(`/api/deliberations/${rid}/graph?` + qs, {
        cache: "no-store",
      }).catch(() => null);
      const g = await r?.json().catch(() => null);
      const total = Array.isArray(g?.nodes) ? g.nodes.length : 0;
      const inCount = total
        ? g.nodes.filter((n: any) => n.label === "IN").length
        : 0;
      const share = total ? inCount / total : 0;
      gatedShare.current.set(rid, share);
      return share;
    },
    [mode, tau]
  );

  /** ---------- UI state ---------- */
  const [qRaw, setQRaw] = usePersistentState<string>("plexus:board:q", "");
  const q = useDebounced(qRaw, 160);
  const [orderBy, setOrderBy] = usePersistentState<OrderBy>(
    "plexus:board:order",
    "recent"
  );
  const [sel, setSel] = usePersistentState<string | null>(
    "plexus:board:sel",
    null
  );
  const [source, setSource] = usePersistentState<string | null>(
    "plexus:board:source",
    null
  );

  const [linkMode, setLinkMode] = usePersistentState<boolean>(
    "plexus:board:linkMode",
    false
  );
  const [linkAction, setLinkAction] = usePersistentState<SketchAction>(
    "plexus:board:linkAction",
    "transport"
  );
  const [dragFrom, setDragFrom] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  // Build quick lookups
  const rooms = (data?.rooms ?? []).slice();
  const edges = (data?.edges ?? []).filter(
    (e: any) =>
      e &&
      e.kind !== "institutional_pathway" &&
      e.kind !== "pathway_response",
  ).slice();

  // Live refresh when system changes
  React.useEffect(() => {
    const bump = () => mutate();
    const evts = [
      "dialogue:changed",
      "xref:changed",
      "deliberations:created",
      "plexus:links:changed",
      "roomFunctor:changed",
    ];
    evts.forEach((t) => window.addEventListener(t, bump as any));
    return () =>
      evts.forEach((t) => window.removeEventListener(t, bump as any));
  }, [mutate]);

  // Edge counts per room & kind (undirected)
  const counts = new Map<string, Record<EdgeKind, number>>();
  function inc(id: string, k: EdgeKind) {
    const cur = counts.get(id) ?? {
      xref: 0,
      overlap: 0,
      stack_ref: 0,
      imports: 0,
      shared_author: 0,
    };
    cur[k]++;
    counts.set(id, cur);
  }
  for (const e of edges) {
    inc(e.from, e.kind);
    inc(e.to, e.kind);
  }

  // Tags
  const allTags = Array.from(
    new Set(rooms.flatMap((r) => r.tags ?? []))
  ).sort();
  const [tagFilter, setTagFilter] = usePersistentState<string[]>(
    "plexus:board:tags",
    []
  );
  const toggleTag = (t: string) =>
    setTagFilter((xs) =>
      xs.includes(t) ? xs.filter((y) => y !== t) : [...xs, t]
    );

  // Search + filter + order
  const qn = q.trim().toLowerCase();
  const filtered = rooms
    .filter(
      (r) =>
        !tagFilter.length || (r.tags ?? []).some((t) => tagFilter.includes(t))
    )
    .filter(
      (r) =>
        !qn ||
        (r.title ?? "").toLowerCase().includes(qn) ||
        r.id.toLowerCase().includes(qn)
    );

  const share = (r: RoomNode) => {
    const t = Math.max(1, r.accepted + r.rejected + r.undecided);
    return r.accepted / t;
  };
  const hash = (s: string) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  filtered.sort((a, b) => {
    if (orderBy === "recent") {
      const ta = a.updatedAt ? +new Date(a.updatedAt) : 0;
      const tb = b.updatedAt ? +new Date(b.updatedAt) : 0;
      return tb - ta;
    }
    if (orderBy === "size") return (b.nArgs | 0) - (a.nArgs | 0);
    if (orderBy === "accept") return share(b) - share(a);
    return (hash(a.id) % 1000) - (hash(b.id) % 1000);
  });

  // Neighborhood (1‑hop)
  const neighborsOf = React.useCallback(
    (id: string) => {
      const out = new Map<
        string,
        { kinds: Set<EdgeKind>; weights: number[] }
      >();
      for (const e of edges) {
        if (e.from === id) {
          const m = out.get(e.to) ?? {
            kinds: new Set<EdgeKind>(),
            weights: [],
          };
          m.kinds.add(e.kind);
          m.weights.push(e.weight);
          out.set(e.to, m);
        } else if (e.to === id) {
          const m = out.get(e.from) ?? {
            kinds: new Set<EdgeKind>(),
            weights: [],
          };
          m.kinds.add(e.kind);
          m.weights.push(e.weight);
          out.set(e.from, m);
        }
      }
      return Array.from(out.entries())
        .map(([rid, meta]) => ({
          id: rid,
          kinds: Array.from(meta.kinds),
          weight: meta.weights.reduce((a, b) => a + b, 0),
        }))
        .sort((a, b) => b.weight - a.weight);
    },
    [edges]
  );

  if (error)
    return <div className="text-xs text-red-600">Failed to load network</div>;
  if (!data) return <div className="text-xs text-neutral-500">Loading…</div>;

  /** ---------- link creation helper ---------- */
  async function createLink(
    kind: Exclude<EdgeKind, "overlap" | "shared_author">,
    fromId: string,
    toId: string
  ) {
    const r = await fetch("/api/agora/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, fromId, toId }),
    });
    if (!r.ok) throw new Error(await r.text());
    window.dispatchEvent(new CustomEvent("plexus:links:changed"));
    onLinkCreated?.();
  }

  /** ---------- render ---------- */
  return (
    <div className="rounded-xl border  about-flow  p-3">
      {/* Header */}
      <div  className="flex  items-center justify-between gap-3 mb-2">
        <div className="flex items-center  gap-2">
          <div className="text-sm font-medium px-3">Plexus • Board</div>
          <span className="text-xs text-slate-600">
            rooms {rooms.length}
          </span>
          <span className="text-xs text-slate-600">
            • links {edges.length}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <input
            value={qRaw}
            onChange={(e) => setQRaw(e.target.value)}
            placeholder="Search rooms…"
            className="px-2 py-1 text-[12px] rounded border bg-white/70"
            aria-label="Search rooms"
            id="plexus-board-search"
          />
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value as OrderBy)}
            className="px-2 py-1 text-[12px] rounded border bg-white/70"
            aria-label="Order"
          >
            <option value="recent">recent</option>
            <option value="size">size</option>
            <option value="accept">acceptance</option>
            <option value="alpha">α‑order</option>
          </select>

          {/* Link‑sketch controls */}
          <div className="hidden sm:flex items-center gap-2 pl-2 ml-2 border-l">
            <label className="text-[11px] inline-flex items-center gap-1">
              <input
                type="checkbox"
                className="accent-slate-600"
                checked={linkMode}
                onChange={(e) => setLinkMode(e.target.checked)}
              />
              Link mode
            </label>
            <select
              value={linkAction}
              onChange={(e) => setLinkAction(e.target.value as SketchAction)}
              className="px-2 py-1 text-[12px] rounded border bg-white/70"
              aria-label="Link action"
              title="What to do on drop"
            >
              <option value="transport">transport</option>
              <option value="xref">xref</option>
              <option value="stack_ref">stack_ref</option>
              <option value="imports">imports</option>
            </select>
          </div>
          {/* Clear source (only when a source exists) */}
{source && (
  <button
    className="px-2 py-1 text-[12px] rounded border bg-white/70 hover:bg-slate-50 ml-2"
    onClick={() => setSource(null)}
    title={`Clear source (${source.slice(0,6)}…)`}
  >
    clear source
  </button>
)}
        </div>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="text-[11px] text-slate-600 mr-1">Tags:</div>
          {allTags.map((t) => (
            <button
              key={t}
              className={clsx(
                "text-[11px] rounded-full px-2 py-[2px] border",
                tagFilter.includes(t)
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white hover:bg-slate-50"
              )}
              onClick={() => toggleTag(t)}
            >
              {t}
            </button>
          ))}
          {tagFilter.length > 0 && (
            <button
              className="text-[11px] underline ml-2"
              onClick={() => setTagFilter([])}
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((r) => {
          const t = Math.max(1, r.accepted + r.rejected + r.undecided);
          const acc = r.accepted / t,
            rej = r.rejected / t,
            und = r.undecided / t;
          const c = counts.get(r.id) ?? {
            xref: 0,
            overlap: 0,
            stack_ref: 0,
            imports: 0,
            shared_author: 0,
          };
          const selected = sel === r.id;
          const gated = tau != null ? gatedShare.current.get(r.id) : undefined;

          return (
            <div
              key={r.id}
              className={clsx(
                "rounded-lg border border-white/50 bg-white/30 backdrop-blur-xl p-2 flex shadow-[0px_0px_5px_rgba(165,180,252,0.6)] items-center gap-3 hover:bg-slate-100/40 relative",
                selected && "ring-[1.5px] ring-indigo-400/50",
                dragOver === r.id && "outline outline-2 outline-indigo-400"
              )}
              onContextMenu={(e) => {
  e.preventDefault();
  e.stopPropagation();
  setMenuRoomId(r.id);
  // keep within viewport a bit
  const pad = 8;
  const vw = window.innerWidth, vh = window.innerHeight;
  const x = Math.min(e.clientX, vw - 200 - pad);
  const y = Math.min(e.clientY, vh - 160 - pad);
  setMenuAt({ x, y });
  setMenuOpen(true);
}}
              onMouseEnter={() => {
                prefetch(r.id);
                if (tau != null && gated === undefined) fetchGated(r.id);
              }}
              onClick={() => setSel((cur) => (cur === r.id ? null : r.id))}
              onDragStart={(e) => {
  if (!linkMode) return;
  setDragFrom(r.id);
  e.dataTransfer.setData('text/plain', r.id);
  e.dataTransfer.effectAllowed = 'link';   // shows “link” affordance
}}
            // On the drop target card
onDragOver={(e) => {
  if (linkMode && dragFrom && dragFrom !== r.id) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';    // shows “link” affordance
  }
}}
              onDragEnter={(e) => {
                if (linkMode && dragFrom && dragFrom !== r.id)
                  setDragOver(r.id);
              }}
              // On the drag handle


              onDragLeave={() => {
                if (dragOver === r.id) setDragOver(null);
              }}
              onDrop={(e) => {
                if (!linkMode || !dragFrom || dragFrom === r.id) return;
                e.preventDefault();
                setDragOver(null);

                const fromId = dragFrom;
                const toId = r.id;

                try {
                  if (linkAction === "transport") {
                    // OPEN IN NEW TAB (same behavior as the buttons)
                    openTransport(fromId, toId);
                  } else if (
                    linkAction === "xref" ||
                    linkAction === "stack_ref" ||
                    linkAction === "imports"
                  ) {
                    // create xref / stack_ref / imports
                    createLink(linkAction, fromId, toId)
                      .then(() => alert(`Created ${linkAction} link`))
                      .catch((err) => {
                        console.error(err);
                        alert("Link failed");
                      });
                  }
                } finally {
                  setDragFrom(null);
                }
              }}
            >
              {/* Drag handle (Donut can be draggable in Link-mode) */}
              <div
                draggable={linkMode}
                onDragStart={(e) => {
                  if (!linkMode) return;
                  setDragFrom(r.id);
                  e.dataTransfer.setData("text/plain", r.id);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
                title={
                  linkMode
                    ? "Drag to another room to create a link / transport"
                    : undefined
                }
                className={clsx(
                  linkMode && "cursor-grab active:cursor-grabbing"
                )}
                aria-label={linkMode ? "Drag to create link" : undefined}
              >
                <Donut
                  r={18}
                  acc={acc}
                  rej={rej}
                  und={und}
                  tauShare={gated}
                  selected={selected}
                />
              </div>



              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium truncate"
                  title={r.title ?? r.id}
                >
                  {r.title ?? `room:${r.id.slice(0, 6)}…`}
                </div>
                <div className="text-[11px] text-slate-600">
                  args {r.nArgs} • edges {r.nEdges}{" "}
                  {r.updatedAt && (
                    <>• {new Date(r.updatedAt).toLocaleDateString()}</>
                  )}
                </div>

                {r.tags?.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.tags!.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1 rounded border bg-white"
                      >
                        {t}
                      </span>
                    ))}
                    {r.tags!.length > 4 && (
                      <span className="text-[10px] text-slate-500">
                        +{r.tags!.length - 4}
                      </span>
                    )}
                  </div>
                ) : null}

                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Chip color={KCOL.xref} label={KLBL.xref} value={c.xref} />
                  <Chip
                    color={KCOL.overlap}
                    label={KLBL.overlap}
                    value={c.overlap}
                  />
                  <Chip
                    color={KCOL.stack_ref}
                    label={KLBL.stack_ref}
                    value={c.stack_ref}
                  />
                  <Chip
                    color={KCOL.imports}
                    label={KLBL.imports}
                    value={c.imports}
                  />
                  <Chip
                    color={KCOL.shared_author}
                    label={KLBL.shared_author}
                    value={c.shared_author}
                  />
                </div>

                <div className="mt-2 flex gap-1">
                  <button
                    className="px-1.5 py-0.5 rounded border text-[12px] hover:bg-slate-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.assign(`/deliberation/${r.id}`);
                    }}
                  >
                    open
                  </button>
                  <button
                    className="px-1.5 py-0.5 rounded border text-[12px] hover:bg-slate-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.assign(`/sheets/delib:${r.id}`);
                    }}
                  >
                    sheet
                  </button>
                  {/* Source / Transport CTA (legacy footer) */}
{source ? (
  source !== r.id ? (
    <button
      className="px-1.5 py-0.5 rounded border text-[12px] hover:bg-slate-50"
      onClick={(e) => { e.stopPropagation(); openTransport(source, r.id); }}
      title={`Transport ${source.slice(0,4)}→${r.id.slice(0,4)} (opens in new tab)`}
    >
      transport {source.slice(0, 4)}→{r.id.slice(0, 4)}
    </button>
  ) : (
    <button
      className="px-1.5 py-0.5 rounded border text-[12px] hover:bg-slate-50"
      onClick={(e) => { e.stopPropagation(); setSource(null); }}
      title="Clear source"
    >
      clear source
    </button>
  )
) : (
  <button
    className="px-1.5 py-0.5 rounded border text-[12px] hover:bg-slate-50"
    onClick={(e) => { e.stopPropagation(); setSource(r.id); }}
    title="Set this room as the transport source"
  >
    set as source
  </button>
)}
                </div>
              </div>

              {/* Link-mode hint badge */}
              {linkMode && (
                <div className="absolute top-1 right-1 text-[10px] px-1.5 py-[1px] rounded bg-indigo-50 border border-indigo-200 text-indigo-700">
                  ◎
                </div>
              )}
              {/* Source badge (top-left) */}
{source === r.id && (
  <div className="absolute top-1 left-1 text-[10px] px-1.5 py-[1px] rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
    source
  </div>
)}
            </div>
          );
        })}
      </div>

      {/* Neighborhood panel (sticky) */}
      {sel &&
        (() => {
          const me = rooms.find((x) => x.id === sel)!;
          const nbrs = neighborsOf(sel);
          return (
            <div className="mt-3 rounded-lg border bg-white/80 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">
                  Neighborhood • {me.title ?? me.id.slice(0, 6) + "…"}
                </div>
                <button
                  className="text-[11px] underline"
                  onClick={() => setSel(null)}
                >
                  Close
                </button>
              </div>
              <ul className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {nbrs.map((n) => {
                  const r = rooms.find((x) => x.id === n.id)!;
                  const c = counts.get(r.id) ?? {
                    xref: 0,
                    overlap: 0,
                    stack_ref: 0,
                    imports: 0,
                    shared_author: 0,
                  };
                  const t = Math.max(1, r.accepted + r.rejected + r.undecided);
                  const acc = r.accepted / t,
                    rej = r.rejected / t,
                    und = r.undecided / t;
                  return (
                    <li
                      key={r.id}
                      className="rounded border p-2 flex items-center gap-2"
                    >
                      <Donut
                        r={12}
                        acc={acc}
                        rej={rej}
                        und={und}
                        selected={false}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium truncate">
                          {r.title ?? r.id}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          weight {n.weight}
                        </div>
                        <div className="mt-1 flex gap-1.5">
                          {n.kinds.map((k) => (
                            <Chip
                              key={k}
                              color={KCOL[k]}
                              label={KLBL[k]}
                              value={(c as any)[k] ?? 0}
                            />
                          ))}
                        </div>
                      </div>
                      <button
                        className="px-1.5 py-0.5 rounded border text-[11px] hover:bg-slate-50"
                        onClick={() =>
                          window.location.assign(`/deliberation/${r.id}`)
                        }
                      >
                        open
                      </button>
                    </li>
                  );
                })}
                {nbrs.length === 0 && (
                  <li className="text-[12px] text-slate-600">
                    No immediate neighbors.
                  </li>
                )}
              </ul>
            </div>
          );
        })()}
        {menuOpen && menuRoomId && (() => {
  const rid = menuRoomId;
  const isSource = source === rid;
  const canTransport = !!source && source !== rid;
  const dlUrl = `/deliberation/${rid}`;
  const sheetUrl = `/sheets/delib:${rid}`;

  return (
    <div
      className="fixed z-[9999] min-w-[180px] rounded-md border bg-white shadow-lg text-[13px] py-1"
      style={{ left: menuAt.x, top: menuAt.y }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      aria-label="Room actions"
    >
      <button
        className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
        onClick={() => { window.location.assign(dlUrl); setMenuOpen(false); }}
      >Open</button>

      <button
        className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
        onClick={() => { window.location.assign(sheetUrl); setMenuOpen(false); }}
      >Sheet</button>

      <button
        className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
        onClick={async () => {
          const ok = await copyText(`${window.location.origin}${dlUrl}`);
          setMenuOpen(false);
          alert(ok ? 'Link copied' : 'Copy failed');
        }}
      >Copy link</button>

      <div className="my-1 h-px bg-slate-200/70" />

      {!isSource ? (
        <button
          className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
          onClick={() => { setSource(rid); setMenuOpen(false); }}
        >Set as source</button>
      ) : (
        <button
          className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
          onClick={() => { setSource(null); setMenuOpen(false); }}
        >Clear source</button>
      )}

      <button
        disabled={!canTransport}
        className={clsx(
          'w-full text-left px-3 py-1.5',
          canTransport ? 'hover:bg-slate-50' : 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => {
          if (!source || source === rid) return;
          openTransport(source, rid);
          setMenuOpen(false);
        }}
      >Transport here {source ? `(${source.slice(0,4)}→${rid.slice(0,4)})` : ''}</button>
    </div>
  );
})()}
    </div>
    
  );
}
