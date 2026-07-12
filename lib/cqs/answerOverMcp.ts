// lib/cqs/answerOverMcp.ts
//
// Core logic for POST /api/cqs/answer (Roadmap S3). One transactional path
// that: resolves the argument + its (scheme, cqKey), upserts the `CQStatus`,
// submits a `CQResponse`, and — ONLY when the answering session matches the
// AI-authored argument's creating session — runs the approve→canonical
// transition inline (reusing the existing supersede logic, not the cookie-only
// web routes).
//
// Auth-agnostic: the caller resolves `userId` (via MCP bearer or cookie) and
// passes it in. The self-canonical eligibility test is server-derived from the
// argument's `aiProvenance`, never from the caller's claimed identity.

import { prisma } from "@/lib/prismaclient";
import {
  actProvenanceFields,
  type IndependenceCoordinates,
} from "@/lib/provenance/coordinates";
import { getOrCreatePermalink } from "@/lib/citations/permalinkService";

export type AnswerCQErrorCode =
  | "CQ_ARGUMENT_NOT_FOUND"
  | "CQ_NOT_FOUND"
  | "CQ_AMBIGUOUS_SCHEME"
  | "CQ_EVIDENCE_NOT_FOUND"
  | "CQ_DUPLICATE_PENDING";

export type AnswerCQWarningCode = "CQ_SELF_CANONICAL_DENIED";

export interface AnswerCQInput {
  /** Resolved caller id (auth_id string). MCP callers resolve to `mcp-bot`. */
  userId: string;
  argumentId: string;
  cqKey: string;
  /** Disambiguates inherited CQs when the same cqKey exists on >1 scheme. */
  schemeKey?: string;
  groundsText: string;
  evidenceClaimIds?: string[];
  sourceUrls?: string[];
  /** Per-session capability token; matched against the argument's provenance. */
  sessionId?: string;
  /** When true (default), attempt self-canonicalisation if eligible. */
  promoteToCanonical?: boolean;
  /** Idempotency key; a retry with the same key replays the first answer. */
  requestId?: string;
  /** N-1: raw independence coordinates of the answering agent/harness. */
  coordinates?: IndependenceCoordinates;
}

export interface AnswerCQWarning {
  code: AnswerCQWarningCode;
  detail: string;
}

export type AnswerCQResult =
  | {
      ok: false;
      status: number;
      code: AnswerCQErrorCode;
      error: string;
    }
  | {
      ok: true;
      status: number;
      cqStatusId: string;
      responseId: string;
      responseStatus: "PENDING" | "CANONICAL";
      canonical: boolean;
      cqStatusEnum: string;
      permalink: string | null;
      warnings: AnswerCQWarning[];
      idempotentReplay?: true;
    };

/** Provenance shape we read off `Argument.aiProvenance`. */
interface ArgProvenance {
  via?: string;
  sessionId?: string;
}

function isAiAuthored(authorKind: string | null | undefined): boolean {
  return authorKind === "AI" || authorKind === "HYBRID";
}

/**
 * The self-canonical floor. An answer may self-canonicalise iff:
 *   1. the target argument is AI/HYBRID-authored (NEVER on a human argument),
 *   2. its provenance was minted over MCP (`via` starts with "mcp"), and
 *   3. the answering `sessionId` exactly matches the creating session.
 */
function isSelfCanonicalEligible(
  authorKind: string | null | undefined,
  prov: ArgProvenance | null,
  sessionId: string | undefined,
): boolean {
  if (!isAiAuthored(authorKind)) return false;
  if (!prov || typeof prov.via !== "string" || !prov.via.startsWith("mcp")) {
    return false;
  }
  if (!prov.sessionId || !sessionId) return false;
  return prov.sessionId === sessionId;
}

