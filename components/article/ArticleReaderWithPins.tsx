"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ArticleReader from "@/components/article/ArticleReader";
import CommentModal from "@/components/article/CommentModal";
import type { Anchor, CommentThread } from "@/types/comments";
import Image from "next/image";
import DeepDivePanel from "../deepdive/DeepDivePanelV2";
import { useRouter } from "next/navigation";
import HomeButton from "../buttons/HomeButton";
import { RhetoricProvider } from "../rhetoric/RhetoricContext";
import { DeepDiveBackdrop } from "./DeepDiveBackground";
import { DialogueTargetProvider } from "@/components/dialogue/DialogueTargetContext";
import { SWRConfig } from 'swr';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PropositionComposerPro } from "@/components/propositions/PropositionComposerPro";


/* ----------------------- DOM ↔ anchor helpers ----------------------- */

/* ---------- Selection helpers (clean) ---------- */
const PIN_Y_TWEAK = 0; // try +2 or -2 if your type scale changes

function getAnchorCenterTop(anchor: Anchor, root: HTMLElement): number | null {
  const rects = getAnchorRects(anchor, root);
  const first = rects[0];
  if (!first) return null;
  return first.top + first.height / 2;
}

function firstTextNodeWithin(
  node: Node,
  dir: "forward" | "backward" = "forward"
): Text | null {
  if (node.nodeType === Node.TEXT_NODE) return node as Text;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  if (dir === "forward") return (walker.nextNode() as Text) ?? null;
  let last: Text | null = null;
  while (walker.nextNode()) last = walker.currentNode as Text;
  return last;
}

function nodePathFromRoot(root: Node, target: Node): number[] {
  const path: number[] = [];
  let n: Node | null = target;
  while (n && n !== root) {
    const p: (Node & ParentNode) | null = n.parentNode;
    if (!p) break;
    const idx = Array.prototype.indexOf.call(p.childNodes, n);
    path.unshift(idx);
    n = p;
  }
  return path;
}

function findTextForwardFromBoundary(
  root: Node,
  container: Node,
  offset: number
): { node: Text; offset: number } | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const t = container as Text;
    return { node: t, offset: Math.min(offset, t.data.length) };
  }
  // prefer first text inside child at the boundary (to the right)
  const child = container.childNodes[offset] ?? null;
  if (child) {
    const t = firstTextNodeWithin(child, "forward");
    if (t) return { node: t, offset: 0 };
  }
  // walk forward in DOM order
  let n: Node | null = child ?? container.nextSibling;
  while (n) {
    const t = firstTextNodeWithin(n, "forward");
    if (t) return { node: t, offset: 0 };
    n = n.nextSibling;
  }
  // fallback: first text within container
  const t = firstTextNodeWithin(container, "forward");
  return t ? { node: t, offset: 0 } : null;
}

function findTextBackwardFromBoundary(
  root: Node,
  container: Node,
  offset: number
): { node: Text; offset: number } | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const t = container as Text;
    return { node: t, offset: Math.min(offset, t.data.length) };
  }
  // prefer last text inside the child just before boundary (to the left)
  let i = offset - 1;
  while (i >= 0) {
    const t = firstTextNodeWithin(container.childNodes[i], "backward");
    if (t) return { node: t, offset: t.data.length };
    i--;
  }
  // fallback: last text within container
  const t = firstTextNodeWithin(container, "backward");
  return t ? { node: t, offset: t.data.length } : null;
}

function normalizeRangeToTextNodes(root: HTMLElement, r: Range) {
  // Prefer going FORWARD for both ends; if end can’t, fall back backward.
  const s = findTextForwardFromBoundary(root, r.startContainer, r.startOffset);
  const e =
    findTextForwardFromBoundary(root, r.endContainer, r.endOffset) ??
    findTextBackwardFromBoundary(root, r.endContainer, r.endOffset);
  if (!s || !e) return null;
  return {
    start: s.node,
    startOffset: s.offset,
    end: e.node,
    endOffset: e.offset,
  };
}

