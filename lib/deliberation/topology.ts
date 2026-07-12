/**
 * DeliberationTopology — Track AI-EPI Pt. 4 §5 (Phase 1 hardening).
 *
 * Surfaces *structural shape* signals that a flat ranked list of
 * arguments cannot convey. Specifically:
 *
 *   - hubs: the load-bearingness *cluster* at the top of the graph,
 *     not just the single highest-ranked id. An LLM consuming
 *     `loadBearingnessRanking[0]` will collapse co-equal hubs into
 *     "the hub" and produce false centrist prose. This block makes
 *     the hub *set with multiplicity* a structured field.
 *
 *   - loadBearingPremises: premises whose retraction would cascade.
 *     Load-bearingness is otherwise an argument-level signal; this
 *     surfaces premise-level cascade exposure (a premise used by N
 *     load-bearing arguments).
 *
 *   - ambiguity: explicit calibrated-uncertainty markers. When the
 *     topology is genuinely ambiguous (multiple co-equal hubs, many
 *     premises sharing cascade exposure), the readout *says so*. A
 *     downstream synthesis client that picks a single hub or premise
 *     anyway is lying about a structured field.
 *
 *   - sizeTier: explicit size class + a `hierarchicalMode` flag for
 *     very-large deliberations. When the briefing is degraded for
 *     scale reasons, the disclosure must travel with the briefing so
 *     the consumer can surface it honestly.
 *
 * All signals are deterministic functions of the frontier + a small
 * premise→argument query. No prose generation.
 */

import { prisma } from "@/lib/prismaclient";
import type { ContestedFrontier } from "@/lib/deliberation/frontier";

export type HubShape =
  | "single-dominant"
  | "co-equal-cluster"
  | "diffuse"
  | "empty";

export interface TopologyHub {
  argumentId: string;
  /** Raw load-bearingness score (heuristic; see frontier.ts). */
  score: number;
}

export interface TopologyHubs {
  /**
   * The hub *set*. When `shape === "single-dominant"`, length is 1.
   * When `shape === "co-equal-cluster"`, length is the count of
   * arguments at the top tier. When `shape === "diffuse"`, length is 0.
   */
  set: TopologyHub[];
  /** Highest score observed (for context). */
  topScore: number;
  /**
   * Score gap below which an argument is considered co-equal with
   * the top. Computed as `max(1, ceil(0.2 * topScore))`.
   */
  coequalThreshold: number;
  shape: HubShape;
}

export interface LoadBearingPremise {
  claimId: string;
  /** Premise text (truncated to 200 chars). */
  claimText: string | null;
  /** Number of arguments using this claim as a premise. */
  usingArgumentCount: number;
  /**
   * Sum of load-bearingness scores of arguments using this premise.
   * Higher → retraction would cascade further.
   */
  cascadeScore: number;
  /** Argument ids using this premise (capped to 25 for payload size). */
  usingArgumentIds: string[];
}

export type AmbiguityLevel = "none" | "low" | "medium" | "high";

export interface TopologyAmbiguity {
  /**
   * How ambiguous the hub structure is. Anything other than `"none"`
   * means a synthesis client must NOT name a single hub; the briefing
   * has multiple co-equal candidates.
   */
  hubAmbiguity: AmbiguityLevel;
  /**
   * How concentrated cascade exposure is across premises. `"high"`
   * means many premises share retraction-cascade exposure; pulling on
   * any single one is misleading.
   */
  premiseConcentration: AmbiguityLevel;
  /**
   * Human-readable structural cautions, intended for verbatim inclusion
   * in writing-constraints / consumer prompts. Each entry is a
   * deterministic string template, not generative prose.
   */
  cautions: string[];
}

export type SizeTierLabel = "small" | "medium" | "large" | "very-large";

export interface SizeTier {
  argumentCount: number;
  tier: SizeTierLabel;
  /**
   * True when the briefing is operating in degraded / hierarchical
   * mode because the deliberation is too large for full hydration.
   * When true, the consumer must surface `disclosure` in any output
   * derived from this briefing.
   */
  hierarchicalMode: boolean;
  /** Honest disclosure string when `hierarchicalMode` is true; otherwise null. */
  disclosure: string | null;
}

