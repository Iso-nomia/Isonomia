/**
 * Typology — Tag service
 *
 * CRUD for `DisagreementTag` rows. Implements the service-layer idempotency
 * rule documented in MIGRATION_DRAFT.md:
 *
 *   "(deliberationId, targetType, targetId, axisId, authoredById) — find
 *    latest non-retracted, otherwise insert."
 *
 * Re-tagging the same tuple updates the existing row's `confidence` /
 * `evidenceText` and emits a fresh `TAG_PROPOSED` event for the audit trail.
 *
 * Status: B1 scaffold.
 */

import { prisma } from "@/lib/prismaclient";
import { Prisma } from "@prisma/client";
import type {
  DisagreementTag as PrismaDisagreementTag,
} from "@prisma/client";
import { resolveActiveAxis } from "./axisRegistry";
import { appendEvent } from "./typologyEventService";
import {
  DisagreementTagSeedSource,
  DisagreementTagTargetType,
  MetaConsensusEventType,
} from "./types";
import type { ProposeTagInput } from "./schemas";

export class TagServiceError extends Error {
  constructor(
    public readonly code:
      | "CONFLICT_TARGET_OUTSIDE_DELIBERATION"
      | "CONFLICT_TAG_RETRACTED"
      | "CONFLICT_TAG_NOT_FOUND"
      | "CONFLICT_AXIS_INACTIVE",
    message: string,
  ) {
    super(message);
    this.name = "TagServiceError";
  }
}

/**
 * Best-effort guard that the (targetType, targetId) reference resolves to an
 * entity inside `deliberationId`. We do not enforce this in the DB because
 * the polymorphic targetId would require either a per-target FK or a
 * trigger. App-layer guard mirrors `FacilitationIntervention.targetId`
 * semantics.
 */
export async function assertTargetExists(
  deliberationId: string,
  targetType: DisagreementTagTargetType,
  targetId: string,
): Promise<void> {
  const notFound = () => {
    throw new TagServiceError(
      "CONFLICT_TARGET_OUTSIDE_DELIBERATION",
      `${targetType} ${targetId} not found in deliberation ${deliberationId}`,
    );
  };

  if (targetType === DisagreementTagTargetType.CLAIM) {
    const row = await prisma.claim.findUnique({
      where: { id: targetId },
      select: { deliberationId: true },
    });
    if (!row || row.deliberationId !== deliberationId) notFound();
    return;
  }
  if (targetType === DisagreementTagTargetType.ARGUMENT) {
    const row = await prisma.argument.findUnique({
      where: { id: targetId },
      select: { deliberationId: true },
    });
    if (!row || row.deliberationId !== deliberationId) notFound();
    return;
  }
  if (targetType === DisagreementTagTargetType.EDGE) {
    const row = await prisma.argumentEdge.findUnique({
      where: { id: targetId },
      select: { deliberationId: true },
    });
    if (!row || row.deliberationId !== deliberationId) notFound();
    return;
  }
}

export interface ProposeTagOptions extends ProposeTagInput {
  deliberationId: string;
  authoredById: string;
}

/**
 * Propose-or-upsert a tag. Returns the persisted row plus a flag indicating
 * whether the row was newly created vs updated.
 */
