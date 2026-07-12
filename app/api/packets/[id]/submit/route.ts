export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";
import { SubmitPacketSchema } from "@/lib/pathways/schemas";
import { finalizePacket } from "@/lib/pathways/packetService";
import { submitPacket } from "@/lib/pathways/submissionService";
import { prisma } from "@/lib/prismaclient";
import { PacketItemKind } from "@/lib/pathways/types";
import { canSubmitPacket, loadPacketContext } from "@/lib/pathways/auth";

/**
 * Default content resolver. Looks up canonical text for Claim / Argument /
 * Citation / Source / Note targets. Callers can extend target types; unknown
 * targets snapshot with `{ unresolved: true }` so the chain remains intact.
 */
async function resolveContent(item: {
  kind: string;
  targetType: string;
  targetId: string;
}): Promise<Record<string, unknown>> {
  const { kind, targetType, targetId } = item;

  try {
    if (kind === PacketItemKind.CLAIM || targetType === "claim" || targetType === "Claim") {
      const claim = await prisma.claim.findUnique({ where: { id: targetId } });
      if (claim) {
        return {
          id: claim.id,
          text: claim.text,
          moid: claim.moid,
          deliberationId: claim.deliberationId,
        };
      }
    }
    if (kind === PacketItemKind.ARGUMENT || targetType === "argument" || targetType === "Argument") {
      const arg = await prisma.argument.findUnique({ where: { id: targetId } });
      if (arg) {
        return {
          id: arg.id,
          text: arg.text,
          claimId: arg.claimId,
          deliberationId: arg.deliberationId,
        };
      }
    }
    if (kind === PacketItemKind.CITATION || targetType === "citation" || targetType === "Citation") {
      const citation = await prisma.citation.findUnique({
        where: { id: targetId },
        include: { source: true },
      });
      if (citation) {
        return {
          id: citation.id,
          uri: citation.source?.url ?? null,
          quote: citation.quote,
          locator: citation.locator,
        };
      }
    }
  } catch {
    // Fall through to unresolved.
  }

  return { unresolved: true, kind, targetType, targetId };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = SubmitPacketSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  const ctx = await loadPacketContext(params.id);
  if (!ctx) return apiError("NOT_FOUND", "Packet not found");
  if (!(await canSubmitPacket(ctx.pathway.deliberationId, auth.userId))) {
    return apiError("FORBIDDEN", "Submitter, facilitator, or host role required");
  }

  try {
    const packetRow = await prisma.recommendationPacket.findUnique({
      where: { id: params.id },
      include: { pathway: { select: { id: true, institutionId: true } } },
    });
    if (!packetRow) return apiError("NOT_FOUND", "Packet not found");

    const { packet, packetSnapshotHash } = await finalizePacket({
      packetId: params.id,
      actorId: auth.userId,
      resolveContent,
    });

    const submission = await submitPacket({
      packetId: params.id,
      institutionId: packetRow.pathway.institutionId,
      submittedById: auth.userId,
      channel: parsed.data.channel,
      externalReference: parsed.data.externalReference ?? null,
    });

    return NextResponse.json({ packet, submission, packetSnapshotHash });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return apiError(
        "CONFLICT_DUPLICATE_SUBMISSION",
        "Packet already submitted to this institution",
      );
    }
    return mapServiceError(err);
  }
}