function buildAnchorFromSelection(
  root: HTMLElement,
  sel: Selection
): { anchor: Anchor; rect: DOMRect } | null {
  if (!sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (r.collapsed) return null;

  const norm = normalizeRangeToTextNodes(root, r);
  if (!norm) return null;

  const { start, startOffset, end, endOffset } = norm;
  const startPath = nodePathFromRoot(root, start);
  const endPath = nodePathFromRoot(root, end);

  const rect = r.getBoundingClientRect();
  const base = root.getBoundingClientRect();
  const localRect = new DOMRect(
    rect.left - base.left,
    rect.top - base.top,
    rect.width,
    rect.height
  );

  const anchor: Anchor = { startPath, startOffset, endPath, endOffset };
  return { anchor, rect: localRect };
}

function getAnchorStartRect(anchor: Anchor, root: HTMLElement): DOMRect | null {
  let node: Node | null = root;
  for (const idx of anchor.startPath) node = node?.childNodes[idx] ?? null;
  if (!node) return null;
  const text =
    node.nodeType === Node.TEXT_NODE
      ? (node as Text)
      : firstTextNodeWithin(node);
  if (!text) return null;

  const range = document.createRange();
  range.setStart(text, anchor.startOffset);
  range.setEnd(text, anchor.startOffset);
  const rect = range.getClientRects()[0];
  if (!rect) return null;

  const base = root.getBoundingClientRect();
  return new DOMRect(
    rect.left - base.left,
    rect.top - base.top,
    rect.width,
    rect.height
  );
}

function getAnchorRects(anchor: Anchor, root: HTMLElement): DOMRect[] {
  // full selection rects (for overlays)
  let s: Node | null = root;
  for (const i of anchor.startPath) s = s?.childNodes[i] ?? null;
  let e: Node | null = root;
  for (const i of anchor.endPath) e = e?.childNodes[i] ?? null;
  if (!s || !e) return [];
  const start =
    s.nodeType === Node.TEXT_NODE ? (s as Text) : firstTextNodeWithin(s);
  const end =
    e.nodeType === Node.TEXT_NODE
      ? (e as Text)
      : firstTextNodeWithin(e, "backward");
  if (!start || !end) return [];

  const r = document.createRange();
  r.setStart(start, anchor.startOffset);
  r.setEnd(end, anchor.endOffset);

  const base = root.getBoundingClientRect();
  return Array.from(r.getClientRects()).map(
    (rect) =>
      new DOMRect(
        rect.left - base.left,
        rect.top - base.top,
        rect.width,
        rect.height
      )
  );
}

type Cluster = { top: number; items: string[] }; // ids

function clusterByTop(
  positions: Record<string, DOMRect | undefined>,
  threshold = 40
): Cluster[] {
  const entries = Object.entries(positions)
    .filter(([, r]) => r)
    .map(([id, r]) => ({ id, top: r!.top }))
    .sort((a, b) => a.top - b.top);

  const clusters: Cluster[] = [];
  for (const e of entries) {
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(e.top - last.top) > threshold) {
      clusters.push({ top: e.top, items: [e.id] });
    } else {
      last.items.push(e.id);
      // nudge centroid slightly
      last.top =
        (last.top * (last.items.length - 1) + e.top) / last.items.length;
    }
  }
  return clusters;
}

