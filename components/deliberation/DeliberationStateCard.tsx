/**
 * DeliberationStateCard — Track AI-EPI Pt. 4 §6.
 *
 * The single horizontal honesty-floor card for a deliberation. Renders
 * the deliberation-scope counters from `SyntheticReadout` plus the
 * top-most frontier item, the top-most missing move (by severity), and
 * — when present — the `articulationOnly` chip that flags
 * AI-articulated, not-yet-deliberated rooms.
 *
 * The card's `honestyLine` and "see protocol readout" drawer are the
 * non-expert-legible form of the Pt. 4 editorial primitive. A consumer
 * who reads only this card already has the structured caveats the
 * downstream MCP tools enforce on LLMs.
 *
 * Click any field → seeks the relevant DeepDivePanel tab via the
 * `mesh:deepdive:setTab` event (caught in DeepDivePanelV2). Click "see
 * protocol readout" → opens a Sheet with the full structured readout.
 */
"use client";

import * as React from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { SyntheticReadout } from "@/lib/deliberation/syntheticReadout";

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  });

type Props = {
  deliberationId: string;
  /** Optional click-into-tab hook (DeepDivePanel mounts a listener). */
  onSeekTab?: (tab: string, focus?: { argumentId?: string }) => void;
  /** Visual density. `compact` for embeds; `default` for in-app DeepDive. */
  density?: "default" | "compact";
};

const fmtPct = (num: number, denom: number) =>
  denom > 0 ? `${Math.round((num / denom) * 100)}%` : "—";

