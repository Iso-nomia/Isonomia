"use client";

/**
 * Graph — a quiet map of the writer's entries.
 *
 * Two layouts, same data:
 *
 *   Chronicle  (default) — entries laid out on a horizontal time
 *                spine. Arcs above the spine are explicit cross-
 *                references; arcs below are thread continuity. Older
 *                entries fade toward stone-300; newer toward stone-700.
 *                Legible at any N, makes recency immediate, matches
 *                the journal's chronological grain.
 *
 *   Constellation — Fruchterman-Reingold force-directed scatter.
 *                Useful at N > 50 or so when the chronicle gets
 *                dense. A snapshot, not an animation: ~320 iterations
 *                run once on data change, then settles.
 *
 * Visual register
 * ---------------
 *  • Monochromatic stone palette. No color encoding for genre.
 *  • Hairlines, not strokes. Solid stone-400 for cross-references,
 *    dashed stone-300 for thread continuity. Hover edges glow amber.
 *  • Filled dots are placed (in some thread, source, or link).
 *    Open dots are orphans — entries that have not yet found their
 *    place. The graph's distinctive surfacing.
 *  • Click navigates to the entry. The graph never edits state.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Genre =
  | "FRAGMENT"
  | "EXCERPT"
  | "OBSERVATION"
  | "MEDITATION"
  | "DIALOGUE"
  | "LETTER"
  | "LIST"
  | "POEM";

type Node = {
  id: string;
  genre: Genre;
  threadId: string | null;
  sourceId: string | null;
  snippet: string;
  createdAt: string; // ISO
  isOrphan: boolean;
};

type LinkEdge = { id: string; from: string; to: string; type: string };
type ThreadEdge = { fromId: string; toId: string };

type Props = {
  nodes: Node[];
  links: LinkEdge[];
  threads: ThreadEdge[];
};

type Pos = { x: number; y: number };
type Layout = "chronicle" | "constellation";

const WIDTH = 760;
const CHRONICLE_HEIGHT = 320;
const CONSTELLATION_HEIGHT = 520;
const NODE_RADIUS = 4;
const HOVER_RADIUS = 7;
const PADDING_X = 32;
const SPINE_Y = CHRONICLE_HEIGHT / 2;
const LANE_GAP = 16;

// ─── Color helpers ──────────────────────────────────────

// stone-300 (#d6d3d1) → stone-700 (#44403c) by recency rank.
function recencyColor(t: number): string {
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(0xd6, 0x44)},${lerp(0xd3, 0x40)},${lerp(0xd1, 0x3c)})`;
}

// ─── Layout: chronicle ──────────────────────────────────

function chronicleLayout(nodes: Node[]): Map<string, Pos> {
  const positions = new Map<string, Pos>();
  if (nodes.length === 0) return positions;

  const sorted = [...nodes].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const tMin = new Date(sorted[0].createdAt).getTime();
  const tMax = new Date(sorted[sorted.length - 1].createdAt).getTime();
  const span = Math.max(tMax - tMin, 1);

  // Bucket by x-pixel to detect collisions; assign lanes that
  // alternate +/- around the spine so dense periods grow vertically
  // without losing the spine's visual primacy.
  const BUCKET = 14;
  const lanesByBucket = new Map<number, number[]>();

  for (const n of sorted) {
    const x =
      PADDING_X +
      ((new Date(n.createdAt).getTime() - tMin) / span) *
        (WIDTH - 2 * PADDING_X);
    const bucket = Math.round(x / BUCKET);
    const used = lanesByBucket.get(bucket) ?? [];
    let lane = 0;
    while (used.includes(lane)) lane++;
    used.push(lane);
    lanesByBucket.set(bucket, used);

    // Lane → y offset: 0, +1, -1, +2, -2, …
    let yOffset = 0;
    if (lane > 0) {
      const sign = lane % 2 === 1 ? 1 : -1;
      const mag = Math.ceil(lane / 2);
      yOffset = sign * mag * LANE_GAP;
    }
    positions.set(n.id, { x, y: SPINE_Y + yOffset });
  }
  return positions;
}

// ─── Layout: constellation (Fruchterman-Reingold) ───────

function constellationLayout(
  nodes: Node[],
  edges: { from: string; to: string }[],
): Map<string, Pos> {
  const n = nodes.length;
  const positions = new Map<string, Pos>();
  if (n === 0) return positions;

  let seed = 1;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (const node of nodes) {
    positions.set(node.id, {
      x: rand() * WIDTH,
      y: rand() * CONSTELLATION_HEIGHT,
    });
  }

  const ITERATIONS = 320;
  const area = WIDTH * CONSTELLATION_HEIGHT;
  const k = Math.sqrt(area / n);
  let temp = WIDTH / 10;
  const cooling = temp / ITERATIONS;
  const edgeList = edges.filter(
    (e) => positions.has(e.from) && positions.has(e.to),
  );

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const disp = new Map<string, Pos>();
    for (const node of nodes) disp.set(node.id, { x: 0, y: 0 });

    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      const pa = positions.get(a.id)!;
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        const pb = positions.get(b.id)!;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const da = disp.get(a.id)!;
        const db = disp.get(b.id)!;
        da.x += fx;
        da.y += fy;
        db.x -= fx;
        db.y -= fy;
      }
    }
    for (const e of edgeList) {
      const pa = positions.get(e.from)!;
      const pb = positions.get(e.to)!;
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const da = disp.get(e.from)!;
      const db = disp.get(e.to)!;
      da.x -= fx;
      da.y -= fy;
      db.x += fx;
      db.y += fy;
    }
    for (const node of nodes) {
      const p = positions.get(node.id)!;
      const d = disp.get(node.id)!;
      const dist = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
      const cap = Math.min(dist, temp);
      p.x += (d.x / dist) * cap;
      p.y += (d.y / dist) * cap;
      p.x = Math.max(NODE_RADIUS + 4, Math.min(WIDTH - NODE_RADIUS - 4, p.x));
      p.y = Math.max(
        NODE_RADIUS + 4,
        Math.min(CONSTELLATION_HEIGHT - NODE_RADIUS - 4, p.y),
      );
    }
    temp = Math.max(temp - cooling, 0.5);
  }
  return positions;
}

// ─── Path helper for chronicle arcs ─────────────────────

function arcPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  above: boolean,
): string {
  const mx = (x1 + x2) / 2;
  const dx = Math.abs(x2 - x1);
  const lift = Math.min(140, dx * 0.45 + 30);
  const cy = above ? Math.min(y1, y2) - lift : Math.max(y1, y2) + lift;
  return `M ${x1} ${y1} Q ${mx} ${cy} ${x2} ${y2}`;
}

// ─── Connection composer constants ──────────────────────

type LinkType =
  | "REFERENCE"
  | "DEVELOPS"
  | "RESPONDS_TO"
  | "CONTRADICTS"
  | "SHARED_SOURCE";

const LINK_TYPES: { value: LinkType; verb: string; key: string }[] = [
  { value: "REFERENCE", verb: "references", key: "r" },
  { value: "DEVELOPS", verb: "develops", key: "d" },
  { value: "RESPONDS_TO", verb: "responds to", key: "a" },
  { value: "CONTRADICTS", verb: "contradicts", key: "c" },
  { value: "SHARED_SOURCE", verb: "shares a source with", key: "s" },
];

// ─── Component ──────────────────────────────────────────

export default function Graph({ nodes, links, threads }: Props) {
  const router = useRouter();
  const [layout, setLayout] = useState<Layout>("chronicle");
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<Pos | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Shift-click connection state
  const [selected, setSelected] = useState<string[]>([]);
  const [composer, setComposer] = useState<
    | { from: Node; to: Node }
    | null
  >(null);
  const [relation, setRelation] = useState<LinkType>("REFERENCE");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [localLinks, setLocalLinks] = useState<LinkEdge[]>([]);

  const allLinks = useMemo(
    () => [...links, ...localLinks],
    [links, localLinks],
  );

  const positions = useMemo(() => {
    if (layout === "chronicle") return chronicleLayout(nodes);
    return constellationLayout(nodes, [
      ...allLinks.map((l) => ({ from: l.from, to: l.to })),
      ...threads.map((t) => ({ from: t.fromId, to: t.toId })),
    ]);
  }, [layout, nodes, allLinks, threads]);

  // Recency rank: 0 (oldest) → 1 (newest), used as the fade weight
  // for node fill in chronicle layout. Constellation ignores it
  // because temporal axis is no longer meaningful there.
  const recencyRank = useMemo(() => {
    const r = new Map<string, number>();
    if (nodes.length <= 1) {
      for (const n of nodes) r.set(n.id, 1);
      return r;
    }
    const sorted = [...nodes].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    sorted.forEach((n, i) => r.set(n.id, i / (sorted.length - 1)));
    return r;
  }, [nodes]);

  const nodeById = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const neighbors = useMemo(() => {
    if (!hovered) return new Set<string>();
    const s = new Set<string>();
    for (const l of allLinks) {
      if (l.from === hovered) s.add(l.to);
      if (l.to === hovered) s.add(l.from);
    }
    for (const t of threads) {
      if (t.fromId === hovered) s.add(t.toId);
      if (t.toId === hovered) s.add(t.fromId);
    }
    return s;
  }, [hovered, allLinks, threads]);

  const isHighlighted = (from: string, to: string) =>
    hovered !== null && (from === hovered || to === hovered);

  const orphanCount = useMemo(
    () => nodes.filter((n) => n.isOrphan).length,
    [nodes],
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const closeComposer = () => {
    setComposer(null);
    setSelected([]);
    setRelation("REFERENCE");
    setNote("");
    setComposerError(null);
    setSaving(false);
  };

  const handleNodeClick = (e: React.MouseEvent, n: Node) => {
    if (!e.shiftKey) {
      router.push(`/entry/${n.id}`);
      return;
    }
    e.preventDefault();
    // Shift-click: toggle into selection.
    setSelected((prev) => {
      if (prev.includes(n.id)) return prev.filter((id) => id !== n.id);
      const next = [...prev, n.id].slice(-2);
      if (next.length === 2) {
        const fromNode = nodeById.get(next[0]);
        const toNode = nodeById.get(next[1]);
        if (fromNode && toNode) {
          setComposer({ from: fromNode, to: toNode });
          setComposerError(null);
        }
        return [];
      }
      return next;
    });
  };

  const submitConnection = async () => {
    if (!composer) return;
    setSaving(true);
    setComposerError(null);
    try {
      const res = await fetch(`/api/entries/${composer.from.id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toId: composer.to.id,
          type: relation,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 || data?.error === "duplicate_link") {
          setComposerError("Already connected.");
        } else {
          setComposerError(data?.error || "Could not save.");
        }
        setSaving(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      const newId =
        (data && (data.id || data.link?.id)) ||
        `local-${composer.from.id}-${composer.to.id}-${Date.now()}`;
      setLocalLinks((prev) => [
        ...prev,
        {
          id: newId,
          from: composer.from.id,
          to: composer.to.id,
          type: relation,
        },
      ]);
      closeComposer();
    } catch {
      setComposerError("Could not save.");
      setSaving(false);
    }
  };

  // Keyboard: relation letters, Enter to submit, Escape to cancel.
  useEffect(() => {
    if (!composer) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeComposer();
        return;
      }
      if (ev.key === "Enter" && !saving) {
        // Don't intercept Enter inside the note textarea (shift+enter for newline already free).
        const target = ev.target as HTMLElement | null;
        if (target && target.tagName === "TEXTAREA") return;
        ev.preventDefault();
        void submitConnection();
        return;
      }
      const target = ev.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      const match = LINK_TYPES.find((t) => t.key === ev.key.toLowerCase());
      if (match) {
        ev.preventDefault();
        setRelation(match.value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composer, saving, relation, note]);

  if (nodes.length === 0) {
    return (
      <p className="font-sans text-sm text-stone-500">
        No entries yet. The graph populates as you write.
      </p>
    );
  }

  const hoveredNode = hovered ? nodeById.get(hovered) ?? null : null;
  const isChronicle = layout === "chronicle";
  const height = isChronicle ? CHRONICLE_HEIGHT : CONSTELLATION_HEIGHT;

  return (
    <div className="space-y-3">
      {/* View toggle — text only, current state underlined. */}
      <div className="flex items-baseline gap-4 font-sans text-xs text-stone-500">
        <button
          type="button"
          onClick={() => setLayout("chronicle")}
          className={
            isChronicle
              ? "text-stone-900 underline underline-offset-4"
              : "hover:text-stone-900"
          }
        >
          Chronicle
        </button>
        <button
          type="button"
          onClick={() => setLayout("constellation")}
          className={
            !isChronicle
              ? "text-stone-900 underline underline-offset-4"
              : "hover:text-stone-900"
          }
        >
          Constellation
        </button>
      </div>

      <div ref={containerRef} className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="w-full"
          style={{ aspectRatio: `${WIDTH} / ${height}` }}
        >
          {/* Spine — only visible in chronicle. A single hairline
              that anchors the view; the dots sit on it. */}
          {isChronicle && (
            <line
              x1={PADDING_X}
              y1={SPINE_Y}
              x2={WIDTH - PADDING_X}
              y2={SPINE_Y}
              stroke="#e7e5e4"
              strokeWidth={1}
            />
          )}

          {/* Thread edges */}
          <g fill="none">
            {threads.map((t, i) => {
              const a = positions.get(t.fromId);
              const b = positions.get(t.toId);
              if (!a || !b) return null;
              const high = isHighlighted(t.fromId, t.toId);
              const stroke = high ? "#b45309" : "#d6d3d1";
              const sw = high ? 1.25 : 0.75;
              if (isChronicle) {
                return (
                  <path
                    key={`t-${i}`}
                    d={arcPath(a.x, a.y, b.x, b.y, false)}
                    stroke={stroke}
                    strokeWidth={sw}
                    strokeDasharray="2 3"
                  />
                );
              }
              return (
                <line
                  key={`t-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeDasharray="2 3"
                />
              );
            })}
          </g>

          {/* Cross-reference edges */}
          <g fill="none">
            {allLinks.map((l) => {
              const a = positions.get(l.from);
              const b = positions.get(l.to);
              if (!a || !b) return null;
              const high = isHighlighted(l.from, l.to);
              const stroke = high ? "#b45309" : "#a8a29e";
              const sw = high ? 1.5 : 0.85;
              if (isChronicle) {
                return (
                  <path
                    key={l.id}
                    d={arcPath(a.x, a.y, b.x, b.y, true)}
                    stroke={stroke}
                    strokeWidth={sw}
                  />
                );
              }
              return (
                <line
                  key={l.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={stroke}
                  strokeWidth={sw}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {nodes.map((n) => {
              const p = positions.get(n.id);
              if (!p) return null;
              const isHover = hovered === n.id;
              const isNeighbor = neighbors.has(n.id);
              const isSelected = selectedSet.has(n.id);
              const isFaded =
                hovered !== null && !isHover && !isNeighbor && !isSelected;
              const t = isChronicle ? (recencyRank.get(n.id) ?? 1) : 1;
              const baseFill = isHover
                ? "#b45309"
                : isNeighbor
                  ? "#44403c"
                  : recencyColor(t);
              return (
                <g key={n.id}>
                  {isSelected && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={HOVER_RADIUS + 2}
                      fill="none"
                      stroke="#b45309"
                      strokeWidth={1.25}
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHover || isSelected ? HOVER_RADIUS : NODE_RADIUS}
                    fill={n.isOrphan ? "#fafaf9" : baseFill}
                    stroke={n.isOrphan ? baseFill : "none"}
                    strokeWidth={n.isOrphan ? 1 : 0}
                    opacity={isFaded ? 0.25 : 1}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => {
                      setHovered(n.id);
                      setTooltipPos({ x: p.x, y: p.y });
                    }}
                    onMouseLeave={() => {
                      setHovered(null);
                      setTooltipPos(null);
                    }}
                    onClick={(e) => handleNodeClick(e, n)}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {hoveredNode && tooltipPos && (
          <div
            className="pointer-events-none absolute max-w-xs rounded border border-stone-300 bg-white px-3 py-2 font-sans text-xs text-stone-700 shadow-sm"
            style={{
              left: `${(tooltipPos.x / WIDTH) * 100}%`,
              top: `${(tooltipPos.y / height) * 100}%`,
              transform: "translate(12px, 12px)",
            }}
          >
            <div className="uppercase tracking-wide text-stone-400">
              {hoveredNode.genre.toLowerCase()}
              {hoveredNode.isOrphan && (
                <span className="ml-2 text-stone-500">· orphan</span>
              )}
            </div>
            <div className="mt-1 text-stone-800">
              {hoveredNode.snippet || "(empty)"}
            </div>
          </div>
        )}

        {/* Selection hint — appears once one node is shift-picked. */}
        {selected.length === 1 && !composer && (
          <div className="pointer-events-none absolute left-2 top-2 rounded border border-amber-700/30 bg-white/90 px-2 py-1 font-sans text-xs text-stone-600">
            Shift-click another entry to draw a connection.
            <button
              type="button"
              onClick={() => setSelected([])}
              className="pointer-events-auto ml-2 text-stone-400 hover:text-stone-700"
              aria-label="Cancel selection"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Connection composer */}
      {composer && (
        <div className="rounded border border-stone-300 bg-stone-50 p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-sans text-sm text-stone-900">
              Draw a connection
            </h3>
            <button
              type="button"
              onClick={closeComposer}
              className="font-sans text-xs text-stone-500 hover:text-stone-900"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-2 font-serif text-sm text-stone-700">
            <div>
              <span className="font-sans text-xs uppercase tracking-wide text-stone-400">
                {composer.from.genre.toLowerCase()}
              </span>{" "}
              <span>{composer.from.snippet || "(empty)"}</span>
            </div>
            <div className="font-sans text-xs italic text-stone-500">
              {LINK_TYPES.find((t) => t.value === relation)?.verb}
            </div>
            <div>
              <span className="font-sans text-xs uppercase tracking-wide text-stone-400">
                {composer.to.genre.toLowerCase()}
              </span>{" "}
              <span>{composer.to.snippet || "(empty)"}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 font-sans text-xs">
            {LINK_TYPES.map((t) => {
              const active = relation === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setRelation(t.value)}
                  className={
                    active
                      ? "text-amber-700 underline underline-offset-4"
                      : "text-stone-500 hover:text-stone-900"
                  }
                  title={`Press ${t.key}`}
                >
                  {t.verb}
                  <span className="ml-1 text-stone-400">[{t.key}]</span>
                </button>
              );
            })}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this connection? (optional)"
            rows={2}
            className="w-full resize-none border border-stone-300 bg-white px-2 py-1 font-serif text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
          />

          {composerError && (
            <p className="font-sans text-xs text-rose-700">{composerError}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void submitConnection()}
              disabled={saving}
              className="font-sans text-xs text-amber-700 hover:underline disabled:text-stone-400"
            >
              {saving ? "Saving…" : "Save connection"}
            </button>
            <span className="font-sans text-xs italic text-stone-400">
              ↵ to save · esc to cancel
            </span>
          </div>
        </div>
      )}

      {/* Caption — italic serif annotation under the figure. The
          numbers below are the chrome; this is the figure's voice. */}
      <p className="font-serif italic text-sm text-stone-500">
        {isChronicle
          ? "Time runs left to right. Older entries fade; the present is dark."
          : "A force-settled scatter. Clusters are the signal."}
      </p>

      {/* Stats bar */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-sans text-xs text-stone-500">
        <span>
          {nodes.length} {nodes.length === 1 ? "entry" : "entries"}
        </span>
        <span>·</span>
        <span>
          {allLinks.length}{" "}
          {allLinks.length === 1 ? "cross-reference" : "cross-references"}
        </span>
        <span>·</span>
        <span>
          {threads.length}{" "}
          {threads.length === 1
            ? "thread continuity"
            : "thread continuities"}
        </span>
        {orphanCount > 0 && (
          <>
            <span>·</span>
            <Link
              href="/read"
              className="text-stone-700 hover:text-stone-900 hover:underline"
              title="Entries with no thread, source, or connection"
            >
              {orphanCount} {orphanCount === 1 ? "orphan" : "orphans"}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