export interface DeliberationTopology {
  hubs: TopologyHubs;
  loadBearingPremises: LoadBearingPremise[];
  ambiguity: TopologyAmbiguity;
  sizeTier: SizeTier;
}

// ────────────────────────────────────────────────────────────
// Tunables. Centralised for the eval harness to perturb.
// ────────────────────────────────────────────────────────────

const HUB_COEQUAL_FRACTION = 0.2;
const HUB_DIFFUSE_THRESHOLD = 5; // > this many co-equal hubs → diffuse
const PREMISE_TOP_K = 10;
const PREMISE_USAGE_TRUNC = 25;
const PREMISE_TEXT_TRUNC = 200;
const PREMISE_LOAD_BEARING_MIN_SCORE = 4; // cascadeScore floor to count

// Size tiers — must match the four-tier degradation model in
// docs/isonomia-ai-roadmap.md (cross-cutting cost/latency workstream).
const SIZE_TIER_SMALL_MAX = 20;
const SIZE_TIER_MEDIUM_MAX = 80;
const SIZE_TIER_LARGE_MAX = 250;

export function classifySize(argumentCount: number): SizeTierLabel {
  if (argumentCount <= SIZE_TIER_SMALL_MAX) return "small";
  if (argumentCount <= SIZE_TIER_MEDIUM_MAX) return "medium";
  if (argumentCount <= SIZE_TIER_LARGE_MAX) return "large";
  return "very-large";
}

export function buildHubs(scores: Record<string, number>): TopologyHubs {
  const entries = Object.entries(scores);
  if (entries.length === 0) {
    return {
      set: [],
      topScore: 0,
      coequalThreshold: 0,
      shape: "empty",
    };
  }
  let topScore = -Infinity;
  for (const [, s] of entries) {
    if (s > topScore) topScore = s;
  }
  if (topScore <= 0) {
    return {
      set: [],
      topScore,
      coequalThreshold: 0,
      shape: "empty",
    };
  }
  const coequalThreshold = Math.max(
    1,
    Math.ceil(HUB_COEQUAL_FRACTION * topScore),
  );
  const cutoff = topScore - coequalThreshold;
  const hubSet = entries
    .filter(([, s]) => s >= cutoff && s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([argumentId, score]) => ({ argumentId, score }));

  let shape: HubShape;
  if (hubSet.length === 0) {
    shape = "empty";
  } else if (hubSet.length === 1) {
    shape = "single-dominant";
  } else if (hubSet.length <= HUB_DIFFUSE_THRESHOLD) {
    shape = "co-equal-cluster";
  } else {
    shape = "diffuse";
  }

  return {
    set: hubSet,
    topScore,
    coequalThreshold,
    shape,
  };
}

async function computeLoadBearingPremises(
  deliberationId: string,
  scores: Record<string, number>,
): Promise<LoadBearingPremise[]> {
  const premiseRows = await prisma.argumentPremise.findMany({
    where: { argument: { deliberationId } },
    select: {
      argumentId: true,
      claim: { select: { id: true, text: true } },
    },
  });

  type Aggregate = {
    claimId: string;
    claimText: string | null;
    argumentIds: string[];
    cascadeScore: number;
  };
  const byClaim = new Map<string, Aggregate>();
  for (const row of premiseRows) {
    const claimId = row.claim?.id;
    if (!claimId) continue;
    let agg = byClaim.get(claimId);
    if (!agg) {
      const txt = row.claim?.text ?? null;
      agg = {
        claimId,
        claimText:
          txt && txt.length > PREMISE_TEXT_TRUNC
            ? txt.slice(0, PREMISE_TEXT_TRUNC) + "…"
            : txt,
        argumentIds: [],
        cascadeScore: 0,
      };
      byClaim.set(claimId, agg);
    }
    if (!agg.argumentIds.includes(row.argumentId)) {
      agg.argumentIds.push(row.argumentId);
      agg.cascadeScore += scores[row.argumentId] ?? 0;
    }
  }

  return [...byClaim.values()]
    .filter(
      (a) =>
        a.argumentIds.length >= 2 &&
        a.cascadeScore >= PREMISE_LOAD_BEARING_MIN_SCORE,
    )
    .sort((a, b) => {
      if (b.cascadeScore !== a.cascadeScore) {
        return b.cascadeScore - a.cascadeScore;
      }
      return b.argumentIds.length - a.argumentIds.length;
    })
    .slice(0, PREMISE_TOP_K)
    .map((a) => ({
      claimId: a.claimId,
      claimText: a.claimText,
      usingArgumentCount: a.argumentIds.length,
      cascadeScore: a.cascadeScore,
      usingArgumentIds: a.argumentIds.slice(0, PREMISE_USAGE_TRUNC),
    }));
}

