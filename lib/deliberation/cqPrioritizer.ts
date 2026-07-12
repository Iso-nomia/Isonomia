/**
 * CQ prioritizer — Phase 2.1.
 *
 * Pure helper that re-projects a deliberation's open critical questions
 * into a priority-ordered list suitable for *inline nudges* in a
 * briefing (as opposed to the flat, exhaustive list a Phase 1 scorecard
 * grades recall against).
 *
 * Why a separate projection?
 * --------------------------
 * `frontier.unansweredCqs` is exhaustive: every open CQ on every
 * argument with a scheme. For an LLM briefing or a UI nudge the
 * exhaustive list is noise — a 50-argument deliberation may have
 * 100+ open CQs, most of them on leaf/peripheral arguments where
 * answering them moves nothing structurally.
 *
 * The prioritized list ranks unanswered CQs by the load-bearingness
 * of the argument they target, so the briefing can promote a small
 * top-K as "engage these first." The ordering is deterministic and
 * the underlying recall set is unchanged — this is purely a
 * presentation/priority layer.
 *
 * Contract:
 *   - Same input → same output (no I/O, no randomness).
 *   - Stable sort: ties broken by (severity, argId, cqKey) lexically
 *     so two runs over the same payload produce identical orderings.
 *   - Never invents CQs not present in `frontier.unansweredCqs`.
 *   - Never drops CQs — the full prioritized list is returned. Callers
 *     are responsible for taking the top-K.
 */

import type { SyntheticReadout } from "@/lib/deliberation/syntheticReadout";

export interface PrioritizedOpenCq {
  /** Argument the CQ targets. */
  targetArgumentId: string;
  /** Scheme this CQ comes from. */
  schemeKey: string;
  /** CQ key within that scheme. */
  cqKey: string;
  /** Stable composite id, format `argId::cqKey`. Matches manifest.openCqs. */
  id: string;
  /** Human-readable CQ prompt (already in `frontier.unansweredCqs`). */
  prompt: string;
  /** Catalog severity (scheme-required vs scheme-recommended). */
  severity: "scheme-required" | "scheme-recommended";
  /**
   * The argument's load-bearingness score from
   * `frontier.loadBearingnessScores`. Higher = the argument supports
   * more of the graph; engaging this CQ moves more structure.
   */
  loadBearingScore: number;
  /**
   * True iff `targetArgumentId` is in `topology.hubs.set` — i.e. this
   * CQ targets a graph hub and is therefore highest priority.
   */
  targetsHub: boolean;
  /** 0-based position in the prioritized list. */
  rank: number;
}

/**
 * Project `readout.frontier.unansweredCqs` into a priority-ordered
 * list, attaching load-bearingness + hub-membership context.
 */
export function derivePrioritizedOpenCqs(
  readout: Pick<SyntheticReadout, "frontier" | "topology">,
): PrioritizedOpenCq[] {
  const unanswered = readout.frontier?.unansweredCqs ?? [];
  if (unanswered.length === 0) return [];

  const scores = readout.frontier?.loadBearingnessScores ?? {};
  const hubSet = new Set(
    (readout.topology?.hubs?.set ?? []).map((h) => h.argumentId),
  );

  // Severity sort key: required outranks recommended.
  const severityRank = (s: "scheme-required" | "scheme-recommended") =>
    s === "scheme-required" ? 0 : 1;

  const enriched = unanswered.map((q) => {
    const loadBearingScore = scores[q.targetArgumentId] ?? 0;
    const targetsHub = hubSet.has(q.targetArgumentId);
    return {
      targetArgumentId: q.targetArgumentId,
      schemeKey: q.schemeKey,
      cqKey: q.cqKey,
      id: `${q.targetArgumentId}::${q.cqKey}`,
      prompt: q.cqPrompt,
      severity: q.severity,
      loadBearingScore,
      targetsHub,
    };
  });

  enriched.sort((a, b) => {
    // Hub-targeting first.
    if (a.targetsHub !== b.targetsHub) return a.targetsHub ? -1 : 1;
    // Then by load-bearingness desc.
    if (a.loadBearingScore !== b.loadBearingScore)
      return b.loadBearingScore - a.loadBearingScore;
    // Then by severity (required before recommended).
    if (a.severity !== b.severity)
      return severityRank(a.severity) - severityRank(b.severity);
    // Stable lexical fallback.
    if (a.targetArgumentId !== b.targetArgumentId)
      return a.targetArgumentId < b.targetArgumentId ? -1 : 1;
    return a.cqKey < b.cqKey ? -1 : 1;
  });

  return enriched.map((q, i) => ({ ...q, rank: i }));
}