export function DeliberationStateCard({
  deliberationId,
  onSeekTab,
  density = "default",
}: Props) {
  const { data, error, isLoading } = useSWR<SyntheticReadout>(
    deliberationId
      ? `/api/v3/deliberations/${encodeURIComponent(deliberationId)}/synthetic-readout`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 60_000,
      dedupingInterval: 30_000,
    },
  );

  if (isLoading) return <DeliberationStateCardSkeleton density={density} />;
  if (error || !data) return null;

  const fp = data.fingerprint;
  const cqPct = fmtPct(fp.cqCoverage.answered, fp.cqCoverage.total);
  const refusalCount = data.refusalSurface.cannotConcludeBecause.length;

  // Top frontier item: prefer scheme-required severity, then actively-raised.
  const topFrontier = pickTopFrontier(data);

  // Top missing move: scan perArgument for the highest-severity missing item.
  const topMissing = pickTopMissingMove(data);

  const articulationOnly = fp.extraction.articulationOnly;

  const handleSeek = (tab: string, focus?: { argumentId?: string }) => {
    if (onSeekTab) onSeekTab(tab, focus);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mesh:deepdive:setTab", {
          detail: { tab, ...focus },
        }),
      );
    }
  };

  const padding = density === "compact" ? "p-3" : "p-4";
  const titleSize = density === "compact" ? "text-xs" : "text-sm";

  return (
    <Card
      className={`w-full ${padding} bg-gradient-to-r from-white via-orange-50/30 to-white border-orange-200/60`}
      data-testid="deliberation-state-card"
    >
      {/* ── Header row: title + chips + drawer trigger ───────────── */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={`${titleSize} font-semibold text-amber-900 uppercase tracking-wide`}>
          Deliberation readout
        </div>
        <div className="flex items-center gap-3   flex-wrap justify-end">
          {articulationOnly && (
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-900  text-[11px] px-1 py-.5 bg-amber-100"
              data-testid="chip-articulation-only"
              title="AI-articulated, not yet deliberated"
            >
              articulation only
            </Badge>
          )}
          {refusalCount > 0 && (
            <Badge
              variant="outline"
              className="border-rose-400 text-rose-900 mt-2 text-[11px] px-1 py-.5 bg-rose-50"
              data-testid="chip-refusal-count"
              title="Conclusions the graph will not currently license"
            >
              {refusalCount} refusal{refusalCount === 1 ? "" : "s"}
            </Badge>
          )}
          {fp.depthDistribution.thin > 0 && (
            <Badge
              variant="outline"
              className="border-slate-400 text-[11px] px-1 py-.5 mt-2  text-slate-700 bg-slate-50"
              title="Arguments with thin standing depth"
            >
              {fp.depthDistribution.thin} sparse
            </Badge>
          )}
          <ProtocolReadoutDrawer
            readout={data}
            density={density}
            onSeek={handleSeek}
          />
        </div>
      </div>

      {/* ── Honesty line: full-width row, stacks above stats ─────── */}
      <div className="text-xs text-slate-700 leading-snug mb-3 max-w-3xl">
        {data.honestyLine}
      </div>

      {/* ── Stat tiles: own row, wraps cleanly on narrow widths ──── */}
      <div className="flex bg-white items-center gap-x-4 gap-y-2 flex-wrap pt-2 border-b border-b-orange-500/70 border-t border-t-orange-500/70">
        <Stat
          label="arguments"
          value={fp.argumentCount}
          onClick={() => handleSeek("arguments")}
          testId="stat-arguments"
        />
        <Stat
          label="participants"
          value={fp.participantCount}
          testId="stat-participants"
        />
        <Stat
          label="challenger coverage"
          value={`${Math.round(fp.challengerCoverage * 100)}%`}
          testId="stat-challenger-coverage"
        />
        <Stat
          label="median challengers"
          value={`${fp.medianChallengerCountAmongChallenged} (when challenged)`}
          testId="stat-median-challengers"
        />
        <Stat
          label="CQ coverage"
          value={cqPct}
          onClick={() => handleSeek("arguments")}
          testId="stat-cq-coverage"
        />
        <Stat
          label="chains"
          value={fp.chainCount}
          onClick={() => handleSeek("chains")}
          testId="stat-chains"
        />
      </div>

      {/* ── Top frontier + missing move (one-liners) ─────────────── */}
      {(topFrontier || topMissing) && (
        <div className=" mt-4  grid grid-cols-1 md:grid-cols-2 gap-2">
          {topFrontier && (
            <button
              type="button"
              className="text-left w-fit border-orange-400 text-xs text-slate-700 rounded-xl btnv2--ghost bg-orange-50 hover:bg-orange-50  px-3 py-1 transition"
              onClick={() => handleSeek("frontier")}
              data-testid="top-frontier-item"
            >
              <span className="font-semibold  text-amber-900">Top open thread:</span>{" "}
              {topFrontier}
            </button>
          )}
          {topMissing && (
            <button
              type="button"
              className="text-left w-fit border-orange-400 text-xs text-slate-700 rounded-xl btnv2--ghost bg-orange-50 hover:bg-orange-50  px-3 py-1 transition"
              onClick={() => handleSeek("frontier")}
              data-testid="top-missing-move"
            >
              <span className="font-semibold text-amber-900">Top missing move:</span>{" "}
              {topMissing}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  onClick,
  testId,
}: {
  label: string;
  value: string | number;
  onClick?: () => void;
  testId?: string;
}) {
  const inner = (
    <div className="flex flex-col items-center min-w-[60px]" data-testid={testId}>
      <div className="text-[14px] font-medium text-slate-900 tabular-nums leading-none">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-1">
        {label}
      </div>
    </div>
  );
  if (!onClick) return inner;
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-amber-50 rounded px-1.5 py-1 transition"
    >
      {inner}
    </button>
  );
}

function pickTopFrontier(readout: SyntheticReadout): string | null {
  const f = readout.frontier;

  // Highest-severity unanswered undercut.
  const requiredUndercut = f.unansweredUndercuts.find(
    (u) => u.severity === "scheme-required",
  );
  if (requiredUndercut) {
    if (requiredUndercut.schemeTypical && requiredUndercut.undercutTypeKey) {
      return `missing scheme-required undercut "${requiredUndercut.undercutTypeKey}"`;
    }
    return `unanswered undercut on argument ${truncId(requiredUndercut.targetArgumentId)}`;
  }

  const anyActive = f.unansweredUndercuts.find((u) => !u.schemeTypical);
  if (anyActive) {
    return `unanswered undercut on argument ${truncId(anyActive.targetArgumentId)}`;
  }

  const undermine = f.unansweredUndermines[0];
  if (undermine) {
    return `unanswered premise attack on argument ${truncId(undermine.targetArgumentId)}`;
  }

  const cq = f.unansweredCqs.find((c) => c.severity === "scheme-required") ?? f.unansweredCqs[0];
  if (cq) {
    return `unanswered CQ "${cq.cqKey}" on argument ${truncId(cq.targetArgumentId)}`;
  }

  return null;
}

function pickTopMissingMove(readout: SyntheticReadout): string | null {
  // Per-deliberation rollups first.
  const mm = readout.missingMoves.perDeliberation;
  if (mm.schemesUnused.length > 0) {
    return `unused scheme${mm.schemesUnused.length === 1 ? "" : "s"}: ${mm.schemesUnused.slice(0, 2).join(", ")}`;
  }
  if (mm.metaArgumentsAbsent) return "no meta-argument targets the deliberation itself";
  if (mm.crossSchemeMediatorsAbsent) return "no cross-scheme mediator (e.g. practical-reasoning)";

  // Per-argument scan for the highest-severity missing undercut.
  for (const perArg of Object.values(readout.missingMoves.perArgument)) {
    const required = perArg.missingUndercutTypes.find(
      (m) => m.severity === "scheme-required",
    );
    if (required) {
      return `missing "${required.label}" undercut on argument ${truncId(perArg.argumentId)}`;
    }
  }
  return null;
}

function truncId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 6)}…` : id;
}

function DeliberationStateCardSkeleton({ density }: { density: "default" | "compact" }) {
  return (
    <Card
      className={`w-full ${density === "compact" ? "p-3" : "p-4"} bg-slate-50 border-slate-200 animate-pulse`}
      aria-busy
    >
      <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-3/4 bg-slate-200 rounded" />
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// Drawer with full structured readout. Renders every field by
// name — no free prose. Click-into-graph hooks reuse the same
// `mesh:deepdive:setTab` channel.
// ────────────────────────────────────────────────────────────────

function ProtocolReadoutDrawer({
  readout,
  density,
  onSeek,
}: {
  readout: SyntheticReadout;
  density: "default" | "compact";
  onSeek: (tab: string, focus?: { argumentId?: string }) => void;
}) {
  const fp = readout.fingerprint;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button

          className="border-amber-300 text-amber-900 text-xs p-3 btnv2--ghost bg-amber-50 hover:bg-amber-100"
          data-testid="open-protocol-readout"
        >
          See protocol readout
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Protocol readout</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5 text-sm text-slate-800">
          <section className="border border-slate-400/40 rounded-xl p-1">
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Honesty Line
            </h3>
            <p className="text-sm leading-snug">{readout.honestyLine}</p>
            <div className="mt-1 text-[10px] font-mono text-slate-400 break-all">
              contentHash: {readout.contentHash}
            </div>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              fingerprint
            </h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-500">arguments</dt>
              <dd className="tabular-nums">{fp.argumentCount}</dd>
              <dt className="text-slate-500">claims</dt>
              <dd className="tabular-nums">{fp.claimCount}</dd>
              <dt className="text-slate-500">participants</dt>
              <dd className="tabular-nums">{fp.participantCount}</dd>
              <dt className="text-slate-500">authors (h/ai/hyb)</dt>
              <dd className="tabular-nums">
                {fp.authorCount.human}/{fp.authorCount.ai}/{fp.authorCount.hybrid}
              </dd>
              <dt className="text-slate-500">edges (sup/atk/ca)</dt>
              <dd className="tabular-nums">
                {fp.edgeCount.support}/{fp.edgeCount.attack}/{fp.edgeCount.ca}
              </dd>
              <dt className="text-slate-500">depth (thin/mod/dense)</dt>
              <dd className="tabular-nums">
                {fp.depthDistribution.thin}/{fp.depthDistribution.moderate}/{fp.depthDistribution.dense}
              </dd>
              <dt className="text-slate-500">CQ coverage</dt>
              <dd className="tabular-nums">
                {fp.cqCoverage.answered}/{fp.cqCoverage.total} answered
              </dd>
              <dt className="text-slate-500">chains</dt>
              <dd className="tabular-nums">{fp.chainCount}</dd>
              <dt className="text-slate-500">articulationOnly</dt>
              <dd>{String(fp.extraction.articulationOnly)}</dd>
            </dl>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              refusalSurface ({readout.refusalSurface.cannotConcludeBecause.length})
            </h3>
            {readout.refusalSurface.cannotConcludeBecause.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No conclusions are currently refused by the graph.
              </p>
            ) : (
              <ul className="space-y-2">
                {readout.refusalSurface.cannotConcludeBecause.map((r, i) => (
                  <li
                    key={i}
                    className="text-xs border border-rose-200 bg-rose-50 rounded p-2"
                  >
                    <div className="font-semibold text-rose-900 mb-0.5">
                      {r.blockedBy}
                    </div>
                    <div className="text-slate-700">
                      {r.attemptedConclusion === "<deliberation-scope>"
                        ? "(deliberation-scope)"
                        : r.attemptedConclusion}
                    </div>
                    {r.blockerIds.length > 0 && (
                      <div className="text-[10px] font-mono text-slate-500 mt-1">
                        blockerIds: {r.blockerIds.map(truncId).join(", ")}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              frontier
            </h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-500">unanswered undercuts</dt>
              <dd className="tabular-nums">{readout.frontier.unansweredUndercuts.length}</dd>
              <dt className="text-slate-500">unanswered undermines</dt>
              <dd className="tabular-nums">{readout.frontier.unansweredUndermines.length}</dd>
              <dt className="text-slate-500">unanswered CQs</dt>
              <dd className="tabular-nums">{readout.frontier.unansweredCqs.length}</dd>
              <dt className="text-slate-500">terminal leaves</dt>
              <dd className="tabular-nums">{readout.frontier.terminalLeaves.length}</dd>
            </dl>
            <Button


              className="mt-2 btnv2 text-xs"
              onClick={() => onSeek("frontier")}
            >
              Open Frontier tab →
            </Button>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              missingMoves
            </h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-500">schemes unused</dt>
              <dd>{readout.missingMoves.perDeliberation.schemesUnused.join(", ") || "—"}</dd>
              <dt className="text-slate-500">meta-arguments absent</dt>
              <dd>{String(readout.missingMoves.perDeliberation.metaArgumentsAbsent)}</dd>
              <dt className="text-slate-500">cross-scheme mediator absent</dt>
              <dd>{String(readout.missingMoves.perDeliberation.crossSchemeMediatorsAbsent)}</dd>
            </dl>
          </section>

          <section >
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              chains ({readout.chains.chains.length})
            </h3>
            {readout.chains.chains.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No chains yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {readout.chains.chains.slice(0, 6).map((c) => (
                  <li
                    key={c.id}
                    className="text-xs border border-slate-200 rounded-xl bg-indigo-50/40 p-2"
                  >
                    <div className="font-semibold text-slate-800">
                      {c.name || `chain ${truncId(c.id)}`}
                    </div>
                    <div className="text-slate-600">
                      standing: <span className="font-mono">{c.chainStanding}</span> ·
                      fitness: <span className="tabular-nums">{c.chainFitness.total.toFixed(2)}</span>
                    </div>
                    {c.weakestLink && (
                      <div className="text-[11px] text-rose-700">
                        weakest link: {truncId(c.weakestLink.argumentId)} — {c.weakestLink.reason}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Button
                      className="mt-2 btnv2 text-xs"


              onClick={() => onSeek("chains")}
            >
              Open Chains tab →
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default DeliberationStateCard;
