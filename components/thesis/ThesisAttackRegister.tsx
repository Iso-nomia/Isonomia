// components/thesis/ThesisAttackRegister.tsx
//
// Living Thesis — Phase 3.1: attack register panel.
//
// Mounted on the published view page next to the live content. Lists every
// attack against an embedded object, grouped by status (undefended /
// defended / conceded). Clicking an entry opens the inspector drawer on
// the target's Attacks tab and scrolls the page to the embedded element.
//
// Polls /api/thesis/[id]/attacks via SWR (same cadence as /live so it stays
// in step with the badges).

"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Shield,
  Swords,
  CircleDashed,
} from "lucide-react";

import { useOpenInspector } from "@/lib/thesis/ThesisLiveContext";

interface AttackEntry {
  id: string;
  status: "undefended" | "defended" | "conceded";
  target: {
    kind: "claim" | "argument";
    id: string;
    text: string | null;
    /** D4 Week 1–2: chain rollup pills. */
    chains?: Array<{ chainId: string; chainName: string }>;
  };
  attacker: {
    kind: "claim" | "argument";
    id: string;
    text: string | null;
    authorId?: string | null;
  };
  attackType: string | null;
  targetScope?: string | null;
  createdAt: string;
}

interface RegisterPayload {
  cursor: string;
  computedAt: string;
  counts: { undefended: number; defended: number; conceded: number; all: number };
  entries: AttackEntry[];
}

const fetcher = async (url: string): Promise<RegisterPayload> => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Attack register fetch failed (${res.status})`);
  return res.json();
};

const ACTIVE_INTERVAL_MS = 30_000;

export function ThesisAttackRegister({ thesisId }: { thesisId: string }) {
  const openInspector = useOpenInspector();
  const [collapsed, setCollapsed] = useState(false);

  const { data, error, isLoading } = useSWR<RegisterPayload>(
    `/api/thesis/${thesisId}/attacks?status=all`,
    fetcher,
    {
      refreshInterval: ACTIVE_INTERVAL_MS,
      revalidateOnFocus: true,
      dedupingInterval: 5_000,
      keepPreviousData: true,
    },
  );

  const groups = useMemo(() => {
    const out = { undefended: [] as AttackEntry[], defended: [] as AttackEntry[], conceded: [] as AttackEntry[] };
    for (const e of data?.entries ?? []) {
      out[e.status].push(e);
    }
    return out;
  }, [data]);

  const counts = data?.counts ?? { undefended: 0, defended: 0, conceded: 0, all: 0 };

  const handleEntryClick = (entry: AttackEntry) => {
    // Scroll the embedded element into view if present, then open inspector.
    if (typeof document !== "undefined") {
      const el = document.querySelector(
        `[data-${entry.target.kind}-id="${entry.target.id}"]`,
      );
      if (el && "scrollIntoView" in el) {
        (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    openInspector({
      kind: entry.target.kind,
      id: entry.target.id,
      tab: "attacks",
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-slate-700" />
          <span className="font-semibold text-sm text-slate-800">
            Attack register
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs">
          {counts.undefended > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              ⚔ {counts.undefended} undefended
            </span>
          )}
          {counts.defended > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              🛡 {counts.defended} defended
            </span>
          )}
          {counts.all === 0 && !isLoading && (
            <span className="text-slate-500 italic">no attacks on file</span>
          )}
          {isLoading && (
            <span className="text-slate-400 italic">loading…</span>
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-slate-200">
          {error && (
            <div className="px-4 py-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">
              Failed to load attack register.
            </div>
          )}

          <Section
            title="Undefended"
            tone="rose"
            icon={<Swords className="h-3.5 w-3.5" />}
            count={counts.undefended}
          >
            {groups.undefended.map((e) => (
              <EntryRow key={e.id} entry={e} onClick={handleEntryClick} />
            ))}
            {groups.undefended.length === 0 && (
              <Empty>No undefended attacks.</Empty>
            )}
          </Section>

          <Section
            title="Defended"
            tone="emerald"
            icon={<Shield className="h-3.5 w-3.5" />}
            count={counts.defended}
          >
            {groups.defended.map((e) => (
              <EntryRow key={e.id} entry={e} onClick={handleEntryClick} />
            ))}
            {groups.defended.length === 0 && (
              <Empty>No defended attacks.</Empty>
            )}
          </Section>

          <Section
            title="Conceded"
            tone="slate"
            icon={<CircleDashed className="h-3.5 w-3.5" />}
            count={counts.conceded}
            mutedHint="Reserved — explicit concede tracking ships in a later phase."
          >
            {groups.conceded.length === 0 && (
              <Empty>No concessions on file.</Empty>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────────────

const TONE: Record<
  "rose" | "emerald" | "slate",
  { header: string; ring: string }
> = {
  rose: {
    header: "bg-rose-50/60 text-rose-700 border-rose-200",
    ring: "border-rose-200",
  },
  emerald: {
    header: "bg-emerald-50/60 text-emerald-700 border-emerald-200",
    ring: "border-emerald-200",
  },
  slate: {
    header: "bg-slate-50 text-slate-600 border-slate-200",
    ring: "border-slate-200",
  },
};

function Section({
  title,
  tone,
  icon,
  count,
  mutedHint,
  children,
}: {
  title: string;
  tone: "rose" | "emerald" | "slate";
  icon: React.ReactNode;
  count: number;
  mutedHint?: string;
  children: React.ReactNode;
}) {
  const styles = TONE[tone];
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <div
        className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b ${styles.header}`}
      >
        {icon}
        <span>{title}</span>
        <span className="ml-auto text-[11px] font-mono opacity-80">
          {count}
        </span>
      </div>
      <div className="p-3 space-y-2">
        {children}
        {mutedHint && (
          <p className="text-[11px] text-slate-400 italic">{mutedHint}</p>
        )}
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  onClick,
}: {
  entry: AttackEntry;
  onClick: (entry: AttackEntry) => void;
}) {
  const ago = formatAgo(entry.createdAt);
  return (
    <button
      type="button"
      onClick={() => onClick(entry)}
      className="w-full text-left rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 p-2.5 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
          {entry.attackType ?? "attack"}
        </span>
        {entry.targetScope && (
          <span className="text-[10px] text-slate-500 lowercase">
            · {entry.targetScope}
          </span>
        )}
        <span className="ml-auto text-[10px] text-slate-400 inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {ago}
        </span>
      </div>
      <div className="text-xs text-slate-500 mb-1">
        on{" "}
        <span className="text-slate-700">
          {truncate(entry.target.text, 80) ??
            `${entry.target.kind} ${entry.target.id.slice(0, 8)}`}
        </span>
        {entry.target.chains && entry.target.chains.length > 0 && (
          <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
            {entry.target.chains.slice(0, 3).map((c) => (
              <span
                key={c.chainId}
                className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700"
                title={`In chain: ${c.chainName}`}
              >
                in chain: {truncate(c.chainName, 24)}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="text-sm text-slate-800 break-words">
        {truncate(entry.attacker.text, 200) ?? "(no attacker text)"}
      </div>
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-slate-400 italic px-1 py-1">{children}</div>
  );
}

function truncate(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

function formatAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
