/**
 * Typology — Candidate service
 *
 * CRUD for `TypologyCandidate` rows. Seeders (intervention/metric/repeated-
 * attack/value-lexicon) call `enqueueCandidate`. Facilitators promote or
 * dismiss via the cockpit.
 *
 * Idempotency on enqueue: a partial unique index on
 * `seedReferenceJson->>'facilitationEventId'` rejects duplicate inserts at
 * the DB layer; this service maps the resulting `P2002` to a no-op return
 * (`{ candidate, created: false }`) so subscribers can safely re-fire.
 *
 * Status: B1 scaffold.
 */

import { prisma } from "@/lib/prismaclient";
import { Prisma } from "@prisma/client";
import type { TypologyCandidate as PrismaTypologyCandidate } from "@prisma/client";
import { resolveActiveAxis } from "./axisRegistry";
import { proposeTag, confirmTag } from "./tagService";
import { appendEvent } from "./typologyEventService";
import {
  DisagreementTagAuthorRole,
  DisagreementTagSeedSource,
  DisagreementTagTargetType,
  MetaConsensusEventType,
} from "./types";
import type { EnqueueCandidateInput, PromoteCandidateInput } from "./schemas";

export class CandidateServiceError extends Error {
  constructor(
    public readonly code:
      | "CONFLICT_CANDIDATE_RESOLVED"
      | "CONFLICT_CANDIDATE_NOT_FOUND"
      | "CONFLICT_PROMOTE_REQUIRES_TARGET",
    message: string,
  ) {
    super(message);
    this.name = "CandidateServiceError";
  }
}

export interface EnqueueCandidateOptions extends EnqueueCandidateInput {
  deliberationId: string;
}

/**
 * Insert a candidate row. Idempotent on
 * `seedReferenceJson.facilitationEventId` — a duplicate insert returns the
 * existing row with `created: false`.
 */
