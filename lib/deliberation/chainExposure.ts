/**
 * ChainExposure — Track AI-EPI Pt. 4 §4.
 *
 * Read-side projection over `ArgumentChain` records. Surfaces chains as
 * first-class deliberation-scope objects (independent of D4's write-side
 * embedding into Living Thesis). Lets an LLM reading this object say
 * "the strongest empirical-side chain runs A→B→C; weakest link is B
 * (depth thin, CQ confounding unanswered)" — sentences the current MCP
 * surface cannot ground.
 */

import { prisma } from "@/lib/prismaclient";
import {
  computeFitnessBreakdown,
  computeStandingState,
  type StandingState,
  type FitnessBreakdown,
} from "@/lib/citations/argumentAttestation";
import {
  classifyStandingConfidence,
  type StandingConfidence,
} from "@/config/standingThresholds";

export interface ChainEdgeProjection {
  from: string;
  to: string;
  /**
   * Edge type from `ArgumentChainEdgeType` enum. We collapse the full
   * enum down to the three semantically-meaningful kinds for retrieval
   * consumers; the raw enum is preserved as `rawType`.
   */
  type: "PRESUPPOSES" | "ENABLES" | "ATTACKS";
  rawType: string;
}

export interface ChainProjection {
  id: string;
  name: string;
  /**
   * The top claim of the chain (the ArgumentChainNode marked CONCLUSION,
   * or the last node if no role assigned).
   */
  topClaimId: string | null;
  topConclusionText: string | null;
  /** ArgumentIds in traversal order (root → leaves, or chain insertion order). */
  arguments: string[];
  edges: ChainEdgeProjection[];
  /** Worst-link standing across all arguments in the chain. */
  chainStanding: StandingState;
  /** Aggregated fitness — sum of per-argument component counts, normalized. */
  chainFitness: FitnessBreakdown;
  /**
   * The argument with lowest fitness, tie-broken by the largest *fraction* of
   * unanswered critical questions. `null` when no link is differentiable from
   * the others (e.g. every link sits at the untested-default floor) — in that
   * case there is no honest weakest link to name.
   */
  weakestLink: { argumentId: string; reason: string } | null;
}

export interface ChainExposure {
  deliberationId: string;
  chains: ChainProjection[];
  /** Top-level claim ids (conclusions of arguments) with no chain reaching them. */
  uncoveredClaims: string[];
}

const STANDING_RANK: Record<StandingState, number> = {
  "untested-default": 0,
  "untested-supported": 1,
  "tested-attacked": 2,
  "tested-undermined": 3,
  "tested-survived": 4,
};

/**
 * Credibility multiplier for an attacking argument when aggregating
 * chain-level fitness. The previous flat −0.7 per attack edge
 * over-penalised chains whose attackers had themselves been refuted
 * — e.g. Chain-3 in the polarization deliberation published a
 * `chainFitness.total` of −7.0 even though several attack edges
 * originate from `tested-undermined` arguments. The downweighting
 * mirrors the intuition the user repeatedly asked for: "refuted
 * attacks contribute ≈ 0; unanswered contribute full weight."
 *
 * Per-argument fitness in `computeFitnessBreakdown` keeps flat
 * counting; this weighting is *only* applied during chain aggregation
 * so individual argument scores remain comparable across deliberations.
 *
 * Exported so tests (and the Hinge-1 unit assertion in
 * `chainAttackerWeighting.test.ts`) can pin the discount contract
 * without standing up a DB fixture.
 */
export function attackerCredibility(standing: StandingState): number {
  switch (standing) {
    case "tested-undermined":
      return 0.1; // attacker is itself refuted
    case "tested-attacked":
      return 0.5; // attacker is contested but not refuted
    case "tested-survived":
    case "untested-supported":
    case "untested-default":
    default:
      return 1.0; // unanswered → full weight
  }
}

function collapseChainEdgeType(
  raw: string,
): "PRESUPPOSES" | "ENABLES" | "ATTACKS" {
  if (raw === "REFUTES" || raw === "REBUTS" || raw === "UNDERCUTS" || raw === "UNDERMINES") {
    return "ATTACKS";
  }
  if (raw === "PRESUPPOSES") return "PRESUPPOSES";
  // SUPPORTS, ENABLES, QUALIFIES, EXEMPLIFIES, GENERALIZES → ENABLES
  return "ENABLES";
}

