export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";
import { ListEventsQuerySchema } from "@/lib/pathways/schemas";
import { verifyPathwayChain } from "@/lib/pathways/pathwayEventService";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const pathway = await prisma.institutionalPathway.findUnique({
      where: { id: params.id },
      select: { id: true, isPublic: true },
    });
    if (!pathway) return apiError("NOT_FOUND", "Pathway not found");

    let isAuthed = true;
    if (!pathway.isPublic) {
      const auth = await requireAuth();
      if (!auth.ok) return auth.response;
    } else {
      const auth = await requireAuth();
      isAuthed = auth.ok;
    }

    const url = new URL(req.url);
    const parsed = ListEventsQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!parsed.success) return zodError(parsed.error);

    const { cursor, limit = 50, eventType } = parsed.data;

    const events = await prisma.pathwayEvent.findMany({
      where: {
        pathwayId: params.id,
        ...(eventType ? { eventType: eventType as any } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | null = null;
    if (events.length > limit) {
      const next = events.pop()!;
      nextCursor = next.id;
    }

    // Verification status — included as a lightweight integrity signal. Full
    // chain verification for very long pathways should be moved off the hot
    // path (admin endpoint) post-pilot.
    const verification = await verifyPathwayChain(params.id);

    return NextResponse.json({
      items: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        actorId: isAuthed ? e.actorId : null,
        actorRole: e.actorRole,
        payload: e.payloadJson,
        hashChainPrev: e.hashChainPrev,
        hashChainSelf: e.hashChainSelf,
        createdAt: e.createdAt,
      })),
      nextCursor,
      hashChainValid: verification.valid,
      ...(verification.valid
        ? {}
        : { hashChainFailure: { index: verification.failedIndex, reason: verification.reason } }),
    });
  } catch (err) {
    return mapServiceError(err);
  }
}
