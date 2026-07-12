/**
 * Briefing payload — the composite, LLM-consumable endpoint for the
 * AI-EPI Phase 1 contract.
 *
 * Background. The AI-EPI roadmap (Phase 1) requires a single
 * deliberation-scope payload that downstream synthesis clients (LLM
 * briefings, summarizers, "what does this deliberation think?" UI) can
 * consume in one round trip and from which they can produce structurally
 * faithful prose. That payload IS the `SyntheticReadout` — the editorial
 * primitive defined in `lib/deliberation/syntheticReadout.ts`. This
 * module:
 *
 *   1. Re-exports `SyntheticReadout` under the name `BriefingPayload` so
 *      callers don't have to import the readout module directly and so
 *      the Phase 1 contract has a stable, distinct name.
 *   2. Exposes `buildBriefingPayload(deliberationId)` — the one
 *      entrypoint clients should call. Returns the readout or `null`
 *      when the deliberation is unreachable / empty.
 *   3. Documents the canonical tool-call sequence an LLM briefing
 *      should follow.
 *
 * NOT in scope:
 *   - LLM transport. This module returns structured data; it does not
 *     call an LLM, does not render prose, does not assemble a system
 *     prompt. Those live in the `eval/ai-epi/llm/` adapters and in the
 *     consuming feature (synthesis route, briefing UI, etc.).
 *   - Truncation / chunking for token budgets. Consumers that need a
 *     smaller object for cheap models should project away
 *     `mostContested`, narrow `topArguments` to the top-K, or fall back
 *     to `fingerprint` + `refusalSurface` + `topology` alone. The full
 *     payload is intentionally complete.
 *
 * Canonical tool-call sequence (recommended for LLM clients):
 *
 *   1. `get_briefing_payload(deliberationId)` → BriefingPayload
 *      (this module). Single fetch. All structural ground-truth in one
 *      object.
 *   2. Optional drill-downs only when the briefing genuinely needs more
 *      than the payload surfaces:
 *      - `get_argument(argumentId)` for full premise/citation detail on
 *        a specific load-bearing argument.
 *      - `get_claim(claimId)` for the canonical text of a specific
 *        conclusion or load-bearing premise.
 *   3. NO synthesis tool calls. The briefing MUST be assembled by the
 *      LLM from the payload + drill-downs, not by asking the server
 *      "what should the briefing say?"
 *
 * Fidelity contract (Phase 1 scorecard checks these mechanically; see
 * `eval/ai-epi/scorecard/phase1.ts`):
 *   - Hub claims (`claimedHubSet`, `claimedHubShape`) must match
 *     `topology.hubSet` / `topology.hubShape` or the briefing must
 *     explicitly flag topology uncertainty
 *     (`expressedTopologyUncertainty: true`).
 *   - The briefing MUST NOT assert any conclusion present in
 *     `refusalSurface.cannotConcludeBecause`.
 *   - When `topology.sizeTier === "very-large"` (hierarchicalMode), the
 *     briefing MUST surface a size disclosure
 *     (`surfacedHierarchicalDisclosure: true`).
 *   - Open critical questions (`frontier.openCriticalQuestions`) MUST be
 *     surfaced as gaps, not silently closed.
 */

import {
  computeSyntheticReadout,
  type ContestedArgumentSummary,
  type SyntheticReadout,
  type TopArgumentSummary,
} from "@/lib/deliberation/syntheticReadout";
import {
  derivePrioritizedOpenCqs,
  type PrioritizedOpenCq,
} from "@/lib/deliberation/cqPrioritizer";
import {
  mockPremiseExtractor,
  type PremiseAtom,
  type PremiseExtractor,
} from "@/lib/deliberation/premiseExtractor";

/**
 * A top argument enriched with atomized premises (Phase 2.2). The
 * `premises` field is populated by `buildBriefingPayload` using the
 * mock extractor so downstream LLM consumers can reason at premise
 * granularity rather than on the prose `argumentText` blob.
 */
export type BriefingTopArgument = TopArgumentSummary & {
  premises?: PremiseAtom[];
};

export type BriefingContestedArgument = ContestedArgumentSummary & {
  premises?: PremiseAtom[];
};