function CommentRail({
  threads,
  positions,
  openId,
  setOpenId,
  onSelect,
  offsetTop = 0,
}: {
  threads: CommentThread[];
  positions: Record<string, DOMRect | undefined>;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onSelect: (thread: CommentThread) => void;
  offsetTop?: number;
}) {
  // one-line items, collision-resolved
  // bump minGap from 18 → 22 for a touch more air
  const items = solveCollisions(
    threads.map((t) => ({ id: t.id, top: positions[t.id]?.top ?? 0, left: 0 })),
    28
  );

  return (
    <div className="relative min-h-[1px] h-full">
      {items.map((p) => {
        const t = threads.find((x) => x.id === p.id)!;
        const active = openId === t.id;

        const firstLine = t.comments[0]?.body ?? "";
        return (
          // <div className="space-y-4 gap-4 h-full">
          // <button
          //   key={t.id}
          //   className={`absolute right-0 translate-y-[-50%] truncate w-full text-left m-2
          <div key={t.id} className="space-y-4 gap-4 h-full">
            <button
              className={`absolute right-0 translate-y-[-50%] flex justify-start items-center text-left mr-6 w-[170px] 
                       text-[11px] px-2 py-1 text-slate-700 rounded-md btnv2  btnv2--comment"
                       
                       ${
                         active
                           ? "btnv2  ring-indigo-400/50 ring-2 ring-offset-0  text-left"
                           : "btnv2    text-left"
                       }`}
              style={{ top: p.top + offsetTop }}
              onClick={() => {
                onSelect(t);
              }}
              title={firstLine}
              
            >
             <span className="truncate"> {firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine} </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

type PinPos = { id: string; top: number; left: number };
function solveCollisions(items: PinPos[], minGap = 18): PinPos[] {
  const sorted = [...items].sort((a, b) => a.top - b.top);
  let last = -Infinity;
  for (const p of sorted) {
    if (p.top < last + minGap) p.top = last + minGap;
    last = p.top;
  }
  return sorted;
}

/* ---------------------------- Component ----------------------------- */

type Props = {
  template: string;
  heroSrc?: string | null;
  html: string;
  threads: CommentThread[];
  articleSlug: string; // 👈 for API calls
  title?: string; // ⬅️ new
  currentUser?: unknown;
  deliberationId?: string;
};

export default function ArticleReaderWithPins({
  template,
  heroSrc,
  html,
  threads: initialThreads,
  articleSlug,
  title,
  deliberationId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null); // 👈 NEW
  const railRef = useRef<HTMLDivElement>(null); // NEW
  const [railHeight, setRailHeight] = useState<number>(0); // NEW
  const [railOffsetTop, setRailOffsetTop] = useState<number>(0); // NEW
  const leftGutterRef = useRef<HTMLDivElement>(null); // NEW
  const [gutterOffsetTop, setGutterOffsetTop] = useState<number>(0); // NEW
  const [openId, setOpenId] = useState<string | null>(null);
  const [threads, setThreads] = useState<CommentThread[]>(initialThreads);
  const [activeThread, setActiveThread] = useState<CommentThread | null>(null);
  const [tick, setTick] = useState(0);
  const GUTTER = 100; // px

  const router = useRouter();
  function goHome() {
    router.push("/");
  }

  const [hoverId, setHoverId] = useState<string | null>(null);
  const [adder, setAdder] = useState<{ anchor: Anchor; rect: DOMRect; text: string } | null>(
    null
  );
  const [selectionRects, setSelectionRects] = useState<DOMRect[] | null>(null); // visual highlight
  const scrollToThread = (t: CommentThread) => {
    const root = containerRef.current;
    if (!root) return;
    const rects = getAnchorRects(t.anchor, root);
    const first = rects[0];
    if (!first) return;
    const rootBox = root.getBoundingClientRect();
    const y = window.scrollY + rootBox.top + first.top - 350; // 120px viewport padding
    window.scrollTo({ top: y, behavior: "smooth" });
  };
  const rectsByThread = useMemo(() => {
    const root = containerRef.current;
    if (!root) return {} as Record<string, DOMRect[]>;
    const map: Record<string, DOMRect[]> = {};
    for (const t of threads) map[t.id] = getAnchorRects(t.anchor, root);
    return map;
  }, [threads, html, tick]);
  // selection bubble state
  const [bubble, setBubble] = useState<{
    anchor: Anchor;
    rect: DOMRect;
    text: string;
  } | null>(null);
  const [draftBody, setDraftBody] = useState("");

  // claim composer dialog state
  const [claimComposerOpen, setClaimComposerOpen] = useState(false);
  const [claimComposerInitialText, setClaimComposerInitialText] = useState("");
  const [claimComposerAnchor, setClaimComposerAnchor] = useState<Anchor | null>(null);

  // recalc on scroll/resize
  useEffect(() => {
    const ro = new ResizeObserver(() => setTick((t) => t + 1));
    const onScroll = () => setTick((t) => t + 1);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Measure rail height and vertical offset so the right rail aligns to article
  useEffect(() => {
    let scheduled = false;

    const updateRailMetrics = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;

        const root = containerRef.current; // article box
        const anchor = railAnchorRef.current; // stable flow anchor
        if (!root || !anchor) return;

        // 1) Match rail height to article height
        setRailHeight(root.offsetHeight);

        // 2) Vertical delta between article and anchor
        const rootTop = root.getBoundingClientRect().top + window.scrollY;
        const anchorTop = anchor.getBoundingClientRect().top + window.scrollY;
        setRailOffsetTop(rootTop - anchorTop);

        // (optional) If you still use left gutter offset:
        const gutter = leftGutterRef.current;
        if (gutter) {
          const gutTop = gutter.getBoundingClientRect().top + window.scrollY;
          setGutterOffsetTop(rootTop - gutTop);
        }
      });
    };

    updateRailMetrics();

    const ro = new ResizeObserver(updateRailMetrics);
    if (containerRef.current) ro.observe(containerRef.current);

    window.addEventListener("scroll", updateRailMetrics, { passive: true });
    window.addEventListener("resize", updateRailMetrics);

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", updateRailMetrics);
      window.removeEventListener("resize", updateRailMetrics);
    };
  }, []);

  // keep the visible selection overlay locked to the selection anchor
  useEffect(() => {
    if (!adder || !containerRef.current) return;
    setSelectionRects(getAnchorRects(adder.anchor, containerRef.current));
  }, [tick, adder]);

  // recompute pin positions
  const positions = useMemo(() => {
    const root = containerRef.current;
    if (!root) return {};
    return Object.fromEntries(
      threads.map((t) => {
        const centerY = getAnchorCenterTop(t.anchor, root);
        if (centerY == null) return [t.id, undefined] as const;
        // store as a DOMRect so clusterByTop continues to read `.top`
        return [t.id, new DOMRect(0, centerY, 0, 0)] as const;
      })
    );
  }, [threads, html, tick]);

  // click‑outside to close bubble
  // replace your existing "click outside" effect with this:
  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!bubble) return;

      const root = containerRef.current;
      const bub = bubbleRef.current;
      const target = e.target as Node;

      // If you click inside the bubble, keep it open
      if (bub && bub.contains(target)) return;

      // Clicks inside the article are handled by onMouseUpCapture (selection logic),
      // so don’t close here. That handler will close if the selection is collapsed.
      if (root && root.contains(target)) return;

      // Anywhere else (outside article + bubble) → close bubble
      setBubble(null);
    }

    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [bubble]);

  const onMouseUpCapture: React.MouseEventHandler<HTMLDivElement> = () => {
    const root = containerRef.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setAdder(null);
      setSelectionRects(null);
      return;
    }
    const packed = buildAnchorFromSelection(root, sel);
    if (!packed) return;

    // Capture the selected text now, before it gets cleared
    const selectedText = sel.toString().slice(0, 1000);

    // show the adder but keep selection; also draw our own highlight
    setAdder({ anchor: packed.anchor, rect: packed.rect, text: selectedText });
    setSelectionRects(getAnchorRects(packed.anchor, root));
    setBubble(null); // don't open yet
  };

  async function createThread() {
    if (!bubble || !draftBody.trim()) return;
    const res = await fetch(
      `/api/articles/${encodeURIComponent(articleSlug)}/threads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anchor: bubble.anchor, body: draftBody }),
      }
    );
    if (!res.ok) return; // TODO: toast error
    const created: CommentThread = await res.json();

    // optimistic add & open
    setThreads((cur) => [created, ...cur]);
    setOpenId(created.id);
    setBubble(null);
    setDraftBody("");
  }

  const clusters = useMemo(() => clusterByTop(positions, 40), [positions]);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null); // cluster key = `${top}` or a generated id
  const railAnchorRef = useRef<HTMLDivElement>(null);

  return (
    <ArticleReader template={template} heroSrc={heroSrc} title={title}>
      <div className="absolute flex left-6 top-6 tracking-wide z-[9000]  ">
        <HomeButton />
      </div>
      {/* <button
          onClick={() => goHome()}
          className="fixed flex left-5 top-12 tracking-wide z-[9000] rounded-full bg-white/50  px-4 py-1 likebutton"
        >
          ⇤
  Home
        </button> */}
      <div className="relative ">
        <div className="flex flex-col w-[72%] justify-center items-center mx-auto px-3 gap-6">
          {/* Article + pins */}

          <div className="relative ml-[7%] mt-[1%]">
            {/* Article content (defines the coordinate space) */}
            <div className="relative">
              <div
                ref={containerRef}
                className="article-body prose max-w-none [&>*:last-child]:mb-0"
                data-ff="system"
                data-fs="16"
                data-clr="accent"
                dangerouslySetInnerHTML={{ __html: html }}
                onMouseUpCapture={onMouseUpCapture}
              />
              {/* Absolute overlay aligned to the article box */}
              <div className="pointer-events-none absolute inset-0 z-10">
                {/* visual selection overlay for the *current* selection */}
                {(selectionRects ?? []).map((r, i) => (
                  <div
                    key={`sel-${i}`}
                    className="absolute bg-sky-700/30 rounded-sm"
                    style={{
                      top: r.top,
                      left: r.left,
                      width: r.width,
                      height: r.height,
                    }}
                  />
                ))}
                {/* line highlights for active/hovered thread */}
                {(openId || hoverId) &&
                  rectsByThread[openId || hoverId!]?.map((r, i) => (
                    <div
                      key={`hl-${i}`}
                      className="absolute bg-indigo-500/10 rounded-sm"
                      style={{
                        top: r.top,
                        left: r.left,
                        width: r.width,
                        height: r.height,
                      }}
                    />
                  ))}
              </div>
            </div>
            <div className="md:hidden mb-3">
              <button
                className="px-3 py-1.5 rounded bg-amber-500 text-white text-sm"
                onClick={() => setOpenId(threads[0]?.id ?? null)}
              >
                View comments ({threads.length})
              </button>
            </div>

            {/* pin layer in the left gutter */}

            <div
              ref={leftGutterRef}
              className="absolute flex inset-y-0 inline-flex mt-2.5 inset-x-[-40px] w-4 select-none hidden md:block"
            >
              {" "}
              {clusters.map((c, i) => {
                const key = `c${i}-${Math.round(c.top)}`;
                const many = c.items.length > 3;
                const expanded = expandedCluster === key;

                if (many && !expanded) {
                  // collapsed badge
                  return (
                    <div
                      key={key}
                      className="absolute translate-y-[-50%]"
                      style={{
                        top: c.top + gutterOffsetTop + PIN_Y_TWEAK,
                        left: 4,
                      }}
                    >
                      <button
                        className="w-6 h-6  btnv2 btnv2--coment rounded-md bg-slate-200/20  text-indigo-500 text-xs "
                        onClick={() => setExpandedCluster(key)}
                        title={`${c.items.length} comments`}
                      >
                        {c.items.length}
                      </button>
                    </div>
                  );
                }

                // expanded or small cluster → show individual pins stacked
                const stack = solveCollisions(
                  c.items.map((id, idx) => ({
                    id,
                    top: c.top + idx * 16, // center-based now
                    left: -20,
                  })),
                  14
                );
                return stack.map((p) => {
                  const t = threads.find((x) => x.id === p.id)!;
                  const active = openId === t.id;
                  return (
                    <div
                      key={`${key}-${t.id}`}
                      className="absolute translate-x-[-50%] translate-y-[-50%]"
                      style={{ top: p.top + gutterOffsetTop, left: p.left }}
                      onMouseEnter={() => setHoverId(t.id)}
                      onMouseLeave={() => setHoverId(null)}
                    >
                      <button
                        className={`flex items-center justify-center rounded-md w-[45px] h-[15px] 
                        px-3 py-1 rounded-md text-center align-center btnv2 btnv2--pin   
                         leading-none
                      ${
                        t.resolved
                          ? "bg-slate-400/50 btnv2  btnv2--pin"
                          : "bg-slate-200/20 btnv2  btnv2--pin"
                      }
                        ${
                          active
                            ? "opacity-100 border-[1.4px] bg-amber-500/50 btnv2  btnv2--pin"
                            : "border-[1.1px] bg-slate-200/20 btnv2 btnv2--pin "
                        }`}
                        onClick={() => {
                          setOpenId(t.id);
                          setExpandedCluster(null);
                          scrollToThread(t);
                        }}
                        aria-label="Open comment"
                      >
                        <span className="text-[8px] text-indigo-700 align-middle">፨</span>

                      </button>
                    </div>
                  );
                });
              })}
            </div>

            {/* Selection toolbar with Comment and Make Claim buttons */}
            {adder && (
              <div
                className="absolute mt-4 flex flex-row z-30 gap-1 rounded-xl bg-slate-800/90 p-1 shadow-md shadow-slate-500/70"
                style={{
                  top: Math.max(0, adder.rect.top + 6),
                  left: adder.rect.left + adder.rect.width / 2 - (deliberationId ? 56 : 18),
                }}
                onMouseDown={(e) => e.preventDefault()} // keep selection
              >
                {/* Comment button */}
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs transition-colors"
                  onClick={() => {
                    const root = containerRef.current!;
                    const rects = getAnchorRects(adder.anchor, root);
                    const first = rects[0] ?? adder.rect;
                    setBubble({
                      anchor: adder.anchor,
                      rect: first,
                      text: adder.text.slice(0, 280),
                    });
                    setAdder(null);
                    setSelectionRects(null);
                  }}
                  aria-label="Comment on selection"
                >
                  <Image
                    src="/assets/document--comment.svg"
                    alt="comment"
                    width={14}
                    height={14}
                  />
                  <span>Comment</span>
                </button>

                {/* Make Claim button - only show if deliberationId exists */}
                {deliberationId && (
                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs transition-colors"
                    onClick={() => {
                      setClaimComposerInitialText(adder.text);
                      setClaimComposerAnchor(adder.anchor);
                      setClaimComposerOpen(true);
                      setAdder(null);
                      setSelectionRects(null);
                    }}
                    aria-label="Make claim from selection"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Make Claim</span>
                  </button>
                )}
              </div>
            )}

            {/* Floating composer bubble */}
            {bubble && (
              <div
                ref={bubbleRef} // 👈 NEW
                className="absolute ml-[100px] mt-[50px] backdrop-blur-sm px-3 py-2 z-30 w-[20rem] rounded-xl border-indigo-200 border-[2px]
                 bg-slate-100/30 shadow-lg"
                style={{
                  top: Math.max(0, bubble.rect.top - 56),
                  left: bubble.rect.left,
                }}
                onPointerDown={(e) => e.stopPropagation()} // 👈 keep global handler from seeing this
                onMouseDown={(e) => e.stopPropagation()} // (older browsers / safety)
              >
                <div className="p-3 border-b border-slate-300 text-xs text-neutral-600 line-clamp-2 ">
                  {bubble.text}
                </div>
                <div className="p-2 space-y-2 rounded-xl">
                  <textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    placeholder="Add a comment…"
                    className="w-full resize-none border-indigo-200 border-[1px] rounded p-2 text-xs outline-none"
                    rows={3}
                  />
                  <div className="flex items-center justify-end gap-4">
                    <button
                      className="text-xs text-neutral-700"
                      onClick={() => setBubble(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-2 py-1.5 rounded btnv2 btnv2--pin  text-xs"
                      onClick={createThread}
                    >
                      Comment
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT RAIL — give it a real height and pass the vertical offset */}
        <div className="relative h-0 overflow-visible">
          <div
            ref={railAnchorRef}
            className="absolute inset-0 pointer-events-none"
          />
          <div
            ref={railRef}
            className="absolute right-0 w-[320px] pointer-events-auto"
            style={{ top: railOffsetTop, height: railHeight }}
          >
            <CommentRail
              threads={threads}
              positions={positions}
              openId={openId}
              setOpenId={setOpenId}
              onSelect={(t) => {
                setActiveThread(t); // opens modal
                setOpenId(t.id); // highlights
                scrollToThread(t); // scrolls
              }}
              offsetTop={0}
            />
          </div>
        </div>
      </div>

      <div className="relative flex flex-col mt-4">
        <hr className="w-full border-[.5px] border-slate-700/70 mt-4"></hr>

        {deliberationId && (
          <section className="relative mt-0">
            <DeepDiveBackdrop attach="absolute"/>
            {/* <h2 className="text-4xl font-semibold tracking-wide text-center my-4">
              Discussion
            </h2> */}
            <div className=" justify-center items-center mx-auto border-b-[.5px] border-slate-700/70 w-[75%] mb-2" />
         <div className="px-10">
            <RhetoricProvider>
              <DialogueTargetProvider>
                <DeepDivePanel deliberationId={deliberationId} />
              </DialogueTargetProvider>
            </RhetoricProvider>
            </div>
          </section>
        )}
      </div>

      {activeThread && (
        <CommentModal
          thread={activeThread}
          open={!!activeThread}
          onClose={() => {
            setActiveThread(null);
            setOpenId(null);
          }}
        />
      )}

      {/* Claim Composer Dialog - opens when "Make Claim" is clicked */}
      {deliberationId && (
        <Dialog open={claimComposerOpen} onOpenChange={setClaimComposerOpen}>
          <DialogContent className="max-w-3xl bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Create Claim from Article Selection
              </DialogTitle>
            </DialogHeader>
            <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-xs font-medium text-amber-700 mb-1">Selected text from article:</div>
              <div className="text-sm text-slate-700 line-clamp-3">
                {claimComposerInitialText || "(no text selected)"}
              </div>
            </div>
            <PropositionComposerPro
              deliberationId={deliberationId}
              initialText={claimComposerInitialText}
              autoPromote={true}
              onCreated={(prop) => {
                // Claim created and auto-promoted
                setClaimComposerOpen(false);
                setClaimComposerInitialText("");
                setClaimComposerAnchor(null);
                // TODO: Save ArticleClaimAnchor for bidirectional linking
              }}
              onPosted={() => {
                setClaimComposerOpen(false);
                setClaimComposerInitialText("");
                setClaimComposerAnchor(null);
              }}
              placeholder="Edit or refine the claim text..."
            />
          </DialogContent>
        </Dialog>
      )}
    </ArticleReader>
  );
}