export async function proposeTag(
  input: ProposeTagOptions,
): Promise<{ tag: PrismaDisagreementTag; created: boolean }> {
  await assertTargetExists(input.deliberationId, input.targetType, input.targetId);
  const { axisId, axisVersion } = await resolveActiveAxis(input.axisKey);

  const sessionId = input.sessionId ?? null;
  const confidence = new Prisma.Decimal(input.confidence.toFixed(3));

  const result = await prisma.$transaction(async (tx) => {
    // Idempotency probe: latest non-retracted row for this tuple.
    const existing = await tx.disagreementTag.findFirst({
      where: {
        deliberationId: input.deliberationId,
        targetType: input.targetType,
        targetId: input.targetId,
        axisId,
        authoredById: input.authoredById,
        retractedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    let row: PrismaDisagreementTag;
    let created: boolean;
    if (existing) {
      row = await tx.disagreementTag.update({
        where: { id: existing.id },
        data: {
          axisVersion, // refresh pin to current registry version
          confidence,
          evidenceText: input.evidenceText,
          evidenceJson: (input.evidenceJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          sessionId,
        },
      });
      created = false;
    } else {
      row = await tx.disagreementTag.create({
        data: {
          deliberationId: input.deliberationId,
          sessionId,
          targetType: input.targetType,
          targetId: input.targetId,
          axisId,
          axisVersion,
          confidence,
          evidenceText: input.evidenceText,
          evidenceJson: (input.evidenceJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          authoredById: input.authoredById,
          authoredRole: input.authoredRole,
          seedSource: input.seedSource,
          seedReferenceJson: (input.seedReferenceJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          promotedFromCandidateId: input.promotedFromCandidateId ?? null,
        },
      });
      created = true;
    }

    await appendEvent(
      {
        deliberationId: input.deliberationId,
        sessionId,
        eventType: MetaConsensusEventType.TAG_PROPOSED,
        actorId: input.authoredById,
        actorRole: input.authoredRole.toLowerCase(),
        payloadJson: {
          tagId: row.id,
          targetType: input.targetType,
          targetId: input.targetId,
          axisKey: input.axisKey,
          axisVersion,
          confidence: confidence.toString(),
          seedSource: input.seedSource,
          isUpsert: !created,
        },
        tagId: row.id,
      },
      tx,
    );

    return { tag: row, created };
  });

  return result;
}

export async function confirmTag(
  tagId: string,
  authoredById: string,
  opts: { confidence?: number } = {},
): Promise<PrismaDisagreementTag> {
  return prisma.$transaction(async (tx) => {
    const tag = await tx.disagreementTag.findUnique({ where: { id: tagId } });
    if (!tag) throw new TagServiceError("CONFLICT_TAG_NOT_FOUND", `tag not found: ${tagId}`);
    if (tag.retractedAt) {
      throw new TagServiceError("CONFLICT_TAG_RETRACTED", `tag already retracted: ${tagId}`);
    }

    const data: Prisma.DisagreementTagUpdateInput = {
      confirmedAt: tag.confirmedAt ?? new Date(),
      confirmedById: tag.confirmedById ?? authoredById,
    };
    if (opts.confidence !== undefined) {
      data.confidence = new Prisma.Decimal(opts.confidence.toFixed(3));
    }

    const updated = await tx.disagreementTag.update({ where: { id: tagId }, data });

    await appendEvent(
      {
        deliberationId: updated.deliberationId,
        sessionId: updated.sessionId,
        eventType: MetaConsensusEventType.TAG_CONFIRMED,
        actorId: authoredById,
        actorRole: "facilitator",
        payloadJson: {
          tagId: updated.id,
          confidence: updated.confidence.toString(),
        },
        tagId: updated.id,
      },
      tx,
    );

    return updated;
  });
}

export async function retractTag(
  tagId: string,
  authoredById: string,
  reasonText: string,
): Promise<PrismaDisagreementTag> {
  return prisma.$transaction(async (tx) => {
    const tag = await tx.disagreementTag.findUnique({ where: { id: tagId } });
    if (!tag) throw new TagServiceError("CONFLICT_TAG_NOT_FOUND", `tag not found: ${tagId}`);
    if (tag.retractedAt) {
      throw new TagServiceError("CONFLICT_TAG_RETRACTED", `tag already retracted: ${tagId}`);
    }

    const now = new Date();
    const updated = await tx.disagreementTag.update({
      where: { id: tagId },
      data: {
        retractedAt: now,
        retractedById: authoredById,
        retractedReasonText: reasonText,
      },
    });

    await appendEvent(
      {
        deliberationId: updated.deliberationId,
        sessionId: updated.sessionId,
        eventType: MetaConsensusEventType.TAG_RETRACTED,
        actorId: authoredById,
        actorRole: "facilitator",
        payloadJson: {
          tagId: updated.id,
          reasonText,
        },
        tagId: updated.id,
      },
      tx,
    );

    return updated;
  });
}

export interface ListTagsOptions {
  sessionId?: string | null;
  targetType?: DisagreementTagTargetType;
  targetId?: string;
  axisId?: string;
  includeRetracted?: boolean;
  limit?: number;
  cursor?: string;
}

export async function listTags(
  deliberationId: string,
  opts: ListTagsOptions = {},
): Promise<PrismaDisagreementTag[]> {
  const { limit = 100, cursor } = opts;
  return prisma.disagreementTag.findMany({
    where: {
      deliberationId,
      ...(opts.sessionId !== undefined ? { sessionId: opts.sessionId } : {}),
      ...(opts.targetType ? { targetType: opts.targetType } : {}),
      ...(opts.targetId ? { targetId: opts.targetId } : {}),
      ...(opts.axisId ? { axisId: opts.axisId } : {}),
      ...(opts.includeRetracted ? {} : { retractedAt: null }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

export async function getTag(tagId: string): Promise<PrismaDisagreementTag | null> {
  return prisma.disagreementTag.findUnique({ where: { id: tagId } });
}