/**
 * The composite payload an LLM briefing consumes. A superset of
 * `SyntheticReadout` — the raw readout plus the derived
 * `prioritizedOpenCqs` projection (Phase 2.1) that orders unanswered
 * CQs by the load-bearingness of the argument they target, so a
 * briefing can promote a small top-K as inline nudges without
 * re-ranking the flat `frontier.unansweredCqs` itself.
 *
 * `topArguments` and `mostContested` are extended with `premises`
 * (Phase 2.2): each argument's `argumentText` has been atomized into
 * discrete premise handles so the LLM can surface specific load-bearing
 * atoms rather than citing the prose blob.
 *
 * Stable surface for downstream consumers. If the readout grows fields
 * those become part of the briefing contract; if a field is dropped,
 * that's a breaking change to the Phase 1/2 contract.
 */
export type BriefingPayload = Omit<
  SyntheticReadout,
  "topArguments" | "mostContested"
> & {
  topArguments: BriefingTopArgument[];
  mostContested: BriefingContestedArgument[];
  /**
   * Open critical questions re-projected with hub-membership and
   * load-bearingness, ordered for promotion as inline nudges. Pure
   * derivation of `frontier.unansweredCqs` + `frontier.loadBearingnessScores`
   * + `topology.hubs.set`; see `lib/deliberation/cqPrioritizer.ts`.
   */
  prioritizedOpenCqs: PrioritizedOpenCq[];
};

/**
 * Single-call assembler. Returns the full briefing payload for
 * `deliberationId`, or `null` if no payload can be produced (e.g.
 * unknown id, fingerprint failure, empty graph).
 *
 * Phase 2.2: `topArguments` and `mostContested` are enriched with
 * atomized `premises` using the provided extractor (defaults to the
 * deterministic mock — no network). Pass a real extractor for higher
 * fidelity in offline/nightly runs.
 *
 * Deterministic and cache-friendly: backed by
 * `computeSyntheticReadout`, which keys its cache on
 * (deliberationId, contentHash). Two calls for the same graph state
 * return the same object.
 */
export async function buildBriefingPayload(
  deliberationId: string,
  extractor: PremiseExtractor = mockPremiseExtractor,
): Promise<BriefingPayload | null> {
  const readout = await computeSyntheticReadout(deliberationId);
  if (!readout) return null;
  const atomized = await atomizeReadoutForLlm(readout, extractor);
  return {
    ...atomized,
    topArguments: atomized.topArguments as BriefingTopArgument[],
    mostContested: atomized.mostContested as BriefingContestedArgument[],
    prioritizedOpenCqs: derivePrioritizedOpenCqs(readout),
  };
}

async function _atomizeArguments<T extends TopArgumentSummary>(
  args: T[],
  extractor: PremiseExtractor,
): Promise<Array<T & { premises?: PremiseAtom[] }>> {
  return Promise.all(
    args.map(async (arg) => {
      if (!arg.argumentText) return arg;
      const { premises } = await extractor.extract(arg.argumentText);
      return { ...arg, premises };
    }),
  );
}

/**
 * Async pre-pass for the LLM-bound pipeline: enrich a raw
 * `SyntheticReadout` (e.g. a fixture snapshot) with atomized
 * `premises` on `topArguments` and `mostContested` so the downstream
 * `toCompactForLlm` transform can drop the prose `argumentText`
 * blobs without losing information (Reading A: never strip a signal
 * unless a structured replacement is present).
 *
 * Mirrors the enrichment `buildBriefingPayload` does for the
 * live-DB path. Used by eval harnesses (`openaiClient`) that consume
 * fixture-shaped readouts directly and cannot call
 * `buildBriefingPayload`.
 *
 * Pure with respect to extractor determinism: `mockPremiseExtractor`
 * gives bit-stable output for the same input.
 */
export async function atomizeReadoutForLlm(
  readout: SyntheticReadout,
  extractor: PremiseExtractor = mockPremiseExtractor,
): Promise<SyntheticReadout> {
  const [topArguments, mostContested] = await Promise.all([
    _atomizeArguments(readout.topArguments, extractor),
    _atomizeArguments(readout.mostContested, extractor),
  ]);
  return {
    ...readout,
    topArguments: topArguments as SyntheticReadout["topArguments"],
    mostContested: mostContested as SyntheticReadout["mostContested"],
  };
}

