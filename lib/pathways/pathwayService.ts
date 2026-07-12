/**
 * Pathways — Pathway service
 *
 * Lifecycle management for `InstitutionalPathway` records.
 *
 * Status: A1 scaffold.
 */

import { prisma } from "@/lib/prismaclient";
import type { InstitutionalPathway, Prisma } from "@prisma/client";
import { appendEvent } from "./pathwayEventService";
import { PathwayEventType, PathwayStatus, type AuthId } from "./types";

export interface OpenPathwayInput {
  deliberationId: string;
  institutionId: string;
  subject: string;
  openedById: AuthId;
  isPublic?: boolean;
}

export async function openPathway(
  input: OpenPathwayInput,
): Promise<InstitutionalPathway> {
  return prisma.$transaction(async (tx) => {
    const pathway = await tx.institutionalPathway.create({
      data: {
        deliberationId: input.deliberationId,
        institutionId: input.institutionId,
        subject: input.subject,
        openedById: input.openedById,
        status: PathwayStatus.OPEN,
        isPublic: input.isPublic ?? false,
      },
    });

    await appendEvent(
      {
        pathwayId: pathway.id,
        eventType: PathwayEventType.DRAFT_OPENED,
        actorId: input.openedById,
        payloadJson: {
          deliberationId: input.deliberationId,
          institutionId: input.institutionId,
          subject: input.subject,
          isPublic: pathway.isPublic,
        },
      },
      tx,
    );

    return pathway;
  });
}

export async function getPathway(id: string): Promise<InstitutionalPathway | null> {
  return prisma.institutionalPathway.findUnique({ where: { id } });
}

export interface ListPathwaysFilter {
  deliberationId?: string;
  institutionId?: string;
  status?: PathwayStatus;
  limit?: number;
}

export async function listPathways(
  filter: ListPathwaysFilter = {},
): Promise<InstitutionalPathway[]> {
  const where: Prisma.InstitutionalPathwayWhereInput = {};
  if (filter.deliberationId) where.deliberationId = filter.deliberationId;
  if (filter.institutionId) where.institutionId = filter.institutionId;
  if (filter.status) where.status = filter.status;

  return prisma.institutionalPathway.findMany({
    where,
    orderBy: { openedAt: "desc" },
    take: filter.limit ?? 50,
  });
}

export async function markAwaitingResponse(
  pathwayId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;
  await client.institutionalPathway.update({
    where: { id: pathwayId },
    data: { status: PathwayStatus.AWAITING_RESPONSE },
  });
}

export async function markInRevision(
  pathwayId: string,
  actorId: AuthId,
  reason?: string,
): Promise<InstitutionalPathway> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.institutionalPathway.update({
      where: { id: pathwayId },
      data: { status: PathwayStatus.IN_REVISION },
    });
    await appendEvent(
      {
        pathwayId,
        eventType: PathwayEventType.REVISED,
        actorId,
        payloadJson: reason ? { reason } : {},
      },
      tx,
    );
    return updated;
  });
}

export async function closePathway(
  pathwayId: string,
  actorId: AuthId,
  reason?: string,
): Promise<InstitutionalPathway> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.institutionalPathway.findUnique({
      where: { id: pathwayId },
      select: { status: true },
    });
    if (!existing) throw new Error(`Pathway ${pathwayId} not found`);
    if (existing.status === PathwayStatus.CLOSED) {
      throw new Error(`Pathway ${pathwayId} already closed`);
    }

    const updated = await tx.institutionalPathway.update({
      where: { id: pathwayId },
      data: { status: PathwayStatus.CLOSED, closedAt: new Date() },
    });

    await appendEvent(
      {
        pathwayId,
        eventType: PathwayEventType.CLOSED,
        actorId,
        payloadJson: reason ? { reason } : {},
      },
      tx,
    );

    return updated;
  });
}