export async function enqueueCandidate(
  input: EnqueueCandidateOptions,
): Promise<{ candidate: PrismaTypologyCandidate; created: boolean }> {
  const { axisId, axisVersion } = await resolveActiveAxis(input.suggestedAxisKey);

  const data: Prisma.TypologyCandidateCreateInput = {
    deliberation: { connect: { id: input.deliberationId } },
    session: { connect: { id: input.sessionId } },
    targetType: (input.targetType ?? null) as DisagreementTagTargetType | null,
    targetId: input.targetId ?? null,
    suggestedAxis: { connect: { id: axisId } },
    suggestedAxisVersion: axisVersion,
    seedSource: input.seedSource,
    seedReferenceJson: input.seedReferenceJson as Prisma.InputJsonValue,
    rationaleText: input.rationaleText,
    priority: input.priority,
    ruleName: input.ruleName,
    ruleVersion: input.ruleVersion,
  };

  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.typologyCandidate.create({ data });
      await appendEvent(
        {
          deliberationId: input.deliberationId,
          sessionId: input.sessionId,
          eventType: MetaConsensusEventType.CANDIDATE_ENQUEUED,
          actorId: "system",
          actorRole: "system",
          payloadJson: {
            candidateId: created.id,
            ruleName: input.ruleName,
            ruleVersion: input.ruleVersion,
            seedSource: input.seedSource,
            priority: input.priority,
            targetType: input.targetType ?? null,
            targetId: input.targetId ?? null,
            axisKey: input.suggestedAxisKey,
            axisVersion,
            seedReferenceJson: input.seedReferenceJson,
          },
          candidateId: created.id,
        },
        tx,
      );
      return created;
    });
    return { candidate: row, created: true };
  } catch (err) {
    // P2002 from the partial unique index → existing row from the same
    // facilitationEventId. Return it idempotently.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const facilitationEventId = (input.seedReferenceJson as Record<string, unknown>)
        ?.facilitationEventId;
      if (typeof facilitationEventId === "string") {
        const existing = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "TypologyCandidate"
          WHERE "seedReferenceJson"->>'facilitationEventId' = ${facilitationEventId}
          LIMIT 1
        `;
        if (existing[0]) {
          const row = await prisma.typologyCandidate.findUnique({ where: { id: existing[0].id } });
          if (row) return { candidate: row, created: false };
        }
      }
    }
    throw err;
  }
}

export async function listCandidates(
  sessionId: string,
  opts: {
    includeResolved?: boolean;
    limit?: number;
    cursor?: string;
  } = {},
): Promise<PrismaTypologyCandidate[]> {
  const { limit = 100, cursor } = opts;
  return prisma.typologyCandidate.findMany({
    where: {
      sessionId,
      ...(opts.includeResolved
        ? {}
        : { promotedAt: null, dismissedAt: null }),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

export async function getCandidate(id: string): Promise<PrismaTypologyCandidate | null> {
  return prisma.typologyCandidate.findUnique({ where: { id } });
}

/**
 * Promote a candidate to a confirmed tag. Requires the candidate to carry a
 * concrete `(targetType, targetId)`; session-scoped candidates (no target)
 * cannot be promoted directly — facilitators must author a manual tag.
 */
export async function promoteCandidate(
  candidateId: string,
  authoredById: string,
  input: PromoteCandidateInput,
): Promise<{ candidate: PrismaTypologyCandidate; tagId: string }> {
  const candidate = await prisma.typologyCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) {
    throw new CandidateServiceError(
      "CONFLICT_CANDIDATE_NOT_FOUND",
      `candidate not found: ${candidateId}`,
    );
  }
  if (candidate.promotedAt || candidate.dismissedAt) {
    throw new CandidateServiceError(
      "CONFLICT_CANDIDATE_RESOLVED",
      `candidate already resolved: ${candidateId}`,
    );
  }
  if (!candidate.targetType || !candidate.targetId) {
    throw new CandidateServiceError(
      "CONFLICT_PROMOTE_REQUIRES_TARGET",
      `candidate ${candidateId} has no target; promote requires a concrete target`,
    );
  }

  const axis = await prisma.disagreementAxis.findUnique({
    where: { id: candidate.suggestedAxisId },
    select: { key: true },
  });
  if (!axis) {
    throw new CandidateServiceError(
      "CONFLICT_CANDIDATE_NOT_FOUND",
      `candidate ${candidateId} references unknown axis`,
    );
  }
  const axisKey = (input.axisKey ?? axis.key) as Parameters<typeof proposeTag>[0]["axisKey"];

  // Carry candidate's seed reference forward into the tag for replay safety.
  const seedRef = (candidate.seedReferenceJson ?? {}) as Record<string, unknown>;

  const propose = await proposeTag({
    deliberationId: candidate.deliberationId,
    sessionId: input.sessionScope ? candidate.sessionId : null,
    targetType: candidate.targetType as DisagreementTagTargetType,
    targetId: candidate.targetId,
    axisKey,
    confidence: input.confidence ?? 0.5,
    evidenceText: input.evidenceText ?? candidate.rationaleText,
    authoredById,
    authoredRole: DisagreementTagAuthorRole.FACILITATOR,
    seedSource: candidate.seedSource as DisagreementTagSeedSource,
    seedReferenceJson: { ...seedRef, candidateId: candidate.id },
    promotedFromCandidateId: candidate.id,
  });

  // Auto-confirm on promote — facilitator action means an explicit acknowledgement.
  await confirmTag(propose.tag.id, authoredById);

  const updated = await prisma.typologyCandidate.update({
    where: { id: candidate.id },
    data: {
      promotedAt: new Date(),
      promotedById: authoredById,
      promotedToTagId: propose.tag.id,
    },
  });

  return { candidate: updated, tagId: propose.tag.id };
}

export async function dismissCandidate(
  candidateId: string,
  authoredById: string,
  reasonText: string,
): Promise<PrismaTypologyCandidate> {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.typologyCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) {
      throw new CandidateServiceError(
        "CONFLICT_CANDIDATE_NOT_FOUND",
        `candidate not found: ${candidateId}`,
      );
    }
    if (candidate.promotedAt || candidate.dismissedAt) {
      throw new CandidateServiceError(
        "CONFLICT_CANDIDATE_RESOLVED",
        `candidate already resolved: ${candidateId}`,
      );
    }

    const updated = await tx.typologyCandidate.update({
      where: { id: candidate.id },
      data: {
        dismissedAt: new Date(),
        dismissedById: authoredById,
        dismissedReasonText: reasonText,
      },
    });

    await appendEvent(
      {
        deliberationId: updated.deliberationId,
        sessionId: updated.sessionId,
        eventType: MetaConsensusEventType.CANDIDATE_DISMISSED,
        actorId: authoredById,
        actorRole: "facilitator",
        payloadJson: {
          candidateId: updated.id,
          reasonText,
          ruleName: updated.ruleName,
        },
        candidateId: updated.id,
      },
      tx,
    );

    return updated;
  });
}
