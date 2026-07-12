/**
 * Pathways — Response service
 *
 * Records institutional responses (per-item dispositions + summary) to a
 * submission. Emits `RESPONSE_RECEIVED` and per-item `ITEM_DISPOSITIONED`
 * events.
 *
 * Status: A1 scaffold.
 */

import { prisma } from "@/lib/prismaclient";
import type {
  InstitutionalResponse,
  InstitutionalResponseItem,
  Prisma,
} from "@prisma/client";
import { appendEvent } from "./pathwayEventService";
import {
  InstitutionalDisposition,
  InstitutionalResponseStatus,
  PathwayEventType,
  type AuthId,
} from "./types";

export interface RecordResponseItemInput {
  packetItemId?: string | null;
  targetType: string;
  targetId: string;
  disposition: InstitutionalDisposition;
  rationaleText?: string | null;
  evidenceCitations?: Array<{ uri: string; title?: string }> | null;
}

export interface RecordResponseInput {
  submissionId: string;
  respondedById: AuthId;
  dispositionSummary?: string | null;
  responseStatus?: InstitutionalResponseStatus;
  items: RecordResponseItemInput[];
}

export interface RecordResponseResult {
  response: InstitutionalResponse;
  items: InstitutionalResponseItem[];
}

export async function recordResponse(
  input: RecordResponseInput,
): Promise<RecordResponseResult> {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.institutionalSubmission.findUnique({
      where: { id: input.submissionId },
      select: {
        packetId: true,
        packet: { select: { pathwayId: true } },
      },
    });
    if (!submission) {
      throw new Error(`Submission ${input.submissionId} not found`);
    }

    const response = await tx.institutionalResponse.create({
      data: {
        submissionId: input.submissionId,
        respondedById: input.respondedById,
        dispositionSummary: input.dispositionSummary ?? null,
        responseStatus:
          input.responseStatus ?? InstitutionalResponseStatus.RECEIVED,
      },
    });

    const items: InstitutionalResponseItem[] = [];
    for (const it of input.items) {
      const row = await tx.institutionalResponseItem.create({
        data: {
          responseId: response.id,
          packetItemId: it.packetItemId ?? null,
          targetType: it.targetType,
          targetId: it.targetId,
          disposition: it.disposition,
          rationaleText: it.rationaleText ?? null,
          evidenceCitations:
            (it.evidenceCitations ?? undefined) as Prisma.InputJsonValue | undefined,
          createdById: input.respondedById,
        },
      });
      items.push(row);
    }

    await appendEvent(
      {
        pathwayId: submission.packet.pathwayId,
        packetId: submission.packetId,
        submissionId: input.submissionId,
        responseId: response.id,
        eventType: PathwayEventType.RESPONSE_RECEIVED,
        actorId: input.respondedById,
        payloadJson: {
          itemCount: items.length,
          responseStatus: response.responseStatus,
        },
      },
      tx,
    );

    for (const row of items) {
      await appendEvent(
        {
          pathwayId: submission.packet.pathwayId,
          packetId: submission.packetId,
          submissionId: input.submissionId,
          responseId: response.id,
          eventType: PathwayEventType.ITEM_DISPOSITIONED,
          actorId: input.respondedById,
          payloadJson: {
            responseItemId: row.id,
            packetItemId: row.packetItemId,
            targetType: row.targetType,
            targetId: row.targetId,
            disposition: row.disposition,
          },
        },
        tx,
      );
    }

    return { response, items };
  });
}

export async function getResponse(
  id: string,
): Promise<InstitutionalResponse | null> {
  return prisma.institutionalResponse.findUnique({ where: { id } });
}

export async function listResponseItems(
  responseId: string,
): Promise<InstitutionalResponseItem[]> {
  return prisma.institutionalResponseItem.findMany({
    where: { responseId },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateResponseStatus(
  responseId: string,
  status: InstitutionalResponseStatus,
): Promise<InstitutionalResponse> {
  return prisma.institutionalResponse.update({
    where: { id: responseId },
    data: { responseStatus: status },
  });
}
