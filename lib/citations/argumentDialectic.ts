/**
 * Argument Dialectical Layer
 *
 * Builds the *dialectical* view-model for the public argument page
 * (`app/a/[identifier]/page.tsx`) — the filed attacks (ConflictApplications)
 * and their linked responses (GROUNDS / CONCEDE DialogueMoves) that live on
 * the deliberation graph. See `docs/ARGUMENT_DIALECTICAL_LAYER_DEV_SPEC.md`.
 *
 * The constructive layer (conclusion → premises → evidence → CQs) is built by
 * `argumentAttestation.ts`. This module is its dialectical counterpart. It does
 * NOT recompute standing/depth — those are read from the attestation's
 * `dialecticalStatus` and passed in — it only assembles the threaded record.
 */

import { prisma } from "@/lib/prismaclient";
import type {
  AuthorKind,
  DialecticalStatus,
  FitnessBreakdown,
} from "@/lib/citations/argumentAttestation";

// ============================================================
// TYPES
// ============================================================

export type AttackType = "REBUT" | "UNDERCUT" | "UNDERMINE";

export type RatificationStatus = "PROPOSED" | "EFFECTIVE" | "WITHDRAWN";

export type ResponseVariant = "defense" | "concession" | "partial-concession";

/** Standing states surfaced by the attestation's `computeStandingState`. */
export type StandingState =
  | "untested-default"
  | "untested-supported"
  | "tested-attacked"
  | "tested-undermined"
  | "tested-undercut"
  | "tested-survived";

export interface EvidenceVM {
  id: string;
  title: string | null;
  uri: string;
  citation: string | null;
  /** true when the source body has been archived (Wayback snapshot present). */
  archived: boolean;
}

export interface ResponseVM {
  /** `DialogueMove.id` (GROUNDS / CONCEDE). */
  id: string;
  variant: ResponseVariant;
  /** A defense awaiting adjudication reads PENDING_REVIEW; concessions are EFFECTIVE. */
  status: "EFFECTIVE" | "PENDING_REVIEW";
  authorKind: AuthorKind;
  groundsText: string;
  evidence: EvidenceVM[];
  createdAt: string;
}

export interface ChallengeThreadVM {
  /** `ConflictApplication.id`. */
  id: string;
  attackType: AttackType;
  target: {
    kind: "conclusion" | "inference" | "premise";
    premiseIndex?: number;
    label: string;
  };
  ratificationStatus: RatificationStatus;
  authorKind: AuthorKind;
  createdAt: string;
  groundsText: string;
  evidence: EvidenceVM[];
  /** Set for UNDERCUTs (and CQ-typed attacks) mapped to a scheme CQ key. */
  instantiatesCqKey?: string;
  responses: ResponseVM[];
}

export interface DialecticalLayer {
  standing: {
    state: StandingState;
    depthConfidence: "thin" | "moderate" | "dense";
    /** DISTINCT challenging authors — not attack count. */
    challengers: number;
    independentReviewers: number;
    fitnessBreakdown?: FitnessBreakdown;
  };
  counts: {
    challenges: number;
    responses: number;
    cqAnsweredPending: number;
  };
  threads: ChallengeThreadVM[];
}

// ============================================================
// HELPERS
// ============================================================

const ATTACK_TYPE_FROM_LEGACY: Record<string, AttackType> = {
  REBUTS: "REBUT",
  UNDERCUTS: "UNDERCUT",
  UNDERMINES: "UNDERMINE",
};

/**
 * Infer author kind without a join: MCP-bot sides are namespaced
 * `mcp-bot:<speakAs>` at write time (see `/api/ca` auth shim), so a leading
 * `mcp-bot` prefix marks an AI author. Everyone else is treated as HUMAN.
 * A richer signal (e.g. `Argument.authorKind`) overrides this when available.
 */
function inferAuthorKind(id: string | null | undefined): AuthorKind {
  if (id && id.startsWith("mcp-bot")) return "AI";
  return "HUMAN";
}

function normalizeRatification(raw: string | null | undefined): RatificationStatus {
  if (raw === "PROPOSED" || raw === "WITHDRAWN") return raw;
  return "EFFECTIVE";
}

/** The cqId an ATTACK move carries — real CQ key or the `aif_attack_<caId>` fallback. */
function attackCqId(
  caId: string,
  movePayload: unknown,
  metaJson: unknown,
): string {
  const fromMove = (movePayload as Record<string, unknown> | null)?.cqId;
  if (typeof fromMove === "string" && fromMove) return fromMove;
  const fromMeta = (metaJson as Record<string, unknown> | null)?.cqId;
  if (typeof fromMeta === "string" && fromMeta) return fromMeta;
  return `aif_attack_${caId}`;
}

