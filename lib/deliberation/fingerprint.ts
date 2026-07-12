/**
 * DeliberationFingerprint — Track AI-EPI Pt. 4 §1.
 *
 * A deterministic, deliberation-scope summary of the argument graph. Acts
 * as the honesty floor for every downstream readout: a thin deliberation
 * can finally *say* it is thin without the consumer having to derive it
 * from per-argument labels.
 *
 * Pure function over the graph. The `contentHash` is a sha256 over the
 * sorted (argumentIds, edgeIds, schemes) tuple — every dependent
 * computation should cache on this hash. (The cache table is an
 * optimization not yet shipped; on-demand compute is correct, just
 * slower.)
 */

import crypto from "crypto";
import { prisma } from "@/lib/prismaclient";
import {
  classifyStandingConfidence,
  type StandingConfidence,
} from "@/config/standingThresholds";
import {
  computeFitnessBreakdown,
  computeStandingState,
  type StandingState,
  type AuthorKind,
} from "@/lib/citations/argumentAttestation";
import {
  resolveDeliberationName,
  defaultHostName,
} from "@/lib/deliberations/resolveName";

// ============================================================
// TYPES
// ============================================================

export interface DeliberationFingerprint {
  deliberationId: string;
  /**
   * Human-citable name for the deliberation, resolved via the canonical
   * precedence (human title → host-derived name → auto-title → fallback).
   * Always non-empty so agents can cite by name, not just id. Not mixed
   * into `contentHash` — it is presentation metadata, not graph content.
   */
  displayName: string;
  /** sha256 over sorted (argumentIds, edgeIds, schemes). The cache key. */
  contentHash: string;
  argumentCount: number;
  claimCount: number;
  edgeCount: {
    /** ArgumentEdge rows of type SUPPORT */
    support: number;
    /** ArgumentEdge rows of type REBUT/UNDERCUT (excluding SUPPORT/CONCEDE) */
    attack: number;
    /** ConflictApplication rows targeting an argument or its conclusion */
    ca: number;
  };
  /** Distribution of primary scheme keys across arguments. Unschemed arguments key as `"<unschemed>"`. */
  schemeDistribution: Record<string, number>;
  /** Argument-author counts by AuthorKind. */
  authorCount: { human: number; ai: number; hybrid: number };
  /** Distinct authorIds across arguments + edges + conflictApplications + CQ responses. */
  participantCount: number;
  /** Distribution of standing-state labels across arguments. */
  standingDistribution: Record<StandingState, number>;
  /** Distribution of standing-depth confidence tiers across arguments. */
  depthDistribution: Record<StandingConfidence, number>;
  /** Median number of distinct challengers per argument. */
  medianChallengerCount: number;
  /**
   * Mean number of distinct challengers per argument. Reported alongside
   * the median because in long-tailed graphs (many leaf-position arguments
   * with zero inbound traffic, a few load-bearing nodes with several
   * challengers) the median collapses to 0 and hides real challenge
   * density. The mean answers "on average, how many distinct authors
   * have pushed back on each argument?" and is the more informative
   * statistic for orchestrator-seeded graphs. Rounded to three decimals.
   */
  meanChallengerCount: number;
  /**
   * Fraction of arguments that have at least one distinct challenger
   * (inbound attack edge author OR ConflictApplication creator). The
   * complement of "% of arguments still sitting at the leaves with
   * nobody pushing back". Rounded to three decimals; 0 when there are
   * no arguments. This is the headline coverage metric — `medianChallengerCount`
   * collapses to 0 in tree-shaped graphs as soon as leaf count exceeds
   * 50%, but `challengerCoverage` degrades smoothly.
   */
  challengerCoverage: number;
  /**
   * Median number of distinct challengers, computed only over the
   * subset of arguments that have at least one challenger (i.e.
   * conditioned on being in the dialectical fray at all). Answers
   * "when an argument is being challenged, how many distinct authors
   * typically push back?". 0 when no arguments have challengers.
   * Read together with `challengerCoverage` (breadth) — this is depth.
   */
  medianChallengerCountAmongChallenged: number;
  cqCoverage: {
    answered: number;
    partial: number;
    unanswered: number;
    /** Total catalog CQs across arguments-with-schemes. */
    total: number;
  };
  evidenceCoverage: {
    withProvenance: number;
    withoutProvenance: number;
  };
  /** Number of ArgumentChain rows in the deliberation. */
  chainCount: number;
  extraction: {
    /** Count of arguments with authorKind in (AI, HYBRID). */
    aiSeededCount: number;
    /** Ratio of AI/HYBRID arguments to total. 0 when no arguments. */
    aiSeededRatio: number;
    /**
     * Rolling 30-day rate of human dialectical engagement on AI-seeded
     * arguments (attacks, supports, CQ answers / count of AI seeds).
     * `null` until the AiDraftEngagement table ships (Pt. 4 item 8).
     */
    humanEngagementRateOnAiSeeds: number | null;
    /**
     * True when the deliberation is structurally AI-articulated rather than
     * humanly deliberated. Set when aiSeededRatio > 0.5 AND
     * humanEngagementRateOnAiSeeds is below threshold (or null) — the UI
     * surfaces this as a "not yet deliberation" chip on the StateCard.
     */
    articulationOnly: boolean;
  };
  /** ISO timestamp this fingerprint was materialized. */
  computedAt: string;
}