export async function computeChainExposure(
  deliberationId: string,
): Promise<ChainExposure | null> {
  const deliberation = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true },
  });
  if (!deliberation) return null;

  const chains = await prisma.argumentChain.findMany({
    where: { deliberationId },
    select: {
      id: true,
      name: true,
      nodes: {
        select: {
          id: true,
          argumentId: true,
          nodeOrder: true,
          role: true,
          argument: {
            select: {
              id: true,
              conclusionClaimId: true,
              conclusion: { select: { text: true } },
            },
          },
        },
        orderBy: { nodeOrder: "asc" },
      },
      edges: {
        select: {
          sourceNodeId: true,
          targetNodeId: true,
          edgeType: true,
        },
      },
    },
  });

  // For every argument referenced by any chain, compute its standing +
  // fitness once, in a single pass.
  const referencedArgIds = [
    ...new Set(chains.flatMap((c) => c.nodes.map((n) => n.argumentId))),
  ];

  const argMetrics = await computeArgumentMetricsBatch(
    referencedArgIds,
    deliberationId,
  );

  // ────────────────────────────────────────────────────────────
  // Attacker-credibility lookup for chain fitness aggregation.
  // For each inbound attack edge to a chain node, look up the source
  // argument's standing and discount the attack's contribution if the
  // source is itself refuted. (Per-arg fitness keeps flat counting;
  // this weighting only applies to the chain rollup.)
  // ────────────────────────────────────────────────────────────
  const inboundAttackEdges =
    referencedArgIds.length > 0
      ? await prisma.argumentEdge.findMany({
          where: {
            deliberationId,
            toArgumentId: { in: referencedArgIds },
            type: { in: ["rebut", "undercut"] },
          },
          select: { toArgumentId: true, fromArgumentId: true },
        })
      : [];
  const distinctAttackerIds = [
    ...new Set(
      inboundAttackEdges
        .map((e) => e.fromArgumentId)
        .filter((id) => !referencedArgIds.includes(id)),
    ),
  ];
  const attackerMetrics =
    distinctAttackerIds.length > 0
      ? await computeArgumentMetricsBatch(distinctAttackerIds, deliberationId)
      : new Map<string, ArgMetrics>();
  const attackerStandingById = new Map<string, StandingState>();
  for (const [id, m] of argMetrics) attackerStandingById.set(id, m.standing);
  for (const [id, m] of attackerMetrics) attackerStandingById.set(id, m.standing);
  // Per-target weighted attack-edge total.
  const weightedInboundByTarget = new Map<string, number>();
  for (const e of inboundAttackEdges) {
    const standing =
      attackerStandingById.get(e.fromArgumentId) ?? "untested-default";
    const weight = attackerCredibility(standing);
    weightedInboundByTarget.set(
      e.toArgumentId,
      (weightedInboundByTarget.get(e.toArgumentId) ?? 0) + weight,
    );
  }

  const projections: ChainProjection[] = chains.map((c) => {
    const nodeIdToArgId = new Map(c.nodes.map((n) => [n.id, n.argumentId] as const));
    const argIds = c.nodes.map((n) => n.argumentId);

    // top claim = the node with role CONCLUSION, else the last node.
    const conclusionNode =
      c.nodes.find((n) => n.role === "CONCLUSION") ?? c.nodes[c.nodes.length - 1];
    const topClaimId = conclusionNode?.argument?.conclusionClaimId ?? null;
    const topConclusionText = conclusionNode?.argument?.conclusion?.text ?? null;

    // worst-link standing — the minimum standing across ALL member arguments,
    // independent of how the chain is wired. A SERIAL spine, a CONVERGENT
    // fan-in, a TREE, and a general GRAPH (DAG) all reduce to "a chain is only
    // as strong as its weakest argument" (PART 4 §6), so topology never changes
    // how standing is derived.
    const worstStanding = selectWorstStanding(
      argIds
        .map((a) => argMetrics.get(a)?.standing)
        .filter((s): s is StandingState => !!s),
    );

    // aggregated fitness: sum component counts, then re-derive contributions.
    // attackEdges uses the per-target *weighted* count so refuted attackers
    // contribute near-zero rather than the full −0.7 penalty.
    const summed = {
      cqAnswered: 0,
      supportEdges: 0,
      attackEdges: 0,
      attackCAs: 0,
      evidenceWithProvenance: 0,
    };
    for (const a of argIds) {
      const m = argMetrics.get(a);
      if (!m) continue;
      summed.cqAnswered += m.fitness.components.cqAnswered.count;
      summed.supportEdges += m.fitness.components.supportEdges.count;
      summed.attackEdges += weightedInboundByTarget.get(a) ?? 0;
      summed.attackCAs += m.fitness.components.attackCAs.count;
      summed.evidenceWithProvenance +=
        m.fitness.components.evidenceWithProvenance.count;
    }
    const chainFitness = computeFitnessBreakdown(summed);

    // weakest link: lowest fitness, tie-broken by the largest *fraction* of
    // unanswered CQs (see selectWeakestLink). `null` when nothing differentiates
    // the links (e.g. all at the untested-default floor with equal CQ pressure).
    const weakestLink = selectWeakestLink(
      argIds.flatMap((a) => {
        const m = argMetrics.get(a);
        if (!m) return [];
        return [
          {
            argumentId: a,
            fitnessTotal: m.fitness.total,
            cqRequired: m.cqRequired,
            cqAnswered: m.cqAnswered,
          },
        ];
      }),
    );

    const edges: ChainEdgeProjection[] = c.edges.map((e) => {
      const fromArg = nodeIdToArgId.get(e.sourceNodeId) ?? "";
      const toArg = nodeIdToArgId.get(e.targetNodeId) ?? "";
      return {
        from: fromArg,
        to: toArg,
        type: collapseChainEdgeType(String(e.edgeType)),
        rawType: String(e.edgeType),
      };
    });

    return {
      id: c.id,
      name: c.name,
      topClaimId,
      topConclusionText,
      arguments: argIds,
      edges,
      chainStanding: worstStanding,
      chainFitness,
      weakestLink,
    };
  });

  // uncoveredClaims: top-level conclusion claims (no other arg uses them as
  // a premise) that no chain reaches.
  const allArgRows = await prisma.argument.findMany({
    where: { deliberationId },
    select: {
      conclusionClaimId: true,
      premises: { select: { claim: { select: { id: true } } } },
    },
  });
  const isPremise = new Set<string>();
  for (const a of allArgRows) {
    for (const p of a.premises) {
      if (p.claim?.id) isPremise.add(p.claim.id);
    }
  }
  const conclusionClaimIds = new Set<string>();
  for (const a of allArgRows) {
    if (a.conclusionClaimId && !isPremise.has(a.conclusionClaimId)) {
      conclusionClaimIds.add(a.conclusionClaimId);
    }
  }
  const claimsCoveredByChain = new Set(
    projections.map((p) => p.topClaimId).filter((x): x is string => !!x),
  );
  const uncoveredClaims = [...conclusionClaimIds].filter(
    (c) => !claimsCoveredByChain.has(c),
  );

  return {
    deliberationId,
    chains: projections,
    uncoveredClaims,
  };
}

