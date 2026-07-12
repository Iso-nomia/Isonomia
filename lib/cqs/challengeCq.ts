// lib/cqs/challengeCq.ts
//
// Core logic for POST /api/cqs/challenge (Dev Spec §11.2). One transactional
// path that lets a user (or AI agent over MCP) contest an *answered* critical
// question. A challenge materialises as:
//   · a scheme-free `Claim` (the objection text) — carries NO scheme, hence NO
//     CQs of its own, which keeps the regress finite (ideation §4.2);
//   · a typed `ClaimEdge` attack (REBUT / UNDERMINE / UNDERCUT) from the
//     challenge-claim → the answer-claim;
//   · a `CQAttack` provenance row linking the edge to the contested CQStatus;
//   · the SATISFIED → DISPUTED status flip (admissibility-gated, NOT defeat-gated
//     — see FACT A in the spec: defeat evaluation is batch, not synchronous).
//
// Auth-agnostic: the caller resolves `userId` (via MCP bearer or cookie) and
// passes it in. There is NO self-canonical floor here — challenging is not a
// self-discharging act.

import crypto from "crypto";
import { prisma } from "@/lib/prismaclient";
import { getOrCreatePermalink } from "@/lib/citations/permalinkService";
import { requiresEvidenceFromActor } from "@/lib/dialogue/burdenGuards";
import { mintObjectionClaim } from "@/lib/claims/mintObjectionClaim";
import { recomputeGroundedForDelib } from "@/lib/ceg/grounded";
import type { BurdenOfProof, ClaimAttackType } from "@prisma/client";

export type ChallengeCQErrorCode =
  | "CQ_ARGUMENT_NOT_FOUND"
  | "CQ_NOT_FOUND"
  | "CQ_AMBIGUOUS_SCHEME"
  | "CQ_NOT_ANSWERED"
  | "CQ_CHALLENGE_NEEDS_EVIDENCE"
  | "CQ_EVIDENCE_NOT_FOUND"
  | "CQ_DUPLICATE_CHALLENGE";

export type ChallengeAttackKind = "REBUT" | "UNDERMINE" | "UNDERCUT";

export interface ChallengeCQInput {
  /** Resolved caller id (auth_id string). MCP callers resolve to `mcp-bot`. */
  userId: string;
  argumentId: string;
  cqKey: string;
  /** Disambiguates inherited CQs when the same cqKey exists on >1 scheme. */
  schemeKey?: string;
  /** REQUIRED (§10.3 — never inferred; evidence rule is type-dependent). */
  attackType: ChallengeAttackKind;
  groundsText: string;
  evidenceClaimIds?: string[];
  sourceUrls?: string[];
  /** Idempotency key; a retry with the same key replays the first challenge. */
  requestId?: string;
}

export type ChallengeCQResult =
  | {
      ok: false;
      status: number;
      code: ChallengeCQErrorCode;
      error: string;
    }
  | {
      ok: true;
      status: number;
      cqStatusId: string;
      challengeClaimId: string;
      answerClaimId: string;
      claimEdgeId: string;
      cqAttackId: string;
      cqStatusEnum: string;
      attackType: ChallengeAttackKind;
      permalink: string | null;
      idempotentReplay?: true;
    };

/**
 * attackType → ClaimEdge fields (covers all three; fills the gap in
 * `createClaimAttack`, whose Suggestion union has no UNDERMINE case).
 * `ClaimEdgeType` has no dedicated attack member beyond `rebuts`; the attack
 * semantics live on `attackType` + `targetScope`, matching existing rows.
 */
function mapAttack(kind: ChallengeAttackKind): {
  attackType: ClaimAttackType;
  targetScope: string;
} {
  switch (kind) {
    case "REBUT":
      return { attackType: "REBUTS", targetScope: "conclusion" };
    case "UNDERMINE":
      return { attackType: "UNDERMINES", targetScope: "premise" };
    case "UNDERCUT":
      return { attackType: "UNDERCUTS", targetScope: "inference" };
  }
}