// ============================================================
// HELPERS
// ============================================================

function sha256(s: string): string {
  return "sha256:" + crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/** Threshold for `articulationOnly`: < 0.1 human engagements per AI seed in the rolling window. */
const ARTICULATION_ONLY_ENGAGEMENT_FLOOR = 0.1;

/**
 * Code-version stamp mixed into `contentHash`. Bump this string whenever
 * the *shape* of `DeliberationFingerprint` or `SyntheticReadout` changes
 * (new fields, renamed fields, changed semantics for an existing field).
 * The shape change invalidates every cached payload in
 * `DeliberationFingerprintCache` automatically because the new hash will
 * not collide with any existing row's `contentHash`. Pure projection
 * changes that only depend on the graph (args/edges/cas/schemes) do
 * NOT require a bump — the underlying ids already drive cache key
 * variance.
 *
 * Bump log:
 *   v1 — original schema (pre-meanChallengerCount)
 *   v2 — added meanChallengerCount, challengerCoverage,
 *        medianChallengerCountAmongChallenged (2026-05-11)
 *   v3 — added standingDepth + challengerCount/reviewerCount per
 *        topArguments / mostContested entry in syntheticReadout (2026-05-11)
 *   v4 — added refusalSurface[i].blockerSummaries; chainFitness now
 *        weights inbound attacks by attacker standing (2026-05-11)
 *   v5 — M5 sprint exit: export `attackerCredibility` for direct test
 *        coverage; no shape change, bump to evict stale cached
 *        chainFitness payloads computed before the weighted-attack
 *        rollout reached production (2026-05-24).
 */
const FINGERPRINT_VERSION = "v5";

// ============================================================
// MAIN BUILDER
// ============================================================

export async function computeDeliberationFingerprint(
  deliberationId: string,
): Promise<DeliberationFingerprint | null> {
  const deliberation = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: {
      id: true,
      title: true,
      titleAutoGenerated: true,
      hostType: true,
      hostId: true,
    },
  });
  if (!deliberation) return null;

  const displayName = resolveDeliberationName(deliberation, {
    hostName: defaultHostName(deliberation.hostType, deliberation.hostId),
  });

  // Pull arguments with the minimum needed for standing/depth/fitness/scheme.
  const argRows = await prisma.argument.findMany({
    where: { deliberationId },
    select: {
      id: true,
      authorId: true,
      authorKind: true,
      conclusionClaimId: true,
      argumentSchemes: {
        select: {
          isPrimary: true,
          order: true,
          scheme: { select: { key: true, cqs: { select: { cqKey: true } } } },
        },
        orderBy: [{ isPrimary: "desc" }, { order: "asc" }],
      },
    },
  });

  // Argument-edges scoped to this deliberation.
  const edgeRows = await prisma.argumentEdge.findMany({
    where: { deliberationId },
    select: {
      id: true,
      type: true,
      fromArgumentId: true,
      toArgumentId: true,
      createdById: true,
    },
  });

  // Conflict applications targeting these arguments or their conclusions.
  const argIds = argRows.map((a) => a.id);
  const conclusionIds = argRows
    .map((a) => a.conclusionClaimId)
    .filter((x): x is string => !!x);

  const cas = await prisma.conflictApplication.findMany({
    where: {
      deliberationId,
      OR: [
        { conflictedArgumentId: { in: argIds.length ? argIds : ["__none__"] } },
        {
          conflictedClaimId: {
            in: conclusionIds.length ? conclusionIds : ["__none__"],
          },
        },
      ],
    },
    select: {
      id: true,
      createdById: true,
      conflictedArgumentId: true,
      conflictedClaimId: true,
      conflictingArgumentId: true,
    },
  });

  // CQ statuses for arguments in this deliberation.
  const cqStatuses = await prisma.cQStatus.findMany({
    where: {
      targetType: "argument",
      targetId: { in: argIds.length ? argIds : ["__none__"] },
    },
    select: {
      argumentId: true,
      targetId: true,
      schemeKey: true,
      cqKey: true,
      statusEnum: true,
      createdById: true,
    },
  });

  // Claims in this deliberation (for claimCount + evidence coverage).
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: {
      id: true,
      ClaimEvidence: {
        select: { contentSha256: true, archivedUrl: true },
      },
    },
  });

  // ArgumentChain count.
  const chainCount = await prisma.argumentChain.count({
    where: { deliberationId },
  });

  // ────────────────────────────────────────────────────────────
  // contentHash: deterministic over sorted ids + scheme keys
  // ────────────────────────────────────────────────────────────

  const sortedArgIds = [...argRows.map((a) => a.id)].sort();
  const sortedEdgeIds = [...edgeRows.map((e) => e.id)].sort();
  const sortedCaIds = [...cas.map((c) => c.id)].sort();
  const sortedSchemes = [
    ...new Set(
      argRows.flatMap((a) =>
        a.argumentSchemes
          .map((s) => s.scheme?.key)
          .filter((x): x is string => !!x),
      ),
    ),
  ].sort();

  const hashInput = JSON.stringify({
    v: FINGERPRINT_VERSION,
    deliberationId,
    args: sortedArgIds,
    edges: sortedEdgeIds,
    cas: sortedCaIds,
    schemes: sortedSchemes,
  });
  const contentHash = sha256(hashInput);

  // ────────────────────────────────────────────────────────────
  // Edge counts
  // ────────────────────────────────────────────────────────────

  let supportEdges = 0;
  let attackEdges = 0;
  for (const e of edgeRows) {
    if (e.type === "support") supportEdges++;
    else if (e.type === "rebut" || e.type === "undercut") attackEdges++;
    // 'concede' and 'CA' are not counted as attacks (CA is materialized via ConflictApplication).
  }

  // ────────────────────────────────────────────────────────────
  // Per-argument inbound traffic + author tallies
  // ────────────────────────────────────────────────────────────

  const inboundSupportByArg = new Map<string, number>();
  const inboundAttackEdgesByArg = new Map<string, number>();
  const inboundAttackCAsByArg = new Map<string, number>();
  const challengerAuthorsByArg = new Map<string, Set<string>>();
  const reviewerAuthorsByArg = new Map<string, Set<string>>();

  const argById = new Map(argRows.map((a) => [a.id, a] as const));
  const claimToConcludingArgs = new Map<string, string[]>();
  for (const a of argRows) {
    if (a.conclusionClaimId) {
      const list = claimToConcludingArgs.get(a.conclusionClaimId) ?? [];
      list.push(a.id);
      claimToConcludingArgs.set(a.conclusionClaimId, list);
    }
  }

  for (const e of edgeRows) {
    if (e.type === "support") {
      inboundSupportByArg.set(
        e.toArgumentId,
        (inboundSupportByArg.get(e.toArgumentId) ?? 0) + 1,
      );
      const fromAuthor = argById.get(e.fromArgumentId)?.authorId;
      if (fromAuthor) {
        const set = reviewerAuthorsByArg.get(e.toArgumentId) ?? new Set();
        set.add(fromAuthor);
        reviewerAuthorsByArg.set(e.toArgumentId, set);
      }
    } else if (e.type === "rebut" || e.type === "undercut") {
      inboundAttackEdgesByArg.set(
        e.toArgumentId,
        (inboundAttackEdgesByArg.get(e.toArgumentId) ?? 0) + 1,
      );
      const fromAuthor = argById.get(e.fromArgumentId)?.authorId;
      if (fromAuthor) {
        const set = challengerAuthorsByArg.get(e.toArgumentId) ?? new Set();
        set.add(fromAuthor);
        challengerAuthorsByArg.set(e.toArgumentId, set);
      }
    }
  }

  for (const ca of cas) {
    const targetArgIds: string[] = [];
    if (ca.conflictedArgumentId) targetArgIds.push(ca.conflictedArgumentId);
    if (ca.conflictedClaimId) {
      const concluding = claimToConcludingArgs.get(ca.conflictedClaimId) ?? [];
      targetArgIds.push(...concluding);
    }
    for (const targetId of targetArgIds) {
      inboundAttackCAsByArg.set(
        targetId,
        (inboundAttackCAsByArg.get(targetId) ?? 0) + 1,
      );
      if (ca.createdById) {
        const set = challengerAuthorsByArg.get(targetId) ?? new Set();
        set.add(ca.createdById);
        challengerAuthorsByArg.set(targetId, set);
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // Per-argument CQ aggregates
  // ────────────────────────────────────────────────────────────

  const cqByArg = new Map<
    string,
    { answered: number; partial: number; unanswered: number; total: number }
  >();

  for (const a of argRows) {
    const primary =
      a.argumentSchemes.find((s) => s.isPrimary) ??
      a.argumentSchemes[0] ??
      null;
    const total = primary?.scheme?.cqs?.length ?? 0;

    const statuses = cqStatuses.filter((s) => s.targetId === a.id);
    let answered = 0;
    let partial = 0;
    for (const s of statuses) {
      if (s.statusEnum === "SATISFIED") answered++;
      else if (s.statusEnum === "PARTIALLY_SATISFIED") partial++;
    }
    const unanswered = Math.max(0, total - answered - partial);
    cqByArg.set(a.id, { answered, partial, unanswered, total });
  }

  // ────────────────────────────────────────────────────────────
  // Per-argument standing + depth
  // ────────────────────────────────────────────────────────────

  const standingDistribution: Record<StandingState, number> = {
    "untested-default": 0,
    "untested-supported": 0,
    "tested-attacked": 0,
    "tested-undermined": 0,
    "tested-survived": 0,
  };
  const depthDistribution: Record<StandingConfidence, number> = {
    thin: 0,
    moderate: 0,
    dense: 0,
  };
  const challengerCounts: number[] = [];

  for (const a of argRows) {
    const cq = cqByArg.get(a.id) ?? { answered: 0, total: 0, partial: 0, unanswered: 0 };
    const incomingAttackEdges = inboundAttackEdgesByArg.get(a.id) ?? 0;
    const incomingAttacks = inboundAttackCAsByArg.get(a.id) ?? 0;
    const incomingSupports = inboundSupportByArg.get(a.id) ?? 0;

    const isTested =
      cq.answered >= 2 || (incomingAttacks >= 1 && incomingSupports >= 1);

    const state = computeStandingState({
      isTested,
      criticalQuestionsAnswered: cq.answered,
      incomingAttacks,
      incomingAttackEdges,
      incomingSupports,
    });
    standingDistribution[state] = (standingDistribution[state] ?? 0) + 1;

    const challengers = challengerAuthorsByArg.get(a.id)?.size ?? 0;
    const reviewers = reviewerAuthorsByArg.get(a.id)?.size ?? 0;
    challengerCounts.push(challengers);
    const conf = classifyStandingConfidence({
      challengers,
      independentReviewers: reviewers,
    });
    depthDistribution[conf] = (depthDistribution[conf] ?? 0) + 1;
  }

  // ────────────────────────────────────────────────────────────
  // Scheme distribution
  // ────────────────────────────────────────────────────────────

  const schemeDistribution: Record<string, number> = {};
  for (const a of argRows) {
    const primary = a.argumentSchemes.find((s) => s.isPrimary) ?? a.argumentSchemes[0];
    const key = primary?.scheme?.key ?? "<unschemed>";
    schemeDistribution[key] = (schemeDistribution[key] ?? 0) + 1;
  }

  // ────────────────────────────────────────────────────────────
  // Author counts + participant set
  // ────────────────────────────────────────────────────────────

  const authorCount = { human: 0, ai: 0, hybrid: 0 };
  const participants = new Set<string>();
  for (const a of argRows) {
    if (a.authorKind === "AI") authorCount.ai++;
    else if (a.authorKind === "HYBRID") authorCount.hybrid++;
    else authorCount.human++;
    if (a.authorId) participants.add(a.authorId);
  }
  for (const e of edgeRows) {
    if (e.createdById) participants.add(e.createdById);
  }
  for (const c of cas) {
    if (c.createdById) participants.add(c.createdById);
  }
  for (const s of cqStatuses) {
    if (s.createdById) participants.add(s.createdById);
  }

  // Author identity-kind lookup (User.kind ∈ {human, bot, service}). Used to
  // count arguments authored by automated/bot accounts toward the AI bucket
  // for `aiSeededRatio` telemetry, even when the per-argument `authorKind`
  // column was written as HUMAN. See B1 of the multi-agent deliberation
  // experiment prereq plan.
  const authorIds = Array.from(participants);
  const userKindRows = authorIds.length
    ? await prisma.user.findMany({
        where: { auth_id: { in: authorIds } },
        select: { auth_id: true, kind: true },
      })
    : [];
  const kindByAuthId = new Map(userKindRows.map((u) => [u.auth_id, u.kind]));

  // ────────────────────────────────────────────────────────────
  // CQ + evidence coverage rollups
  // ────────────────────────────────────────────────────────────

  const cqCoverage = { answered: 0, partial: 0, unanswered: 0, total: 0 };
  for (const v of cqByArg.values()) {
    cqCoverage.answered += v.answered;
    cqCoverage.partial += v.partial;
    cqCoverage.unanswered += v.unanswered;
    cqCoverage.total += v.total;
  }

  const evidenceCoverage = { withProvenance: 0, withoutProvenance: 0 };
  for (const c of claims) {
    for (const e of c.ClaimEvidence) {
      if (e.contentSha256 || e.archivedUrl) evidenceCoverage.withProvenance++;
      else evidenceCoverage.withoutProvenance++;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Extraction (AI seeding) telemetry
  // ────────────────────────────────────────────────────────────

  // An argument is treated as AI-seeded if either (a) its per-argument
  // `authorKind` is AI/HYBRID, or (b) the author user is a non-human identity
  // (User.kind ∈ {bot, service}) — e.g. provisioned via the multi-agent
  // deliberation experiment.
  const isAiSeeded = (a: (typeof argRows)[number]) => {
    if (a.authorKind === "AI" || a.authorKind === "HYBRID") return true;
    if (a.authorId) {
      const k = kindByAuthId.get(a.authorId);
      if (k === "bot" || k === "service") return true;
    }
    return false;
  };

  const aiSeedArgs = argRows.filter(isAiSeeded);
  const aiSeededCount = aiSeedArgs.length;
  const aiSeededRatio =
    argRows.length > 0 ? aiSeededCount / argRows.length : 0;

  // humanEngagementRateOnAiSeeds — Pt. 4 §8 telemetry. Rolling 30-day
  // count of human dialectical actions against AI/HYBRID arguments,
  // divided by the count of AI/HYBRID arguments. `null` when there are
  // no AI seeds (the ratio is undefined, and the consumer must
  // distinguish "no signal" from "zero engagement").
  const aiSeedIds = aiSeedArgs.map((a) => a.id);

  let humanEngagementRateOnAiSeeds: number | null = null;
  if (aiSeedIds.length > 0) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const engagementCount = await prisma.aiDraftEngagement.count({
      where: {
        argumentId: { in: aiSeedIds },
        occurredAt: { gte: cutoff },
      },
    });
    humanEngagementRateOnAiSeeds =
      Math.round((engagementCount / aiSeedIds.length) * 1000) / 1000;
  }

  const articulationOnly =
    aiSeededRatio > 0.5 &&
    (humanEngagementRateOnAiSeeds === null ||
      humanEngagementRateOnAiSeeds < ARTICULATION_ONLY_ENGAGEMENT_FLOOR);

  return {
    deliberationId,
    displayName,
    contentHash,
    argumentCount: argRows.length,
    claimCount: claims.length,
    edgeCount: { support: supportEdges, attack: attackEdges, ca: cas.length },
    schemeDistribution,
    authorCount,
    participantCount: participants.size,
    standingDistribution,
    depthDistribution,
    medianChallengerCount: median(challengerCounts),
    meanChallengerCount:
      challengerCounts.length === 0
        ? 0
        : Math.round(
            (challengerCounts.reduce((s, n) => s + n, 0) /
              challengerCounts.length) *
              1000,
          ) / 1000,
    challengerCoverage:
      challengerCounts.length === 0
        ? 0
        : Math.round(
            (challengerCounts.filter((n) => n > 0).length /
              challengerCounts.length) *
              1000,
          ) / 1000,
    medianChallengerCountAmongChallenged: median(
      challengerCounts.filter((n) => n > 0),
    ),
    cqCoverage,
    evidenceCoverage,
    chainCount,
    extraction: {
      aiSeededCount,
      aiSeededRatio: Math.round(aiSeededRatio * 1000) / 1000,
      humanEngagementRateOnAiSeeds,
      articulationOnly,
    },
    computedAt: new Date().toISOString(),
  };
}

/**
 * Compute just the contentHash for a deliberation. Cheap. Used by callers
 * that need to invalidate caches without materializing the full payload.
 */
export async function computeDeliberationContentHash(
  deliberationId: string,
): Promise<string | null> {
  const fp = await computeDeliberationFingerprint(deliberationId);
  return fp?.contentHash ?? null;
}

// Re-export for downstream consumers.
export { computeFitnessBreakdown };
export type { StandingState, StandingConfidence, AuthorKind };