// ────────────────────────────────────────────────────────────
// Internal: weakest-link selection (pure, unit-testable).
// ────────────────────────────────────────────────────────────

/**
 * The chain's standing is its worst member's standing — the minimum over the
 * `STANDING_RANK` order. This is **edge-shape-agnostic**: it ranges over the set
 * of member standings only, never the edge wiring, so a SERIAL spine, a
 * CONVERGENT fan-in, a TREE, and a general GRAPH (DAG) with the same member
 * arguments all yield the same chain standing (PART 4 §6). An empty member set
 * (no resolvable metrics) → `untested-default`.
 */
export function selectWorstStanding(
  standings: StandingState[],
): StandingState {
  let worst: StandingState | null = null;
  let worstRank = Number.POSITIVE_INFINITY;
  for (const s of standings) {
    const rank = STANDING_RANK[s];
    if (rank < worstRank) {
      worst = s;
      worstRank = rank;
    }
  }
  return worst ?? "untested-default";
}


export interface WeakestLinkInput {
  argumentId: string;
  /** Aggregate fitness for the link (lower = weaker). */
  fitnessTotal: number;
  /** CQs required by the link's primary scheme. */
  cqRequired: number;
  /** CQs answered (SATISFIED) for the link. */
  cqAnswered: number;
}