export async function answerCriticalQuestionOverMcp(
  input: AnswerCQInput,
): Promise<AnswerCQResult> {
  const {
    userId,
    argumentId,
    cqKey,
    schemeKey,
    groundsText,
    evidenceClaimIds = [],
    sourceUrls = [],
    sessionId,
    promoteToCanonical = true,
    requestId,
    coordinates,
  } = input;

  // 1. Load the argument + its schemes/CQ catalogue.
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      id: true,
      authorId: true,
      deliberationId: true,
      authorKind: true,
      aiProvenance: true,
      argumentSchemes: {
        select: {
          isPrimary: true,
          scheme: {
            select: {
              id: true,
              key: true,
              cqs: { select: { cqKey: true } },
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

  // 2. Resolve (schemeKey, cqKey) against the argument's schemes.
  const cqKeyLc = cqKey.toLowerCase();
  const matches = argument.argumentSchemes
    .map((s) => s.scheme)
    .filter((sch) =>
      sch.cqs.some((cq) => (cq.cqKey ?? "").toLowerCase() === cqKeyLc),
    );

  if (matches.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "CQ_NOT_FOUND",
      error: `No critical question '${cqKey}' on this argument's schemes.`,
    };
  }

  let resolvedScheme: { id: string; key: string } | null = null;
  if (schemeKey) {
    resolvedScheme =
      matches.find((m) => m.key === schemeKey) ?? null;
    if (!resolvedScheme) {
      return {
        ok: false,
        status: 400,
        code: "CQ_NOT_FOUND",
        error: `Critical question '${cqKey}' is not anchored on scheme '${schemeKey}' for this argument.`,
      };
    }
  } else if (matches.length === 1) {
    resolvedScheme = matches[0];
  } else {
    // Ambiguous: same cqKey on multiple schemes; require an explicit schemeKey.
    return {
      ok: false,
      status: 400,
      code: "CQ_AMBIGUOUS_SCHEME",
      error: `Critical question '${cqKey}' exists on multiple schemes (${matches
        .map((m) => m.key)
        .join(", ")}). Pass an explicit schemeKey.`,
    };
  }

  const resolvedSchemeKey = resolvedScheme.key;

  // 3. Idempotency pre-flight — replay a prior answer carrying this requestId.
  if (requestId) {
    const prior = await prisma.cQResponse.findFirst({
      where: { contributorId: userId, requestId },
      select: {
        id: true,
        cqStatusId: true,
        responseStatus: true,
        cqStatus: { select: { statusEnum: true } },
      },
    });
    if (prior) {
      const permalink = await getPermalinkSafe(argument.id);
      return {
        ok: true,
        status: 200,
        cqStatusId: prior.cqStatusId,
        responseId: prior.id,
        responseStatus:
          prior.responseStatus === "CANONICAL" ? "CANONICAL" : "PENDING",
        canonical: prior.responseStatus === "CANONICAL",
        cqStatusEnum: prior.cqStatus?.statusEnum ?? "OPEN",
        permalink,
        warnings: [],
        idempotentReplay: true,
      };
    }
  }

  // 4. Verify evidence claims exist (if provided).
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

  // 5. Resolve the room for RLS denormalisation (best-effort).
  const roomId = await resolveRoomId(argument.deliberationId);

  // 6. Upsert the CQStatus on @@unique([targetType, targetId, schemeKey, cqKey]).
  const cqStatus = await prisma.cQStatus.upsert({
    where: {
      targetType_targetId_schemeKey_cqKey: {
        targetType: "argument",
        targetId: argument.id,
        schemeKey: resolvedSchemeKey,
        cqKey,
      },
    },
    create: {
      targetType: "argument",
      targetId: argument.id,
      argumentId: argument.id,
      schemeKey: resolvedSchemeKey,
      cqKey,
      createdById: userId,
      roomId,
    },
    update: {},
    select: { id: true, statusEnum: true, canonicalResponseId: true },
  });

  // 7. Duplicate-pending guard (mirrors the web submit route).
  const existingPending = await prisma.cQResponse.findFirst({
    where: {
      cqStatusId: cqStatus.id,
      contributorId: userId,
      responseStatus: "PENDING",
    },
    select: { id: true },
  });
  if (existingPending) {
    return {
      ok: false,
      status: 409,
      code: "CQ_DUPLICATE_PENDING",
      error:
        "You already have a pending response for this CQ. Wait for review or withdraw it first.",
    };
  }

  // 8. Self-canonical eligibility (server-derived).
  const prov = (argument.aiProvenance as ArgProvenance | null) ?? null;
  const selfEligible = isSelfCanonicalEligible(
    argument.authorKind,
    prov,
    sessionId,
  );
  const wantsCanonical = promoteToCanonical;
  const willCanonical = selfEligible && wantsCanonical;

  const warnings: AnswerCQWarning[] = [];
  if (wantsCanonical && !selfEligible) {
    warnings.push({
      code: "CQ_SELF_CANONICAL_DENIED",
      detail: !isAiAuthored(argument.authorKind)
        ? "Self-canonicalisation is never permitted on a human-authored argument; the answer was recorded as a pending proposal for human review."
        : "Self-canonicalisation requires the answering sessionId to match the AI argument's creating MCP session; the answer was recorded as a pending proposal.",
    });
  }

  // 9. Transaction: create response, advance status, (optionally) canonicalise.
  const result = await prisma.$transaction(async (tx) => {
    const response = await tx.cQResponse.create({
      data: {
        cqStatusId: cqStatus.id,
        groundsText,
        evidenceClaimIds,
        sourceUrls,
        responseStatus: willCanonical ? "CANONICAL" : "PENDING",
        contributorId: userId,
        requestId: requestId ?? null,
        ...(willCanonical
          ? { reviewedAt: new Date(), reviewedBy: userId }
          : {}),
      },
      select: { id: true },
    });

    // N-1: capture the answerer's independence coordinates atomically with the
    // response. A CQ answer is a judgment-laden CONFIRM-side act — exactly the
    // quadrant whose correlated error the coordinates exist to expose later.
    {
      const fields = actProvenanceFields(
        { ...(coordinates ?? {}), sessionId: coordinates?.sessionId ?? sessionId },
        "mcp",
      );
      await tx.actProvenance.upsert({
        where: {
          subjectType_subjectId: {
            subjectType: "cq_response",
            subjectId: response.id,
          },
        },
        create: {
          subjectType: "cq_response",
          subjectId: response.id,
          ...fields,
        },
        update: fields,
      });
    }

    await tx.cQActivityLog.create({
      data: {
        cqStatusId: cqStatus.id,
        action: "RESPONSE_SUBMITTED",
        actorId: userId,
        responseId: response.id,
        metadata: {
          evidenceCount: evidenceClaimIds.length,
          sourceCount: sourceUrls.length,
          viaMcp: true,
        },
      },
    });

    let finalStatusEnum: string = cqStatus.statusEnum;

    if (willCanonical) {
      // Supersede any prior canonical response.
      if (
        cqStatus.canonicalResponseId &&
        cqStatus.canonicalResponseId !== response.id
      ) {
        await tx.cQResponse.update({
          where: { id: cqStatus.canonicalResponseId },
          data: { responseStatus: "SUPERSEDED" },
        });
      }

      await tx.cQStatus.update({
        where: { id: cqStatus.id },
        data: {
          canonicalResponseId: response.id,
          statusEnum: "SATISFIED",
          lastReviewedAt: new Date(),
          lastReviewedBy: userId,
        },
      });

      await tx.cQActivityLog.create({
        data: {
          cqStatusId: cqStatus.id,
          action: "CANONICAL_SELECTED",
          actorId: userId,
          responseId: response.id,
          metadata: {
            previousCanonical: cqStatus.canonicalResponseId,
            selfCanonical: true,
          },
        },
      });

      finalStatusEnum = "SATISFIED";
    } else if (cqStatus.statusEnum === "OPEN") {
      // First engagement: OPEN → PENDING_REVIEW.
      await tx.cQStatus.update({
        where: { id: cqStatus.id },
        data: { statusEnum: "PENDING_REVIEW" },
      });
      finalStatusEnum = "PENDING_REVIEW";
    }

    return { responseId: response.id, finalStatusEnum };
  });

  const permalink = await getPermalinkSafe(argument.id);

  return {
    ok: true,
    status: 200,
    cqStatusId: cqStatus.id,
    responseId: result.responseId,
    responseStatus: willCanonical ? "CANONICAL" : "PENDING",
    canonical: willCanonical,
    cqStatusEnum: result.finalStatusEnum,
    permalink,
    warnings,
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

/**
 * Resolve a denormalised `roomId` for a deliberation, used for CQ RLS scoping.
 * Returns null when no room is associated (free / standalone deliberations).
 */
async function resolveRoomId(
  deliberationId: string | null | undefined,
): Promise<string | null> {
  if (!deliberationId) return null;
  try {
    const delib = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { roomId: true },
    });
    return delib?.roomId ?? null;
  } catch {
    return null;
  }
}
