export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";
import { AddResponseItemsSchema } from "@/lib/pathways/schemas";
import { appendEvent } from "@/lib/pathways/pathwayEventService";
import { PathwayEventType } from "@/lib/pathways/types";
import { canActAsInstitution, loadResponseContext } from "@/lib/pathways/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = AddResponseItemsSchema.safeParse(await parseJson(req));
  if (!parsed.success) return zodError(parsed.error);

  const respCtx = await loadResponseContext(params.id);
  if (!respCtx) return apiError("NOT_FOUND", "Response not found");
  const isAuthor = respCtx.respondedById === auth.userId;
  const allowed =
    isAuthor ||
    (await canActAsInstitution(
      respCtx.submission.institutionId,
      respCtx.submission.packet.pathway.deliberationId,
      auth.userId,
    ));
  if (!allowed) {
    return apiError(
      "FORBIDDEN",
      "Response author, verified institution member, or facilitator required",
    );
  }

  try {
    const response = await prisma.institutionalResponse.findUnique({
      where: { id: params.id },
      include: {
        submission: {
          select: {
            id: true,
            packetId: true,
            packet: { select: { pathwayId: true } },
          },
        },
      },
    });
    if (!response) return apiError("NOT_FOUND", "Response not found");

    const pathwayId = response.submission.packet.pathwayId;

    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const it of parsed.data.items) {
        let targetType = it.targetType;
        let targetId = it.targetId;

        if ((!targetType || !targetId) && it.packetItemId) {
          const packetItem = await tx.recommendationPacketItem.findUnique({
            where: { id: it.packetItemId },
            select: { targetType: true, targetId: true },
          });
          if (!packetItem) {
            throw new Error(`packetItem ${it.packetItemId} not found`);
          }
          targetType = targetType ?? packetItem.targetType;
          targetId = targetId ?? packetItem.targetId;
        }

        if (!targetType || !targetId) {
          throw new Error("targetType and targetId required when packetItemId is absent");
        }

        const row = await tx.institutionalResponseItem.create({
          data: {
            responseId: response.id,
            packetItemId: it.packetItemId ?? null,
            targetType,
            targetId,
            disposition: it.disposition,
            rationaleText: it.rationaleText ?? null,
            evidenceCitations: (it.evidenceCitations ?? null) as any,
            createdById: auth.userId,
          },
        });

        await appendEvent(
          {
            pathwayId,
            packetId: response.submission.packetId,
            submissionId: response.submission.id,
            responseId: response.id,
            eventType: PathwayEventType.ITEM_DISPOSITIONED,
            actorId: auth.userId,
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

        rows.push(row);
      }
      return rows;
    });

    return NextResponse.json({ items: created }, { status: 201 });
  } catch (err) {
    return mapServiceError(err);
  }
}