/**
 * Pick the weakest link in a chain.
 *
 * Primary key: lowest `fitnessTotal`. Tie-break: largest *fraction* of
 * unanswered CQs — `(cqRequired - cqAnswered) / max(cqRequired, 1)` — so a
 * 5-CQ scheme and a 3-CQ scheme at zero answered are equally exposed instead
 * of the richer-CQ scheme ranking weaker purely for catalogue size.
 *
 * Returns `null` when nothing differentiates the links: with more than one
 * link, identical fitness *and* identical CQ pressure across the spine means
 * there is no honest weakest link to name (the untested-default floor). A
 * single link is always its own weakest link.
 */
export function selectWeakestLink(
  links: WeakestLinkInput[],
): { argumentId: string; reason: string } | null {
  if (links.length === 0) return null;

  const cqFraction = (l: WeakestLinkInput) =>
    Math.max(0, l.cqRequired - l.cqAnswered) / Math.max(l.cqRequired, 1);

  let winner: WeakestLinkInput | null = null;
  let winnerFraction = Number.NEGATIVE_INFINITY;
  let minFitness = Number.POSITIVE_INFINITY;
  let maxFitness = Number.NEGATIVE_INFINITY;
  let minFraction = Number.POSITIVE_INFINITY;
  let maxFraction = Number.NEGATIVE_INFINITY;

  for (const l of links) {
    const frac = cqFraction(l);
    minFitness = Math.min(minFitness, l.fitnessTotal);
    maxFitness = Math.max(maxFitness, l.fitnessTotal);
    minFraction = Math.min(minFraction, frac);
    maxFraction = Math.max(maxFraction, frac);
    const better =
      winner === null ||
      l.fitnessTotal < winner.fitnessTotal ||
      (l.fitnessTotal === winner.fitnessTotal && frac > winnerFraction);
    if (better) {
      winner = l;
      winnerFraction = frac;
    }
  }

  // No differentiation across the spine → no honest weakest link.
  if (
    links.length > 1 &&
    minFitness === maxFitness &&
    minFraction === maxFraction
  ) {
    return null;
  }

  if (!winner) return null;
  const missingCqs = Math.max(0, winner.cqRequired - winner.cqAnswered);
  const reason =
    missingCqs > 0
      ? `lowest fitness (${winner.fitnessTotal}); ${missingCqs}/${winner.cqRequired} CQ(s) unanswered`
      : `lowest fitness (${winner.fitnessTotal})`;
  return { argumentId: winner.argumentId, reason };
}

// ────────────────────────────────────────────────────────────
// Internal: per-argument metrics in a batched query.
// ────────────────────────────────────────────────────────────

export interface ArgMetrics {
  fitness: FitnessBreakdown;
  standing: StandingState;
  cqAnswered: number;
  cqRequired: number;
  /**
   * How much deliberative pressure the standing verdict has actually
   * faced. "thin" = 0 or 1 distinct challenger/reviewer (cold-start);
   * "moderate" = ≥2 of either; "dense" = ≥5 of both. Disambiguates
   * "tested-undermined by 1 reviewer" from "tested-undermined by 10".
   * Mirrors `DeliberationFingerprint.depthDistribution` at the
   * per-argument level.
   */
  standingDepth: StandingConfidence;
  /** Distinct challenger authors (attack edges + CAs). Backs `standingDepth`. */
  challengerCount: number;
  /** Distinct independent-reviewer authors (support edges). Backs `standingDepth`. */
  reviewerCount: number;
}

