// components/discussion/ForumPane.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import { useAuth } from "@/lib/AuthContext";
import { Spinner } from "./FX";
import { motion } from "framer-motion";
import {
  Bookmark,
  Share2,
  ChevronsUpDown,
  Minimize,
  Expand,
  Pencil,
  TextQuote,
  MessageSquareQuote,
CornerDownRight,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Trash2,
  ArrowUpWideNarrow,
  TextQuoteIcon,
} from "lucide-react";

/* ----------------------------- types & utils ----------------------------- */

type ForumComment = {
  id: string;
  discussionId: string;
  parentId: string | null;
  authorId: string | number;
  body?: any;
  bodyText?: string | null;
  sourceMessageId?: string | null;
  score: number;
  createdAt: string; // ISO
  _children?: ForumComment[]; // for future threaded rendering
};

const fetcher = (u: string): Promise<any> =>
  fetch(u, { cache: "no-store" }).then((r) => r.json());

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
function hueFromSeed(seed: string | number) {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/**
 * Harmonious pastel tone styles - aligned with type-tokens.css glass aesthetic.
 * Uses soft indigo/rose/purple/amber palette with high lightness and subtle saturation.
 * - Depth 0: indigo base (129, 140, 248)
 * - Rotates through rose→purple→amber for visual hierarchy
 * - Glass-like transparency with gentle gradients
 */
function toneStyles(depth: number, authorId: string | number) {
  const GOLDEN = 67.50776405;
  const base = hueFromSeed(authorId);
  
  // Map to our glass palette hues
  // Indigo ~230°, Rose ~330°, Purple ~280°, Amber ~45°
  const paletteHues = [230, 330, 280, 45, 210, 250]; // indigo, rose, purple, amber, light-indigo, deep-indigo
  const bucket = Math.round((base / 360) * paletteHues.length) % paletteHues.length;
  const h = (paletteHues[bucket] + depth * 18) % 360; // subtle depth shift
  
  // Softer saturation - aligned with glass aesthetic (40-55% range)
  const sat = 42 + (bucket % 3) * 4; // 42–50%
  
  // Very high lightness for ethereal glass effect
  const L_TOP = Math.max(97 - depth * 0.4, 94); // 97→94
  const L_BOT = Math.max(98 - depth * 0.3, 95); // 98→95
  
  // Delicate alpha - barely-there presence
  const A_TOP = depth === 0 ? 0.14 : 0.10;
  const A_BOT = depth === 0 ? 0.22 : 0.16;
  
  // Micro hue shift for gradient depth (tighter than before)
  const h2 = (h + 8) % 360;
  
  const background =
    `linear-gradient(180deg, ` +
    `hsla(${h} ${sat}% ${L_BOT}% / ${A_BOT}), ` +
    `hsla(${h2} ${Math.min(sat + 2, 52)}% ${L_TOP}% / ${A_TOP}) )`;
  
  // Border color matching glass-border aesthetic
  const border = `hsla(${h} ${sat + 8}% ${Math.max(L_BOT - 20, 65)}% / .22)`;
  
  return {
    background,
    borderColor: border,
    ...(depth > 0 ? { boxShadow: `inset 3px 0 0 0 ${border}` } : null),
  } as React.CSSProperties;
}

function collectIds(list: ForumComment[]): string[] {
  const out: string[] = [];
  const walk = (n: ForumComment) => {
    out.push(String(n.id));
    (n._children ?? []).forEach(walk);
  };
  list.forEach(walk);
  return Array.from(new Set(out));
}

// --- text normalization (keep local to avoid cross-imports) ---
function plainFromNode(n: any): string {
  if (!n) return "";
  if (typeof n === "string") return n;
  if (Array.isArray(n)) return n.map(plainFromNode).join("");
  if (n.type === "text") return n.text || "";
  if (Array.isArray(n.content)) return n.content.map(plainFromNode).join("");
  return "";
}

function looksJson(s?: string | null) {
  if (!s) return false;
  const t = s.trim();
  return t.startsWith("{") || t.startsWith("[");
}

function normalizeBodyText(row: { bodyText?: string | null; body?: any }) {
  const { bodyText, body } = row;
  if (bodyText && !looksJson(bodyText)) return bodyText;
  try {
    return plainFromNode(body);
  } catch {
    return bodyText ?? "";
  }
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
}

function formatCount(n: number) {
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

/* ------------------------------- main pane ------------------------------- */

export default function ForumPane({
  discussionId,
  conversationId, // string | null
  opUserId,
  initialComments, // 👈 NEW: Accept server-seeded comments
}: {
  discussionId: string;
  conversationId: string | null;
  opUserId?: string | number | null;
  initialComments?: ForumComment[]; // 👈 NEW
}) {
  const [sort, setSort] = React.useState<"best" | "top" | "new" | "old">(
    "best"
  );
  const [limit, setLimit] = React.useState<number>(30);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [compact, setCompact] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);

  // Track URL hash for anchor highlight
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  React.useEffect(() => {
    const get = () => {
      const h = (location.hash || "").replace(/^#c-/, "");
      setHighlightId(h || null);
    };
    get();
    const onHash = () => get();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Build query (server can later support ?sort=…)
  const query = React.useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("limit", String(limit));
    if (cursor) sp.set("cursor", cursor);
    sp.set("sort", sort);
    return sp.toString();
  }, [limit, cursor, sort]);

  const { data, mutate, isLoading, error } = useSWR<{ items: ForumComment[] }>(
    `/api/discussions/${discussionId}/forum?${query}&includeReplies=all`,
    fetcher,
    {
      // 👇 Use initial comments if provided (for demo/SSR hydration)
      fallbackData: initialComments ? { items: initialComments } : undefined,
    }
  );

  // Update hasMore based on the response
  React.useEffect(() => {
    if (data?.items) {
      // If we got fewer items than the limit, there are no more comments
      setHasMore(data.items.length >= limit);
    }
  }, [data?.items, limit]);

  const items = React.useMemo(() => {
    const rows = data?.items ?? [];
    const sorter = {
      best: (a: ForumComment, b: ForumComment) =>
        b.score - a.score ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      top: (a: ForumComment, b: ForumComment) => b.score - a.score,
      new: (a: ForumComment, b: ForumComment) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      old: (a: ForumComment, b: ForumComment) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    }[sort];
    return [...rows].sort(sorter);
  }, [data?.items, sort]);

  // collect all ids for me-state fetch
  const allIds = React.useMemo(() => collectIds(items), [items]);

  const { data: meState } = useSWR<{
    ok: boolean;
    votes: Record<string, number>;
    saves: Record<string, boolean>;
  }>(
    allIds.length
      ? `/api/discussions/${discussionId}/forum/me?ids=${allIds.join(",")}`
      : null,
    fetcher
  );
  const meVotes = meState?.votes ?? {};
  const meSaves = meState?.saves ?? {};

  // --- Draft persistence for the top composer
  const DRAFT_KEY = `forum:draft:${discussionId}`;
  const [posting, setPosting] = React.useState(false);
  const [body, setBody] = React.useState("");
  const charLimit = 5000;
  const remaining = charLimit - body.length;

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setBody(saved);
    } catch {}
  }, [DRAFT_KEY]);

  React.useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, body);
    } catch {}
  }, [DRAFT_KEY, body]);

  async function submitNew() {
    if (!body.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/discussions/${discussionId}/forum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: {
            type: "paragraph",
            content: [{ type: "text", text: body.slice(0, charLimit) }],
          },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.comment) {
        await mutate(
          (prev) => ({ items: [j.comment, ...(prev?.items ?? [])] }),
          { revalidate: false }
        );
      } else {
        await mutate();
      }
      setBody("");
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
    } finally {
      setPosting(false);
    }
  }

  // Collapse/expand all (broadcast simple events consumed by items)
  function collapseAll() {
    window.dispatchEvent(
      new CustomEvent("forum:collapse", { detail: { discussionId } })
    );
  }
  function expandAll() {
    window.dispatchEvent(
      new CustomEvent("forum:expand", { detail: { discussionId } })
    );
  }

  return (
    <div className="space-y-4 w-full">
      {/* Header: sort & meta */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <SortControl sort={sort} onChange={setSort} />
          <div className="flex items-center gap-2">
            <button
              className="flex gap-1 items-center btnv2 text-[11px] px-3 py-1.5"
              onClick={collapseAll}
            >
              {/* <ArrowUpNarrowWide className="h-3.5 w-3.5" /> */}
              <ArrowUpWideNarrow className="h-3 w-3" />
              Collapse All
            </button>
            <button
              className="flex gap-1 items-center btnv2 text-[11px] px-3 py-1.5"
              onClick={expandAll}
            >
              <ArrowDownNarrowWide className="h-3 w-3" />
              Expand All
            </button>
            {/* <label className="text-xs flex text-center align-center items-center gap-1 cursor-pointer my-auto py-2 h-full
             ">
              <input type="checkbox" className="checkboxv2 flex" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
              <span className="flex ml-0 h-full text-sm
               text-gray-700 text-center align-center items-center gap-1 cursor-pointer mt-1">Compact</span>

            </label> */}
          </div>
        </div>
        <div className="text-xs text-slate-600">
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Loading…
            </span>
          ) : (
            `${data?.items?.length ?? 0} comment${
              (data?.items?.length ?? 0) === 1 ? "" : "s"
            }`
          )}
        </div>
      </div>
      {/* Composer */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-xl border  p-3 "
      >
        <textarea
          className="w-full text-sm p-2 border-none rounded-lg outline-[1px] outline-indigo-300 discussionfield bg-white/50 backdrop-blur-lg
           resize-y min-h-[72px]"
          placeholder="Respond here…"
          value={body}
          maxLength={charLimit}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submitNew();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
          <span>{remaining} chars left</span>
          <div className="flex gap-2">
            {/* <button className="btnv2 btnv2--sm btnv2--ghost" onClick={() => setBody("")} disabled={!body}>
              Clear
            </button> */}
            <button
              className="btnv2  py-1 text-center align-center my-auto px-3 text-xs"
              onClick={() => setBody("")}
              disabled={!body}
            >
              <div className="flex align-center text-center my-auto">Clear</div>
            </button>
            {/* <button className="btnv2 btnv2--sm" onClick={submitNew} disabled={posting || !body.trim()}>
              {posting ? "Posting…" : "Post"}
            </button> */}
            <button
              className="btnv2  py-1 text-center align-center my-auto px-3 text-xs"
              onClick={submitNew}
              disabled={posting || !body.trim()}
            >
              <div className="flex align-center text-center my-auto">
                {posting ? "Posting…" : "Post"}
              </div>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Error / Empty / List */}
      {error && (
        <div className="rounded border bg-rose-50 text-rose-700 text-sm p-3">
          Failed to load comments.
        </div>
      )}

      {!isLoading && items.length === 0 && !error && <EmptyState />}

      {isLoading && !error ? (
        <SkeletonList />
      ) : (
        <ul className={cx("space-y-3", compact && "space-y-2")}>
          {items.map((row) => (
            <li key={row.id} id={`c-${row.id}`}>
              <ForumCommentItem
                discussionId={discussionId}
                conversationId={conversationId}
                comment={row}
                depth={0}
                opUserId={opUserId}
                compact={compact}
                highlighted={highlightId === String(row.id)}
                onLocalEdit={async () => mutate()}
                onLocalDelete={async () => mutate()}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Load more */}
      <div className="flex justify-center">
        <button
          className="btnv2 btnv2--sm btnv2--ghost"
          onClick={() => {
            const last = data?.items?.[data.items.length - 1];
            if (last) setCursor(String(last.id));
          }}
          disabled={isLoading || !data?.items?.length || !hasMore}
          title={hasMore ? "Loads older comments" : "All comments loaded"}
        >
          {hasMore ? "Load more" : "All comments loaded"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- subparts ------------------------------- */
function SortControl({
  sort,
  onChange,
}: {
  sort: "best" | "top" | "new" | "old";
  onChange: (v: "best" | "top" | "new" | "old") => void;
}) {
  const tabs: Array<{ key: typeof sort; label: string }> = [
    { key: "best", label: "Best" },
    { key: "top", label: "Top" },
    { key: "new", label: "New" },
    { key: "old", label: "Old" },
  ];
  return (
    <div className="px-2 flex items-center gap-2 text-xs">
      <span className="align-center flex my-auto text-slate-600">Sort by:</span>
      <div className="flex rounded-xl border-[1.5px] border-indigo-200  overflow-hidden ">
        {tabs.map(({ key, label }, idx) => (
          <button
            key={key}
            className={cx(
              "px-3 py-1 border-r last:border-r-0 transition",
              sort === key ? "bg-white" : "hover:bg-slate-300/80"
            )}
            style={{ borderColor: "rgba(148,163,184,.35)" }}
            onClick={() => onChange(key)}
            aria-pressed={sort === key}
            aria-label={`Sort by ${label}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ForumCommentItem({
  discussionId,
  conversationId,
  comment,
  opUserId,
  compact,
  highlighted,
  onLocalEdit,
  onLocalDelete,
  initialVote = 0,
  initialSaved = false,
  depth = 0,
  parentUnclamped = false,
}: {
  discussionId: string;
  conversationId: string | null;
  comment: ForumComment;
  opUserId?: string | number | null;
  compact?: boolean;
  highlighted?: boolean;
  onLocalEdit: () => void;
  onLocalDelete: () => void;
  initialVote?: 0 | 1 | -1;
  initialSaved?: boolean;
  depth?: number;
  parentUnclamped?: boolean;
}) {
  // Toggle if/when you want hotkeys back
  const ENABLE_HOTKEYS = false;
  const { user } = useAuth();
  const meId = user?.userId ? String(user.userId) : null;

  const [collapsed, setCollapsed] = React.useState(false);
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [saved, setSaved] = React.useState(initialSaved);
  const [vote, setVote] = React.useState<0 | 1 | -1>(initialVote);
  const [score, setScore] = React.useState<number>(comment.score);

  const text = normalizeBodyText(comment);
  const authorIsOP =
    opUserId != null && String(opUserId) === String(comment.authorId);
  const mine = meId != null && String(meId) === String(comment.authorId);

  const MAX_NEST = 7;
  const [unclampBranch, setUnclampBranch] = React.useState(false);
  const isUnclamped = parentUnclamped || unclampBranch;
  const rawDepth = depth ?? 0;
  const visualDepth = isUnclamped ? rawDepth : Math.min(rawDepth, MAX_NEST);
  const overflow = isUnclamped ? 0 : Math.max(0, rawDepth - MAX_NEST); // only show overf
  const parentAnchor = comment.parentId ? `#c-${comment.parentId}` : null;
  const shouldIndentChildren = rawDepth < MAX_NEST || isUnclamped;

  // Listen to global collapse/expand
  React.useEffect(() => {
    const onCollapse = (e: any) => {
      if (e?.detail?.discussionId === discussionId) setCollapsed(true);
    };
    const onExpand = (e: any) => {
      if (e?.detail?.discussionId === discussionId) setCollapsed(false);
    };
    window.addEventListener("forum:collapse", onCollapse as any);
    window.addEventListener("forum:expand", onExpand as any);
    return () => {
      window.removeEventListener("forum:collapse", onCollapse as any);
      window.removeEventListener("forum:expand", onExpand as any);
    };
  }, [discussionId]);

  // Soft highlight when navigated by hash
  const [flash, setFlash] = React.useState(false);
  React.useEffect(() => {
    if (!highlighted) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1800);
    return () => clearTimeout(t);
  }, [highlighted]);

  function toggleVote(dir: 1 | -1) {
    const next = vote === dir ? 0 : dir;
    setScore((s) => s - vote + next);
    setVote(next);
    fetch(`/api/discussions/${discussionId}/forum/${comment.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dir: next }),
    })
      .then((r) => r.json().catch(() => null))
      .then((j) => {
        if (!j?.ok) return;
        if (typeof j.score === "number") setScore(j.score);
        if (typeof j.vote === "number") setVote(j.vote);
      })
      .catch(() => {});
  }
  function toggleSave() {
    const next = !saved;
    setSaved(next);
    fetch(`/api/discussions/${discussionId}/forum/${comment.id}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved: next }),
    }).catch(() => {});
  }

  async function handleDelete() {
    // Soft delete (tombstone)
    const res = await fetch(
      `/api/discussions/${discussionId}/forum/${comment.id}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      alert(`Delete failed: ${res.status} ${t}`);
      return;
    }
    onLocalDelete(); // parent calls mutate()
  }

  async function handleEdit(next: string) {
    const payload = {
      content: { type: "paragraph", content: [{ type: "text", text: next }] },
    };
    const res = await fetch(
      `/api/discussions/${discussionId}/forum/${comment.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      alert(`Save failed: ${res.status} ${t}`);
      return;
    }
    onLocalEdit(); // parent calls mutate()
  }
  function isTypingTarget(el: EventTarget | null) {
    const t = el as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    return (
      t.isContentEditable ||
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      t.closest(
        "input,textarea,[contenteditable=''],[contenteditable='true']"
      ) != null
    );
  }

  // 👉 NEW: compute the children block once, reuse inside/outside
  const childrenBlock =
    !collapsed && (comment._children?.length ?? 0) > 0 ? (
      <div
        className={cx(
          "mt-3",
          compact ? "space-y-2" : "space-y-3",
          shouldIndentChildren && "pl-3 border-l" // indent only while < clamp OR explicitly unclamped
        )}
      >
        {comment._children!.map((child) => (
          <ForumCommentItem
            key={child.id}
            discussionId={discussionId}
            conversationId={conversationId}
            comment={child}
            depth={rawDepth + 1}
            parentUnclamped={isUnclamped}
            opUserId={opUserId}
            compact={compact}
            highlighted={false}
            onLocalEdit={onLocalEdit}
            onLocalDelete={onLocalDelete}
          />
        ))}
      </div>
    ) : null;

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={cx(
          "rounded-xl panelv2 panelv2--chevron p-3 transition",
         
          compact && "p-2",
          flash && "ring-2 ring-indigo-300 bg-indigo-50/70"
        )}
        // style={toneStyles(depth, comment.authorId)}
        style={toneStyles(visualDepth, comment.authorId)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (!ENABLE_HOTKEYS) return;
          if (isTypingTarget(e.target)) return;
          const k = e.key.toLowerCase();
          if (k === "r") setReplyOpen((v) => !v);
          if (k === "c") setCollapsed((v) => !v);
          if (k === "u") toggleVote(1);
        }}
        aria-expanded={!collapsed}
        aria-controls={`comment-body-${comment.id}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <PatternAvatar id={comment.authorId} />
            <div className={cx("text-sm truncate", compact && "text-[12px]")}>
              <span className="font-medium">
                User {String(comment.authorId)}
              </span>
              {authorIsOP && (
                <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  OP
                </span>
              )}
              <span className="ml-2 text-[12px] text-slate-600">
                {timeAgo(comment.createdAt)}
              </span>

              {overflow > 0 && (
                <span
                  className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    // derive a pill from parent hue; slightly stronger for visibility
                    background: "hsla(0 0% 100% / .6)",
                    boxShadow: "inset 0 0 0 1px rgba(148,163,184,.35)",
                  }}
                  title={`Reply depth +${overflow} (clamped)`}
                >
                  ↳ depth +{overflow}
                </span>
              )}
              {overflow > 0 && (
                <button
                  className="ml-2 text-[11px] underline text-slate-600 hover:text-slate-800"
                  onClick={() => setUnclampBranch(true)}
                  title="Temporarily expand this branch beyond the nesting limit"
                >
                  Show full chain
                </button>
              )}
              {isUnclamped && rawDepth >= MAX_NEST && (
                <button
                  className="ml-2 text-[11px] underline text-slate-600 hover:text-slate-800"
                  onClick={() => setUnclampBranch(false)}
                  title="Collapse this branch back to the nesting limit"
                >
                  Collapse chain
                </button>
              )}

              {/* Optional: show once when overflow begins */}
              {overflow === 1 && parentAnchor && (
                <div className="mt-1 text-[12px] text-slate-500 italic">
                  in reply to{" "}
                  <a className="underline" href={parentAnchor}>
                    parent
                  </a>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <VoteControls
              score={score}
              vote={vote}
              onVote={toggleVote}
              compact={!!compact}
            />
            <button
              className="btnv2 btnv2--sm btnv2--ghost"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? (
                <Expand className="h-3.5 w-3.5" />
              ) : (
                <Minimize className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Body */}
        {!collapsed && (
          <div
            id={`comment-body-${comment.id}`}
            className={cx(
              "mt-2 pl-1 whitespace-pre-wrap",
              compact ? "text-[13px]" : "text-sm"
            )}
          >
            {text || "(no text)"}
          </div>
        )}

        {/* Toolbar */}
        {!collapsed && (
          <div
            className={cx(
              "mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-600",
              compact && "mt-1"
            )}
          >
            <button
              className="flex gap-1 btnv2--ghost rounded-xl py-1 text-center align-center my-auto px-3 text-xs"
              onClick={() => setReplyOpen((v) => !v)}
            >
              <CornerDownRight className="h-3.5 w-3.5" />
              <div className="flex align-center  text-center my-auto ">Reply</div>
            </button>

            <span className="text-slate-400">•</span>
            <QuoteInChatButton
              discussionId={discussionId}
              conversationId={conversationId}
              text={text}
            />
            <span className="text-slate-400">•</span>

            <SaveButton saved={saved} onToggle={toggleSave} />
            <span className="text-slate-400">•</span>
            <ShareButton discussionId={discussionId} commentId={comment.id} />
            {mine && (
              <>
                <span className="text-slate-400">•</span>

                <EditButton initial={text} onSave={handleEdit} />
                <span className="text-slate-400">•</span>

                <button
                  className="flex gap-1  items-center underline underline-offset-4 text-rose-600"
                  onClick={handleDelete}
                >
                  {" "}
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </>
            )}
          </div>
        )}
        {/* overflow connector stub (a hair inset for a “hook” feel) */}
        {overflow > 0 && (
          <div
            aria-hidden
            className="mt-2"
            style={{
              height: 6,
              borderLeft: "2px dotted rgba(148,163,184,.45)",
              marginLeft: 8, // 👈 slight inset to visually connect
              opacity: 0.9,
            }}
          />
        )}
        {/* Deep replies
       {!collapsed && (comment._children?.length ?? 0) > 0 && (
   <div
     className={cx(
       "mt-3",
       compact ? "space-y-2" : "space-y-3",
       (rawDepth < MAX_NEST || isUnclamped) && "pl-3 border-l" // 👈 only indent while < clamp OR this branch is expanded
     )}
  >
          {comment._children!.map((child) => (
            <ForumCommentItem
              key={child.id}
              discussionId={discussionId}
              conversationId={conversationId}
              comment={child}
              depth={rawDepth + 1}
        parentUnclamped={isUnclamped}
              opUserId={opUserId}
              compact={compact}
              highlighted={false}
              onLocalEdit={onLocalEdit}
              onLocalDelete={onLocalDelete}
            />
          ))}
        </div>
      )} */}

        {/* overflow connector (optional)
        {overflow > 0 && (
          <div
            aria-hidden
            className="mt-2"
            style={{
              height: 6,
              borderLeft: "2px dotted rgba(148,163,184,.45)",
              marginLeft: 8,
              opacity: 0.9,
            }}
          />
        )} */}

        {/* 👇 render children INSIDE only if we still want indentation */}
        {shouldIndentChildren && childrenBlock}

        {/* Inline reply */}
        {replyOpen && !collapsed && (
          <div className="mt-3">
            <ReplyComposer
              discussionId={discussionId}
              parentId={comment.id}
              onPosted={() => setReplyOpen(false)}
            />
          </div>
        )}
      </motion.article>
      {/* 👇 when clamped and not unclamped, render children OUTSIDE the card */}
      {!shouldIndentChildren && childrenBlock && (
        <div className="-mt-2">{childrenBlock}</div>
      )}
    </>
  );
}

function VoteControls({
  score,
  vote,
  onVote,
  compact,
}: {
  score: number;
  vote: 0 | 1 | -1;
  onVote: (dir: 1 | -1) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        className={cx(
          "btnv2  leading-none",
          vote === 1 && "ring-1 ring-emerald-300"
        )}
        title="Upvote (u)"
        onClick={() => onVote(1)}
      >
        ▲
      </button>
      <span
        className={cx(
          "min-w-[2ch] text-center",
          compact ? "text-[12px]" : "text-sm"
        )}
      >
        {formatCount(score)}
      </span>
      <button
        className={cx(
          "btnv2  leading-none",
          vote === -1 && "ring-1 ring-rose-300"
        )}
        onClick={() => onVote(-1)}
        title="Downvote"
      >
        ▼
      </button>
    </div>
  );
}

function ReplyComposer({
  discussionId,
  parentId,
  onPosted,
}: {
  discussionId: string;
  parentId: string;
  onPosted: () => void;
}) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const charLimit = 5000;

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/discussions/${discussionId}/forum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId,
          content: {
            type: "paragraph",
            content: [{ type: "text", text: text.slice(0, charLimit) }],
          },
        }),
      });
      setText("");
      onPosted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-slate-100/30 p-2 panel-edge">
      <textarea
        className="w-full text-sm bg-transparent min-h-[56px]
            border-none rounded-lg outline-[1px] outline-indigo-300 discussionfield
            bg-white/30 p-2
           resize-y"
        placeholder="Write a reply…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="mt-2 flex justify-start gap-2">
        <button
          className="btnv2 btnv2--sm btnv2--ghost"
          onClick={() => setText("")}
          disabled={busy || !text}
        >
          Clear
        </button>
        <button
          className="btnv2 btnv2--sm"
          onClick={submit}
          disabled={busy || !text.trim()}
        >
          {busy ? "Posting…" : "Reply"}
        </button>
      </div>
    </div>
  );
}

function EditButton({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (next: string) => void | Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setBusy(true);
    try {
      await onSave(text);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
                  className="flex gap-1  items-center underline underline-offset-4 "
        onClick={() => setOpen(true)}
      >
                        <Pencil className="h-3.5 w-3.5"/>

        Edit
      </button>
      {open && (
        <div className="mt-2 rounded-xl border bg-white/70 p-2 panel-edge">
          <textarea
            className="w-full text-sm bg-transparent outline-none min-h-[80px]"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              className="btnv2 btnv2--sm btnv2--ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btnv2 btnv2--sm"
              onClick={submit}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SaveButton({
  saved,
  onToggle,
}: {
  saved: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={cx(
        "flex gap-1 btnv2--ghost rounded-xl py-1 text-center align-center my-auto px-3 text-xs",
        saved && "text-emerald-700"
      )}
      onClick={onToggle}
    >
      <Bookmark className="h-3.5 w-3.5" />
      {saved ? "Saved" : "Save"}
    </button>
  );
}

function ShareButton({
  discussionId,
  commentId,
}: {
  discussionId: string;
  commentId: string;
}) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try {
      const url = `${location.origin}/discussions/${discussionId}#c-${commentId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      alert("Copy failed");
    }
  }
  return (
    <button
      className="flex gap-1 btnv2--ghost rounded-xl py-1 text-center align-center my-auto px-3 text-xs"
      onClick={copy}
    >
      <Share2 className="h-3.5 w-3.5" />
      {copied ? "Copied!" : "Share"}
    </button>
  );
}

function PatternAvatar({ id }: { id: string | number }) {
  const seed = String(id);
  // cheap deterministic hue
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const bg = `linear-gradient(135deg, hsl(${h} 70% 75% / .9), hsl(${
    (h + 40) % 360
  } 70% 85% / .9))`;
  const ch =
    seed
      .replace(/[^a-z0-9]/gi, "")
      .charAt(0)
      .toUpperCase() || "U";
  return (
    <div
      className="h-7 w-7 rounded-full text-slate-700 text-xs flex items-center justify-center border"
      style={{ background: bg, borderColor: "rgba(148,163,184,.35)" }}
    >
      {ch}
    </div>
  );
}

/* -------------------------- quote in chat button -------------------------- */

function QuoteInChatButton({
  discussionId,
  conversationId,
  text,
}: {
  discussionId: string;
  conversationId: string | null;
  text?: string;
}) {
  const safe = (text ?? "").trim();
  const asBlockquote = (t: string) =>
    t
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");

  async function go() {
    const payload = safe
      ? `> _From forum:_\n${asBlockquote(safe)}`
      : "> _From forum:_";
    if (conversationId) {
      await fetch(`/api/conversations/${conversationId}/ensure-member`, {
        method: "POST",
      }).catch(() => {});
      try {
        sessionStorage.setItem(
          `dq:conv:${conversationId}`,
          JSON.stringify({ text: payload })
        );
      } catch {}
    }
    window.dispatchEvent(
      new CustomEvent("discussion:quote-for-chat", {
        detail: { discussionId, text: payload },
      })
    );
  }

  return (
    <button
      className="flex gap-1 btnv2--ghost rounded-xl py-1 text-center align-center my-auto px-3 text-xs"
      onClick={go}
    >
      <TextQuoteIcon className="h-3.5 w-3.5" />
      <div className="flex align-center text-center my-auto  "><span className="flex  align-center text-center my-auto">Quote</span></div>
    </button>
  );
}

/* ------------------------- skeleton / empty state ------------------------- */

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="rounded-xl border bg-white/70 p-3 panel-edge">
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-slate-200" />
              <div className="h-3 w-40 rounded bg-slate-200" />
            </div>
            <div className="h-3 w-11/12 rounded bg-slate-200" />
            <div className="h-3 w-9/12 rounded bg-slate-200" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border bg-white/70 p-8 text-center text-sm text-slate-600 panel-edge">
      No comments yet — be the first to post.
    </div>
  );
}

function Replies({
  discussionId,
  parentId,
  have,
  conversationId,
  compact,
  opUserId,
  onBump,
}: {
  discussionId: string;
  parentId: string;
  have: any[] | null;
  conversationId: string | null;
  compact?: boolean;
  opUserId?: string | number | null;
  onBump: () => void;
}) {
  const [open, setOpen] = React.useState(!!have && have.length > 0);
  const { data, isLoading } = useSWR<{ items: any[] }>(
    open && !have
      ? `/api/discussions/${discussionId}/forum?parentId=${parentId}`
      : null,
    (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json())
  );
  const kids = have ?? data?.items ?? [];

  if (!open) {
    return (
      <button
        className="mt-2 text-[12px] "
        onClick={() => setOpen(true)}
      >
        View replies
      </button>
    );
  }

  if (!kids.length && isLoading) {
    return <div className="mt-2 text-[12px] text-slate-500">Loading…</div>;
  }

  if (!kids.length) return null;

  return (
    <div
      className={cx("mt-3 pl-4 border-l", compact ? "space-y-2" : "space-y-3")}
    >
      {kids.map((child) => (
        <ForumCommentItem
          key={child.id}
          discussionId={discussionId}
          conversationId={conversationId}
          comment={child}
          opUserId={opUserId}
          compact={compact}
          highlighted={false}
          onLocalEdit={onBump}
          onLocalDelete={onBump}
        />
      ))}
    </div>
  );
}