/**
 * Derive the `instantiatesCqKey` for a thread. A real scheme CQ key lives on
 * `metaJson.cqKey`, or on the ATTACK-move payload as `cqKey`/`schemeKey`-scoped
 * `cqId`. We only surface a key that is NOT the synthetic `aif_attack_*`
 * fallback (that fallback is an internal handle, not a scheme CQ).
 */
function deriveInstantiatesCqKey(
  metaJson: unknown,
  movePayload: unknown,
): string | undefined {
  const meta = metaJson as Record<string, unknown> | null;
  if (typeof meta?.cqKey === "string" && meta.cqKey) return meta.cqKey;
  const payload = movePayload as Record<string, unknown> | null;
  if (typeof payload?.cqKey === "string" && payload.cqKey) return payload.cqKey;
  const cqId = payload?.cqId;
  if (typeof cqId === "string" && cqId && !cqId.startsWith("aif_attack_")) {
    return cqId;
  }
  return undefined;
}

function sourceUrlsToEvidence(raw: unknown, idPrefix: string): EvidenceVM[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .map((uri, i) => ({
      id: `${idPrefix}:src:${i}`,
      title: null,
      uri,
      citation: null,
      archived: false,
    }));
}

function claimEvidenceToVM(
  rows: Array<{
    id: string;
    uri: string;
    title: string | null;
    citation: string | null;
    archivedUrl: string | null;
  }>,
): EvidenceVM[] {
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    uri: e.uri,
    citation: e.citation,
    archived: !!e.archivedUrl,
  }));
}

// ============================================================
// BUILDER
// ============================================================

export interface BuildDialecticalLayerInput {
  argumentId: string;
  deliberationId: string;
  conclusionClaimId: string | null;
  /** Premise claims in declared order, with a short display label. */
  premises: Array<{ claimId: string; index: number; label: string }>;
  /** Standing / depth / counts read straight from the attestation envelope. */
  dialecticalStatus: DialecticalStatus;
}

/**
 * Assemble the dialectical layer for one argument. One CA query + one response
 * query; standing/depth are passed in (never recomputed here).
 */
