/**
 * Pathways — Submission service
 *
 * Records the act of sending a finalized packet to an institution and the
 * institution's acknowledgment. Emits `SUBMITTED` and `ACKNOWLEDGED` events.
 *
 * Status: A1 scaffold.
 */

import { prisma } from "@/lib/prismaclient";
import type { InstitutionalSubmission } from "@prisma/client";
import { appendEvent } from "./pathwayEventService";
import { markAwaitingResponse } from "./pathwayService";
import {
  PathwayEventType,
  SubmissionChannel,
  type AuthId,
} from "./types";

export interface SubmitPacketInput {
  packetId: string;
  institutionId: string;
  submittedById: AuthId;
  channel?: SubmissionChannel;
  externalReference?: string | null;
}

export async function submitPacket(
  input: SubmitPacketInput,
): Promise<InstitutionalSubmission> {
  return prisma.$transaction(async (tx) => {
    const packet = await tx.recommendationPacket.findUnique({
      where: { id: input.packetId },
      select: { id: true, pathwayId: true, status: true },
    });
    if (!packet) throw new Error(`Packet ${input.packetId} not found`);
    if (packet.status !== "SUBMITTED") {
      throw new Error(
        `Packet must be in SUBMITTED status to submit to institution; got ${packet.status}`,
      );
    }

    const submission = await tx.institutionalSubmission.create({
      data: {
        packetId: input.packetId,
        institutionId: input.institutionId,
        submittedById: input.submittedById,
        channel: input.channel ?? SubmissionChannel.in_platform,
        externalReference: input.externalReference ?? null,
      },
    });

    await appendEvent(
      {
        pathwayId: packet.pathwayId,
        packetId: input.packetId,
        submissionId: submission.id,
        eventType: PathwayEventType.SUBMITTED,
        actorId: input.submittedById,
        payloadJson: {
          institutionId: input.institutionId,
          channel: submission.channel,
          externalReference: submission.externalReference,
        },
      },
      tx,
    );

    await markAwaitingResponse(packet.pathwayId, tx);

    return submission;
  });
}

export interface AcknowledgeSubmissionInput {
  submissionId: string;
  acknowledgedById: AuthId;
}

export async function acknowledgeSubmission(
  input: AcknowledgeSubmissionInput,
): Promise<InstitutionalSubmission> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.institutionalSubmission.findUnique({
      where: { id: input.submissionId },
      select: { packetId: true, acknowledgedAt: true, packet: { select: { pathwayId: true } } },
    });
    if (!existing) throw new Error(`Submission ${input.submissionId} not found`);
    if (existing.acknowledgedAt) {
      throw new Error(`Submission ${input.submissionId} already acknowledged`);
    }

    const updated = await tx.institutionalSubmission.update({
      where: { id: input.submissionId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedById: input.acknowledgedById,
      },
    });

    await appendEvent(
      {
        pathwayId: existing.packet.pathwayId,
        packetId: existing.packetId,
        submissionId: input.submissionId,
        eventType: PathwayEventType.ACKNOWLEDGED,
        actorId: input.acknowledgedById,
        payloadJson: {},
      },
      tx,
    );

    return updated;
  });
}

export async function getSubmission(
  id: string,
): Promise<InstitutionalSubmission | null> {
  return prisma.institutionalSubmission.findUnique({ where: { id } });
}

export async function listSubmissionsForPacket(
  packetId: string,
): Promise<InstitutionalSubmission[]> {
  return prisma.institutionalSubmission.findMany({
    where: { packetId },
    orderBy: { submittedAt: "desc" },
  });
}