/**
 * Apply a token-budget compact transform to a `SyntheticReadout` (or
 * any runtime-compatible superset such as a fixture snapshot). Safe to
 * call before sending a payload to a token-limited model.
 *
 * Compact transformations (mirrors the `?view=compact` logic in the
 * synthetic-readout API route):
 *   - `frontier.unansweredCqs`       → capped at 30; `cqPrompt` stripped
 *   - `frontier.terminalLeaves`      → capped at 10
 *   - `frontier.loadBearingnessRanking` / `loadBearingnessScores` → cleared
 *     (redundant: use `topArguments[].id` instead)
 *   - `missingMoves.perArgument`     → entries with neither `missingCqs`
 *     nor `missingUndercutTypes` dropped; arrays kept as-is
 *   - `topArguments` / `mostContested` → when an entry carries a
 *     non-empty atomized `premises[]` (populated by
 *     `atomizeReadoutForLlm` or `buildBriefingPayload`), the bulky
 *     prose `argumentText` blob is dropped in favour of the atoms.
 *     Entries without atoms keep `argumentText` unchanged so callers
 *     that never atomized still see the original prose (Reading A:
 *     never strip a signal unless a structured replacement is present).
 *
 * Reduces the `large-real-db` fixture from ~100k tokens → ~35k tokens,
 * well within the gpt-4o-mini 128k context window. Pre-atomizing the
 * topArguments + mostContested via `atomizeReadoutForLlm` before
 * calling this transform yields a further reduction proportional to
 * the prose-to-atom ratio (typically 2–4×).
 */
export function toCompactForLlm(readout: SyntheticReadout): SyntheticReadout {
  const compactFrontier: SyntheticReadout["frontier"] = {
    ...readout.frontier,
    unansweredCqs: readout.frontier.unansweredCqs
      .slice(0, 30)
      .map((c) => ({
        targetArgumentId: c.targetArgumentId,
        schemeKey: c.schemeKey,
        cqKey: c.cqKey,
        severity: c.severity,
      })) as SyntheticReadout["frontier"]["unansweredCqs"],
    terminalLeaves: readout.frontier.terminalLeaves.slice(0, 10),
    loadBearingnessRanking: [],
    loadBearingnessScores: {},
  };

  const perArg = readout.missingMoves
    .perArgument as Record<string, unknown>;
  const compactPerArgument: Record<string, unknown> = {};
  for (const [argId, raw] of Object.entries(perArg)) {
    const entry = raw as {
      schemeKey: string;
      argumentId: string;
      missingCqs: string[];
      missingUndercutTypes: string[];
    };
    if (
      entry.missingCqs.length === 0 &&
      entry.missingUndercutTypes.length === 0
    ) {
      continue;
    }
    compactPerArgument[argId] = {
      schemeKey: entry.schemeKey,
      argumentId: entry.argumentId,
      missingCqs: entry.missingCqs,
      missingUndercutTypes: entry.missingUndercutTypes,
    };
  }

  return {
    ...readout,
    topArguments: readout.topArguments.map(_dropProseWhenAtomized) as SyntheticReadout["topArguments"],
    mostContested: readout.mostContested.map(_dropProseWhenAtomized) as SyntheticReadout["mostContested"],
    frontier: compactFrontier,
    missingMoves: {
      ...readout.missingMoves,
      perArgument: compactPerArgument as SyntheticReadout["missingMoves"]["perArgument"],
    },
  };
}

/**
 * If the argument carries a non-empty atomized `premises[]`, drop
 * the prose `argumentText` blob; otherwise return the entry
 * unchanged. Atom-only payloads cut the token footprint of
 * top/contested arguments by 2–4× without information loss.
 */
function _dropProseWhenAtomized<T extends TopArgumentSummary>(
  arg: T,
): T | (Omit<T, "argumentText"> & { argumentText?: undefined }) {
  const premises = (arg as T & { premises?: PremiseAtom[] }).premises;
  if (!premises || premises.length === 0) return arg;
  const { argumentText: _drop, ...rest } = arg as T & {
    argumentText?: string;
  };
  void _drop;
  return rest as Omit<T, "argumentText"> & { argumentText?: undefined };
}