export async function buildDialecticalLayer(
  input: BuildDialecticalLayerInput,
): Promise<DialecticalLayer> {
  const { argumentId, deliberationId, conclusionClaimId, premises } = input;
  const ds = input.dialecticalStatus;

  const premiseIdToMeta = new Map(
    premises.map((p) => [p.claimId, p] as const),
  );
  const targetClaimIds = [
    ...(conclusionClaimId ? [conclusionClaimId] : []),
    ...premises.map((p) => p.claimId),
  ];

  // ---- Filed attacks targeting this argument, its conclusion, or a premise ----
  const caRows = await prisma.conflictApplication.findMany({
    where: {
      OR: [
        { conflictedArgumentId: argumentId },
        targetClaimIds.length
          ? { conflictedClaimId: { in: targetClaimIds } }
          : undefined,
      ].filter(Boolean) as any[],
    },
    select: {
      id: true,
      createdById: true,
      createdAt: true,
      legacyAttackType: true,
      legacyTargetScope: true,
      ratificationStatus: true,
      conflictedClaimId: true,
      conflictedArgumentId: true,
      metaJson: true,
      createdByMove: { select: { payload: true } },
      conflictingClaim: {
        select: {
          text: true,
          ClaimEvidence: {
            select: {
              id: true,
              uri: true,
              title: true,
              citation: true,
              archivedUrl: true,
            },
            take: 5,
          },
        },
      },
      conflictingArgument: {
        select: {
          text: true,
          authorKind: true,
          conclusion: { select: { text: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  // Map each CA to the cqId its WHY/ATTACK move discharges, so responses can
  // be threaded back onto it.
  const cqIdToThreadId = new Map<string, string>();
  const threads: ChallengeThreadVM[] = caRows.map((ca) => {
    const attackType =
      ATTACK_TYPE_FROM_LEGACY[ca.legacyAttackType ?? ""] ?? "UNDERMINE";

    // Target anchoring.
    let target: ChallengeThreadVM["target"];
    if (attackType === "REBUT") {
      target = { kind: "conclusion", label: "the Conclusion" };
    } else if (attackType === "UNDERCUT") {
      target = { kind: "inference", label: "the Inference" };
    } else {
      const premiseMeta = ca.conflictedClaimId
        ? premiseIdToMeta.get(ca.conflictedClaimId)
        : undefined;
      target = premiseMeta
        ? {
            kind: "premise",
            premiseIndex: premiseMeta.index,
            label: `Premise ${premiseMeta.index + 1}`,
          }
        : { kind: "premise", label: "a Premise" };
    }

    // Grounds text: the objection claim / attacking argument text, then the
    // attacking argument's conclusion, then a scheme-derived label.
    const groundsText =
      ca.conflictingClaim?.text ||
      ca.conflictingArgument?.text ||
      ca.conflictingArgument?.conclusion?.text ||
      "Challenge filed on the graph.";

    // Evidence: the objection claim's provenance-bearing evidence, plus any
    // bare source URLs carried on the CA metaJson.
    const evidence = [
      ...claimEvidenceToVM(ca.conflictingClaim?.ClaimEvidence ?? []),
      ...sourceUrlsToEvidence(
        (ca.metaJson as Record<string, unknown> | null)?.sourceUrls,
        ca.id,
      ),
    ];

    const authorKind =
      ca.conflictingArgument?.authorKind ?? inferAuthorKind(ca.createdById);

    const cqId = attackCqId(ca.id, ca.createdByMove?.payload, ca.metaJson);
    if (!cqIdToThreadId.has(cqId)) cqIdToThreadId.set(cqId, ca.id);

    return {
      id: ca.id,
      attackType,
      target,
      ratificationStatus: normalizeRatification(ca.ratificationStatus),
      authorKind,
      createdAt: ca.createdAt.toISOString(),
      groundsText,
      evidence,
      instantiatesCqKey: deriveInstantiatesCqKey(
        ca.metaJson,
        ca.createdByMove?.payload,
      ),
      responses: [],
    };
  });

  const threadById = new Map(threads.map((t) => [t.id, t] as const));

  // ---- Responses: GROUNDS (defense) / CONCEDE moves threaded by cqId ----
  if (threads.length > 0) {
    const responseTargetIds = [argumentId, ...targetClaimIds];
    const moves = await prisma.dialogueMove.findMany({
      where: {
        deliberationId,
        kind: { in: ["GROUNDS", "CONCEDE"] },
        targetId: { in: responseTargetIds },
      },
      select: {
        id: true,
        kind: true,
        actorId: true,
        authorId: true,
        completed: true,
        createdAt: true,
        payload: true,
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    for (const move of moves) {
      const payload = (move.payload as Record<string, unknown> | null) ?? null;
      const moveCqId = payload?.cqId;
      if (typeof moveCqId !== "string") continue;
      const threadId = cqIdToThreadId.get(moveCqId);
      if (!threadId) continue;
      const thread = threadById.get(threadId);
      if (!thread) continue;

      const groundsText =
        (typeof payload?.expression === "string" && payload.expression) ||
        (typeof payload?.brief === "string" && payload.brief) ||
        (typeof payload?.note === "string" && payload.note) ||
        "";
      if (!groundsText) continue;

      const isConcede = move.kind === "CONCEDE";
      const isPartial = payload?.concession === "partial" || payload?.partial === true;
      const variant: ResponseVariant = isConcede
        ? "concession"
        : isPartial
          ? "partial-concession"
          : "defense";

      thread.responses.push({
        id: move.id,
        variant,
        // Concessions are settled acts; a defense (GROUNDS) is pending until
        // adjudicated (the move's `completed` flag).
        status: isConcede || move.completed ? "EFFECTIVE" : "PENDING_REVIEW",
        authorKind: inferAuthorKind(move.actorId ?? move.authorId),
        groundsText,
        evidence: sourceUrlsToEvidence(payload?.sourceUrls, move.id),
        createdAt: move.createdAt.toISOString(),
      });
    }
  }

  const responseCount = threads.reduce((n, t) => n + t.responses.length, 0);

  // Map the attestation 5-bucket state onto the 6-value display union. When the
  // dominant attack is an UNDERCUT we surface the more specific label.
  let state: StandingState = ds.standingState;
  if (
    ds.standingState === "tested-undermined" &&
    threads.some((t) => t.attackType === "UNDERCUT") &&
    !threads.some((t) => t.attackType === "UNDERMINE" || t.attackType === "REBUT")
  ) {
    state = "tested-undercut";
  }

  return {
    standing: {
      state,
      depthConfidence: ds.standingDepth.confidence,
      challengers: ds.standingDepth.challengers,
      independentReviewers: ds.standingDepth.independentReviewers,
      fitnessBreakdown: ds.fitnessBreakdown,
    },
    counts: {
      challenges: threads.length,
      responses: responseCount,
      cqAnsweredPending: ds.criticalQuestionsAnswered,
    },
    threads,
  };
}