export function buildAmbiguity(
  hubs: TopologyHubs,
  loadBearingPremises: LoadBearingPremise[],
): TopologyAmbiguity {
  let hubAmbiguity: AmbiguityLevel;
  switch (hubs.shape) {
    case "single-dominant":
    case "empty":
      hubAmbiguity = "none";
      break;
    case "co-equal-cluster":
      hubAmbiguity = hubs.set.length <= 2 ? "low" : "medium";
      break;
    case "diffuse":
      hubAmbiguity = "high";
      break;
  }

  let premiseConcentration: AmbiguityLevel;
  const lbpCount = loadBearingPremises.length;
  if (lbpCount === 0) premiseConcentration = "none";
  else if (lbpCount === 1) premiseConcentration = "low";
  else if (lbpCount <= 3) premiseConcentration = "medium";
  else premiseConcentration = "high";

  const cautions: string[] = [];
  if (hubAmbiguity !== "none" && hubs.set.length >= 2) {
    cautions.push(
      `${hubs.set.length} arguments share the top load-bearingness tier ` +
        `(scores within ${hubs.coequalThreshold} of the top score ` +
        `${hubs.topScore}). Do not name a single "hub" — the briefing ` +
        `contains multiple co-equal candidates.`,
    );
  }
  if (hubs.shape === "diffuse") {
    cautions.push(
      `Hub structure is diffuse (>${HUB_DIFFUSE_THRESHOLD} co-equal ` +
        `top-tier arguments). The graph has no single load-bearing ` +
        `argument; treat any "central" claim as a synthesis artifact.`,
    );
  }
  if (premiseConcentration === "high") {
    cautions.push(
      `${lbpCount} premises share elevated cascade exposure. Pulling on ` +
        `any single premise is misleading; the graph's robustness depends ` +
        `on the joint set.`,
    );
  }
  if (
    hubs.shape === "empty" &&
    Object.keys(loadBearingPremises).length === 0
  ) {
    cautions.push(
      "No load-bearing structure detected. Treat all arguments as " +
        "equally peripheral; do not synthesise a thesis from this graph.",
    );
  }

  return {
    hubAmbiguity,
    premiseConcentration,
    cautions,
  };
}

export function buildSizeTier(argumentCount: number): SizeTier {
  const tier = classifySize(argumentCount);
  const hierarchicalMode = tier === "very-large";
  const disclosure = hierarchicalMode
    ? `This deliberation has ${argumentCount} arguments. The briefing ` +
      `hydrates only the top-25 load-bearing and top-25 contested ` +
      `arguments; sub-region detail is omitted. Use "get_argument" for ` +
      `specific ids, or request a region-scoped briefing.`
    : null;
  return {
    argumentCount,
    tier,
    hierarchicalMode,
    disclosure,
  };
}

export async function computeDeliberationTopology(
  deliberationId: string,
  frontier: ContestedFrontier,
  argumentCount: number,
): Promise<DeliberationTopology> {
  const scores = frontier.loadBearingnessScores ?? {};
  const hubs = buildHubs(scores);
  const loadBearingPremises = await computeLoadBearingPremises(
    deliberationId,
    scores,
  );
  const ambiguity = buildAmbiguity(hubs, loadBearingPremises);
  const sizeTier = buildSizeTier(argumentCount);
  return { hubs, loadBearingPremises, ambiguity, sizeTier };
}