export async function challengeCriticalQuestion(
  input: ChallengeCQInput,
): Promise<ChallengeCQResult> {
  const {
    userId,
    argumentId,
    cqKey,
    schemeKey,
    attackType,
    groundsText,
    evidenceClaimIds = [],
    sourceUrls = [],
    requestId,
  } = input;

  // 1. Load the argument + its schemes/CQ catalogue (incl. per-CQ burden fields).
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      id: true,
      deliberationId: true,
      argumentSchemes: {
        select: {
          scheme: {
            select: {
              id: true,
              key: true,
              cqs: {
                select: {
                  cqKey: true,
                  burdenOfProof: true,
                  requiresEvidence: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!argument) {
    return {
      ok: false,
      status: 404,
      code: "CQ_ARGUMENT_NOT_FOUND",
      error: `Argument not found: ${argumentId}`,
    };
  }

  // 2. Resolve (schemeKey, cqKey) against the argument's schemes (same logic as
  //    answerOverMcp). Also capture the resolved CQ's burden flags.
  const cqKeyLc = cqKey.toLowerCase();
  type ResolvedScheme = {
    key: string;
    cq: {
      cqKey: string | null;
      burdenOfProof: BurdenOfProof;
      requiresEvidence: boolean;
    };
  };
  const matches: ResolvedScheme[] = argument.argumentSchemes
    .map((s) => s.scheme)
    .map((sch) => {
      const cq = sch.cqs.find(
        (c) => (c.cqKey ?? "").toLowerCase() === cqKeyLc,
      );
      return cq ? { key: sch.key, cq } : null;
    })
    .filter((m): m is ResolvedScheme => m !== null);

  if (matches.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "CQ_NOT_FOUND",
      error: `No critical question '${cqKey}' on this argument's schemes.`,
    };
  }

  let resolved: ResolvedScheme | null = null;
  if (schemeKey) {
    resolved = matches.find((m) => m.key === schemeKey) ?? null;
    if (!resolved) {
      return {
        ok: false,
        status: 400,
        code: "CQ_NOT_FOUND",
        error: `Critical question '${cqKey}' is not anchored on scheme '${schemeKey}' for this argument.`,
      };
    }
  } else if (matches.length === 1) {
    resolved = matches[0];
  } else {
    return {
      ok: false,
      status: 400,
      code: "CQ_AMBIGUOUS_SCHEME",
      error: `Critical question '${cqKey}' exists on multiple schemes (${matches
        .map((m) => m.key)
        .join(", ")}). Pass an explicit schemeKey.`,
    };
  }

  const resolvedSchemeKey = resolved.key;

  // 3. Load the CQStatus and require it to be ANSWERED (SATISFIED + canonical).
  const cqStatus = await prisma.cQStatus.findUnique({
    where: {
      targetType_targetId_schemeKey_cqKey: {
        targetType: "argument",
        targetId: argument.id,
        schemeKey: resolvedSchemeKey,
        cqKey,
      },
    },
    select: {
      id: true,
      statusEnum: true,
      canonicalResponseId: true,
      canonicalResponse: {
        select: {
          id: true,
          groundsText: true,
          contributorId: true,
          answerClaimId: true,
        },
      },
    },
  });

  if (
    !cqStatus ||
    cqStatus.statusEnum !== "SATISFIED" ||
    !cqStatus.canonicalResponseId ||
    !cqStatus.canonicalResponse
  ) {
    return {
      ok: false,
      status: 409,
      code: "CQ_NOT_ANSWERED",
      error:
        "You can only challenge an answered critical question (one with a canonical, satisfied answer).",
    };
  }

  // 4. Admissibility bar (§10.1) — burden-aware, via the shipped guard.
  //    The challenger is never the proponent → isProponent = false.
  const evidenceRequired =
    attackType === "UNDERMINE" ||
    requiresEvidenceFromActor(
      {
        burdenOfProof: resolved.cq.burdenOfProof ?? "PROPONENT",
        requiresEvidence: resolved.cq.requiresEvidence,
      },
      false,
    );
  const evidenceCount = evidenceClaimIds.length + sourceUrls.length;
  if (evidenceRequired && evidenceCount === 0) {
    return {
      ok: false,
      status: 422,
      code: "CQ_CHALLENGE_NEEDS_EVIDENCE",
      error:
        attackType === "UNDERMINE"
          ? "An UNDERMINE challenge contests the cited evidence and must itself cite at least one evidence claim or source URL."
          : "This critical question places the evidential burden on the challenger; provide at least one evidence claim or source URL.",
    };
  }

  // 5. Verify evidence claims exist (if provided).
  if (evidenceClaimIds.length > 0) {
    const claims = await prisma.claim.findMany({
      where: { id: { in: evidenceClaimIds } },
      select: { id: true },
    });
    if (claims.length !== evidenceClaimIds.length) {
      return {
        ok: false,
        status: 400,
        code: "CQ_EVIDENCE_NOT_FOUND",
        error: "One or more evidence claims not found.",
      };
    }
  }

  // 6a. Idempotency pre-flight — replay a prior challenge carrying this requestId.
  if (requestId) {
    const priorEdge = await prisma.claimEdge.findFirst({
      where: {
        metaJson: {
          path: ["requestId"],
          equals: requestId,
        },
      },
      select: {
        id: true,
        fromClaimId: true,
        toClaimId: true,
        metaJson: true,
        cqAttacks: { select: { id: true }, take: 1 },
      },
    });
    if (priorEdge) {
      const permalink = await getPermalinkSafe(argument.id);
      return {
        ok: true,
        status: 200,
        cqStatusId: cqStatus.id,
        challengeClaimId: priorEdge.fromClaimId,
        answerClaimId: priorEdge.toClaimId,
        claimEdgeId: priorEdge.id,
        cqAttackId: priorEdge.cqAttacks[0]?.id ?? "",
        cqStatusEnum: "DISPUTED",
        attackType,
        permalink,
        idempotentReplay: true,
      };
    }
  }

  // 6b. Duplicate guard — one live challenge per contributor per answer.
  const existingChallenge = await prisma.claimEdge.findFirst({
    where: {
      from: { createdById: userId },
      metaJson: {
        path: ["cqStatusId"],
        equals: cqStatus.id,
      },
    },
    select: { id: true },
  });
  if (existingChallenge) {
    return {
      ok: false,
      status: 409,
      code: "CQ_DUPLICATE_CHALLENGE",
      error:
        "You already have an open challenge on this answer. Withdraw it before filing another.",
    };
  }

  const { attackType: edgeAttackType, targetScope } = mapAttack(attackType);

  // 7. Transaction — all writes via tx.
  const tx = await prisma.$transaction(async (tx) => {
    // 7.1 Lazy answer-claim (§4.1). Materialise the canonical answer as a
    //     scheme-free Claim if it isn't already, so it can be the edge TARGET.
    let answerClaimId = cqStatus.canonicalResponse!.answerClaimId;
    if (!answerClaimId) {
      const answerClaim = await tx.claim.create({
        data: {
          text: cqStatus.canonicalResponse!.groundsText.slice(0, 5000),
          // Authorship stays with the answerer.
          createdById: cqStatus.canonicalResponse!.contributorId,
          moid: `cq-answer-${crypto.randomBytes(8).toString("hex")}`,
          deliberationId: argument.deliberationId,
        },
        select: { id: true },
      });
      answerClaimId = answerClaim.id;
      await tx.cQResponse.update({
        where: { id: cqStatus.canonicalResponse!.id },
        data: { answerClaimId },
      });
    }

    // 7.2 Challenge-claim — the objection node (scheme-free → no CQs).
    //     Shared with the freestanding attack path via mintObjectionClaim.
    const challengeClaim = await mintObjectionClaim({
      db: tx,
      text: groundsText,
      createdById: userId,
      deliberationId: argument.deliberationId,
      moidPrefix: "cq-challenge",
    });

    // 7.3 Attack edge (challenge-claim → answer-claim).
    const edge = await tx.claimEdge.upsert({
      where: {
        unique_from_to_type_attack: {
          fromClaimId: challengeClaim.id,
          toClaimId: answerClaimId,
          type: "rebuts",
          attackType: edgeAttackType,
        },
      },
      update: {},
      create: {
        fromClaimId: challengeClaim.id,
        toClaimId: answerClaimId,
        type: "rebuts",
        attackType: edgeAttackType,
        targetScope,
        deliberationId: argument.deliberationId,
        metaJson: {
          cqKey,
          schemeKey: resolvedSchemeKey,
          cqStatusId: cqStatus.id,
          source: "cq-challenge",
          ...(requestId ? { requestId } : {}),
        },
      },
      select: { id: true },
    });

    // 7.4 CQ↔attack provenance.
    const cqAttack = await tx.cQAttack.create({
      data: {
        cqStatusId: cqStatus.id,
        claimEdgeId: edge.id,
        conflictApplicationId: null,
        createdById: userId,
      },
      select: { id: true },
    });

    // 7.5 Status flip SATISFIED → DISPUTED (canonical response stays CANONICAL).
    let finalStatusEnum: string = cqStatus.statusEnum;
    if (cqStatus.statusEnum === "SATISFIED") {
      await tx.cQStatus.update({
        where: { id: cqStatus.id },
        data: { statusEnum: "DISPUTED" },
      });
      finalStatusEnum = "DISPUTED";

      await tx.cQActivityLog.create({
        data: {
          cqStatusId: cqStatus.id,
          action: "STATUS_CHANGED",
          actorId: userId,
          metadata: { from: "SATISFIED", to: "DISPUTED", reason: "challenge" },
        },
      });
    }

    // 7.6 Audit.
    await tx.cQActivityLog.create({
      data: {
        cqStatusId: cqStatus.id,
        action: "CHALLENGE_FILED",
        actorId: userId,
        metadata: {
          attackType,
          claimEdgeId: edge.id,
          challengeClaimId: challengeClaim.id,
          evidenceCount: evidenceClaimIds.length,
          sourceCount: sourceUrls.length,
        },
      },
    });

    return {
      answerClaimId,
      challengeClaimId: challengeClaim.id,
      claimEdgeId: edge.id,
      cqAttackId: cqAttack.id,
      finalStatusEnum,
    };
  });

  // Out-of-band, best-effort grounded recompute (§11.6 — feeds the overlay,
  // never gates the flip). Fire-and-forget; never block the response.
  if (argument.deliberationId) {
    void recomputeGroundedForDelib(argument.deliberationId).catch(() => {});
  }

  const permalink = await getPermalinkSafe(argument.id);

  return {
    ok: true,
    status: 201,
    cqStatusId: cqStatus.id,
    challengeClaimId: tx.challengeClaimId,
    answerClaimId: tx.answerClaimId,
    claimEdgeId: tx.claimEdgeId,
    cqAttackId: tx.cqAttackId,
    cqStatusEnum: tx.finalStatusEnum,
    attackType,
    permalink,
  };
}

/** Best-effort permalink resolution; never throws into the response path. */
async function getPermalinkSafe(argumentId: string): Promise<string | null> {
  try {
    const info = await getOrCreatePermalink(argumentId);
    return info.fullUrl;
  } catch {
    return null;
  }
}