export async function computeArgumentMetricsBatch(
  argIds: string[],
  deliberationId: string,
): Promise<Map<string, ArgMetrics>> {
  const out = new Map<string, ArgMetrics>();
  if (argIds.length === 0) return out;

  const args = await prisma.argument.findMany({
    where: { id: { in: argIds } },
    select: {
      id: true,
      conclusionClaimId: true,
      argumentSchemes: {
        select: {
          isPrimary: true,
          order: true,
          scheme: { select: { cqs: { select: { cqKey: true } } } },
        },
        orderBy: [{ isPrimary: "desc" }, { order: "asc" }],
      },
      conclusion: {
        select: {
          ClaimEvidence: {
            select: { contentSha256: true, archivedUrl: true },
          },
        },
      },
    },
  });

  const edges = await prisma.argumentEdge.findMany({
    where: { deliberationId, toArgumentId: { in: argIds } },
    select: {
      type: true,
      toArgumentId: true,
      from: { select: { authorId: true } },
    },
  });

  const conclusionIds = args
    .map((a) => a.conclusionClaimId)
    .filter((x): x is string => !!x);

  const cas = await prisma.conflictApplication.findMany({
    where: {
      deliberationId,
      OR: [
        { conflictedArgumentId: { in: argIds } },
        {
          conflictedClaimId: {
            in: conclusionIds.length ? conclusionIds : ["__none__"],
          },
        },
      ],
    },
    select: {
      conflictedArgumentId: true,
      conflictedClaimId: true,
      createdById: true,
    },
  });

  const cqStatuses = await prisma.cQStatus.findMany({
    where: {
      targetType: "argument",
      targetId: { in: argIds },
    },
    select: { targetId: true, statusEnum: true },
  });

  const claimToArg = new Map<string, string>();
  for (const a of args) {
    if (a.conclusionClaimId) claimToArg.set(a.conclusionClaimId, a.id);
  }

  for (const a of args) {
    const cqRequired =
      (a.argumentSchemes.find((s) => s.isPrimary) ?? a.argumentSchemes[0])?.scheme
        ?.cqs?.length ?? 0;
    const argCqs = cqStatuses.filter((s) => s.targetId === a.id);
    const cqAnswered = argCqs.filter((s) => s.statusEnum === "SATISFIED").length;

    const argEdges = edges.filter((e) => e.toArgumentId === a.id);
    const supportEdges = argEdges.filter((e) => e.type === "support").length;
    const attackEdges = argEdges.filter(
      (e) => e.type === "rebut" || e.type === "undercut",
    ).length;

    const matchingCas = cas.filter(
      (c) =>
        c.conflictedArgumentId === a.id ||
        (c.conflictedClaimId && claimToArg.get(c.conflictedClaimId) === a.id),
    );
    const argCas = matchingCas.length;

    // Distinct-author tallies for standingDepth (Pt. 3 §3 thresholds).
    // Authors are the originators of the attacking/supporting argument,
    // matching fingerprint's depthDistribution semantics.
    const challengerAuthors = new Set<string>();
    for (const e of argEdges) {
      if (e.type !== "rebut" && e.type !== "undercut") continue;
      const author = e.from?.authorId;
      if (author) challengerAuthors.add(author);
    }
    for (const c of matchingCas) {
      if (c.createdById) challengerAuthors.add(c.createdById);
    }
    const reviewerAuthors = new Set<string>();
    for (const e of argEdges) {
      if (e.type !== "support") continue;
      const author = e.from?.authorId;
      if (author) reviewerAuthors.add(author);
    }
    const standingDepth = classifyStandingConfidence({
      challengers: challengerAuthors.size,
      independentReviewers: reviewerAuthors.size,
    });

    const evidenceWithProvenance =
      a.conclusion?.ClaimEvidence?.filter(
        (e) => !!(e.contentSha256 || e.archivedUrl),
      ).length ?? 0;

    const fitness = computeFitnessBreakdown({
      cqAnswered,
      supportEdges,
      attackEdges,
      attackCAs: argCas,
      evidenceWithProvenance,
    });

    const isTested =
      cqAnswered >= 2 || (argCas + attackEdges >= 1 && supportEdges >= 1);
    const standing = computeStandingState({
      isTested,
      criticalQuestionsAnswered: cqAnswered,
      incomingAttacks: argCas,
      incomingAttackEdges: attackEdges,
      incomingSupports: supportEdges,
    });

    out.set(a.id, {
      fitness,
      standing,
      cqAnswered,
      cqRequired,
      standingDepth,
      challengerCount: challengerAuthors.size,
      reviewerCount: reviewerAuthors.size,
    });
  }

  return out;
}
