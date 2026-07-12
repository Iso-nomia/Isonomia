"use client";

import useSWR from "swr";
import * as React from "react";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Search,
  MessageSquare,
  HelpCircle,
  Megaphone,
  Clock,
  Tag as TagIcon,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBusMutate } from "@/components/hooks/useBusMutate";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

type SortKey = "active" | "newest" | "claims" | "contested";

interface HubItem {
  id: string;
  title: string | null;
  label: string;
  host: { type: string; id: string };
  tags: string[];
  visibility: string;
  call: { description: string; deadline: string | null } | null;
  stats: { claims: number; openCQs: number };
  updatedAt: string;
  createdAt: string;
}

interface HubResponse {
  items: HubItem[];
  facets: { tags: { tag: string; count: number }[] };
  total: number;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "active", label: "Recently active" },
  { key: "newest", label: "Newest" },
  { key: "claims", label: "Most claims" },
  { key: "contested", label: "Most contested" },
];

function relative(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : formatDistanceToNowStrict(d, { addSuffix: true });
}

function StatPill({
  icon: Icon,
  value,
  label,
  tone = "slate",
}: {
  icon: typeof MessageSquare;
  value: number;
  label: string;
  tone?: "slate" | "amber";
}) {
  const cls =
    tone === "amber" && value > 0
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        cls,
      )}
    >
      <Icon className="h-3 w-3" />
      <b className="font-semibold tabular-nums">{value}</b>
      <span className="text-[10px] opacity-70">{label}</span>
    </span>
  );
}

function HubCard({ d }: { d: HubItem }) {
  return (
    <div className="cardv2 bg-white/70 flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {d.host.type}
          </p>
          <h3
            title={d.label}
            className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900"
          >
            {d.label}
          </h3>
        </div>
        <a
          href={`/deliberation/${d.id}`}
          className="btnv2 p-2 text-xs font-medium shrink-0 inline-flex items-center gap-1 rounded-full bg-white "
        >
          Open <ArrowUpRight className="flex h-3 w-3" />
        </a>
      </div>

      {d.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {d.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
            >
              <TagIcon className="h-2.5 w-2.5 opacity-60" />
              {t}
            </span>
          ))}
        </div>
      )}

      {d.call && (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-[12px] text-amber-800">
          <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">
            <b className="font-semibold">Call for input:</b> {d.call.description}
          </span>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <StatPill icon={MessageSquare} value={d.stats.claims} label="claims" />
        <StatPill icon={HelpCircle} value={d.stats.openCQs} label="open CQs" tone="amber" />
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400">
          <Clock className="h-3 w-3" />
          {relative(d.updatedAt)}
        </span>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-2 text-[11px]">
        <a className="text-slate-500 hover:text-slate-900" href={`/deliberation/${d.id}?mode=panel`}>
          Panel
        </a>
        <a
          className="text-slate-500 hover:text-slate-900"
          href={`/deliberation/${d.id}?mode=synthesis`}
        >
          Synthesis
        </a>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="cardv2 bg-white/40 animate-pulse space-y-3 p-4">
      <div className="h-3 w-20 rounded bg-slate-200" />
      <div className="h-4 w-2/3 rounded bg-slate-200" />
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-full bg-slate-100" />
        <div className="h-5 w-16 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

export default function Hub() {
  const [q, setQ] = React.useState("");
  const [calls, setCalls] = React.useState<"any" | "open">("any");
  const [sort, setSort] = React.useState<SortKey>("active");
  const [tags, setTags] = React.useState<string[]>([]);

  const params = new URLSearchParams({ q, calls, sort, tags: tags.join(",") });
  const key = `/api/hub/deliberations?${params.toString()}`;
  const { data, isLoading } = useSWR<HubResponse>(key, fetcher);

  // live refresh when core events happen
  useBusMutate(
    [
      "deliberations:created",
      "decision:changed",
      "votes:changed",
      "dialogue:changed",
      "comments:changed",
      "xref:changed",
    ],
    key,
    undefined,
    150,
  );

  const items = data?.items ?? [];
  const facetTags = data?.facets?.tags ?? [];
  const atCap = (data?.total ?? 0) >= 40;

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-800">Deliberation hub</h1>
        <p className="text-sm text-slate-500">
          Discover and sort public deliberations by title, activity, and open questions.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="articlesearchfield w-full rounded-lg py-2 pl-9 pr-3 text-sm"
            placeholder="Search titles, tags…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search deliberations"
          />
        </div>

        <select
          className="articlesearchfield rounded-lg px-3 py-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort deliberations"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          className="articlesearchfield rounded-lg px-3 py-2 text-sm"
          value={calls}
          onChange={(e) => setCalls(e.target.value as "any" | "open")}
          aria-label="Filter by calls for input"
        >
          <option value="any">All deliberations</option>
          <option value="open">Open calls for input</option>
        </select>
      </div>

      {/* Tag facets */}
      {facetTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.length > 0 && (
            <button
              onClick={() => setTags([])}
              className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:underline"
            >
              Clear
            </button>
          )}
          {facetTags.map(({ tag, count }) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  active
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
                aria-pressed={active}
              >
                {tag}
                <span className="text-[10px] opacity-60 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      <div className="grid gap-3 md:grid-cols-2">
        {isLoading && !data
          ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          : items.map((d) => <HubCard key={d.id} d={d} />)}
      </div>

      {!isLoading && !items.length && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/40 p-10 text-center">
          <p className="text-sm font-medium text-slate-600">No deliberations match.</p>
          <p className="mt-1 text-xs text-slate-400">
            Try clearing the search{tags.length ? " or tag filters" : ""}.
          </p>
        </div>
      )}

      {atCap && (
        <p className="text-center text-[11px] text-slate-400">
          Showing the first 40 — refine your search to narrow results.
        </p>
      )}
    </div>
  );
}
