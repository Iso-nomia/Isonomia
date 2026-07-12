"use client";

/**
 * Client-side filter form for the public argument search page.
 *
 * Submits as a plain GET form so the resulting URL (and its results) is
 * shareable, bookmarkable, and crawlable. No client-side data fetching —
 * the server page reads `searchParams` and renders.
 *
 * Phase 1 controls: query, scheme, sort, mode (lexical/hybrid).
 * Phase 2 controls: tested_only, min_cq_satisfied, min_evidence, since/until.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";

export type SearchControlsProps = {
  /** Initial query string. */
  initialQ: string;
  /** Initial scheme key (free-text for now; populated dropdown comes later). */
  initialScheme: string;
  /** Initial sort key. */
  initialSort: "recent" | "dialectical_fitness";
  /** Initial retrieval mode. */
  initialMode: "hybrid" | "lexical" | "vector";
  /** Phase 2 — only return arguments that have been challenged. */
  initialTestedOnly?: boolean;
  /** Phase 2 — minimum SATISFIED critical questions. */
  initialMinCq?: string;
  /** Phase 2 — minimum provenance-anchored evidence rows. */
  initialMinEvidence?: string;
  /** Phase 2 — ISO date lower bound on createdAt. */
  initialSince?: string;
  /** Phase 2 — ISO date upper bound on createdAt. */
  initialUntil?: string;
};

const FILTER_LABEL =
  "text-[10px] font-bold tracking-[0.08em] uppercase text-slate-500";
const FILTER_INPUT =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400";

export default function SearchControls({
  initialQ,
  initialScheme,
  initialSort,
  initialMode,
  initialTestedOnly = false,
  initialMinCq = "",
  initialMinEvidence = "",
  initialSince = "",
  initialUntil = "",
}: SearchControlsProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [scheme, setScheme] = useState(initialScheme);
  const [sort, setSort] = useState<typeof initialSort>(initialSort);
  const [mode, setMode] = useState<typeof initialMode>(initialMode);
  const [testedOnly, setTestedOnly] = useState(initialTestedOnly);
  const [minCq, setMinCq] = useState(initialMinCq);
  const [minEvidence, setMinEvidence] = useState(initialMinEvidence);
  const [since, setSince] = useState(initialSince);
  const [until, setUntil] = useState(initialUntil);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (scheme.trim()) next.set("scheme", scheme.trim());
    if (sort !== "recent") next.set("sort", sort);
    if (mode !== "hybrid") next.set("mode", mode);
    if (testedOnly) next.set("tested_only", "1");
    if (minCq.trim() && Number(minCq) > 0) next.set("min_cq_satisfied", String(Math.floor(Number(minCq))));
    if (minEvidence.trim() && Number(minEvidence) > 0) next.set("min_evidence", String(Math.floor(Number(minEvidence))));
    if (since.trim()) next.set("since", since.trim());
    if (until.trim()) next.set("until", until.trim());
    // Preserve `against` if the caller arrived in counter-arg discovery mode.
    const against = params?.get("against");
    if (against) next.set("against", against);
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/search/arguments?${qs}` : "/search/arguments");
    });
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className="flex flex-col gap-3 mb-6 "
    >
      {/* Primary search row */}
      <div className="flex gap-4 flex-wrap ">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            autoComplete="off"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search arguments by conclusion, premise, or general text"
            aria-label="Search query"
            autoFocus
            className="w-full pl-10 pr-4 py-3 text-[15px] border border-indigo-300 rounded-2xl bg-white text-slate-900 articlesearchfield"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-5 py-2 tracking-wide rounded-2xl text-sm font-semibold text-indigo-800  cardv2 hover:shadow-none"
        >
          {isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Searching…
            </>
          ) : (
            <>
              <Search className="w-3.5 h-3.5" />
              Search
            </>
          )}
        </button>
      </div>

      {/* Filters row */}
      <div className="grid mt-3 bg-white/40 grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-indigo-300/70">
        <label className="flex flex-col gap-1.5">
          <span className={FILTER_LABEL}>Scheme</span>
          <input
            type="text"
            name="scheme"
            value={scheme}
            onChange={(e) => setScheme(e.target.value)}
            placeholder="any"
            aria-label="Argumentation scheme key"
            list="known-schemes"
            className={FILTER_INPUT}
          />
          <datalist id="known-schemes">
            <option value="expert_opinion" />
            <option value="cause_to_effect" />
            <option value="analogy" />
            <option value="practical_reasoning" />
            <option value="position_to_know" />
            <option value="popular_opinion" />
            <option value="sign" />
            <option value="example" />
          </datalist>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FILTER_LABEL}>Sort</span>
          <select
            name="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof initialSort)}
            aria-label="Sort order"
            className={FILTER_INPUT}
          >
            <option value="recent">Most recent</option>
            <option value="dialectical_fitness">
              Dialectical fitness (tested-survived)
            </option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FILTER_LABEL}>Mode</span>
          <select
            name="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof initialMode)}
            aria-label="Retrieval mode"
            className={FILTER_INPUT}
          >
            <option value="hybrid">Hybrid (recommended)</option>
            <option value="lexical">Match exact words</option>
            <option value="vector">Semantic only</option>
          </select>
        </label>
      </div>

      {/* Advanced quality filters */}
      <details className="group rounded-xl border border-indigo-300/70 mt-3 bg-white/40 px-4 py-2 [&[open]]:pb-4">
        <summary className="flex items-center gap-2 cursor-pointer text-[11px] font-bold tracking-[0.08em] uppercase text-slate-600 hover:text-slate-900 transition-colors py-1.5 list-none [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Quality filters
          <span className="ml-auto text-[10px] text-slate-400 group-open:hidden">show</span>
          <span className="ml-auto text-[10px] text-slate-400 hidden group-open:inline">hide</span>
        </summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-indigo-300 transition-colors">
            <input
              type="checkbox"
              checked={testedOnly}
              onChange={(e) => setTestedOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
            />
            <span className="text-xs font-medium text-slate-700">
              Only tested arguments
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={FILTER_LABEL}>Min answered CQs</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={minCq}
              onChange={(e) => setMinCq(e.target.value)}
              placeholder="0"
              aria-label="Minimum SATISFIED critical questions"
              className={FILTER_INPUT}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={FILTER_LABEL}>Min evidence (with provenance)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={minEvidence}
              onChange={(e) => setMinEvidence(e.target.value)}
              placeholder="0"
              aria-label="Minimum provenance-anchored evidence rows"
              className={FILTER_INPUT}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={FILTER_LABEL}>Since</span>
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              aria-label="Created on or after"
              className={FILTER_INPUT}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={FILTER_LABEL}>Until</span>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              aria-label="Created on or before"
              className={FILTER_INPUT}
            />
          </label>
        </div>
      </details>
    </form>
  );
}
