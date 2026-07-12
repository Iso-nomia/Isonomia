export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  requireAuth,
  zodError,
} from "@/lib/facilitation/apiHelpers";
import { MetricHistoryQuerySchema } from "@/lib/facilitation/schemas";
import { FacilitationSessionStatus } from "@/lib/facilitation/types";
import { canManageFacilitation } from "@/lib/facilitation/auth";
import { getHistory } from "@/lib/facilitation/metricService";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = MetricHistoryQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) return zodError(parsed.error);

  const role = await prisma.deliberationRole.findFirst({
    where: { deliberationId: params.id, userId: auth.userId },
    select: { id: true },
  });
  const isManager = await canManageFacilitation(auth.userId, params.id);
  if (!role && !isManager) {
    return apiError("FORBIDDEN", "Deliberation role required to view metric history");
  }

  const session =
    (await prisma.facilitationSession.findFirst({
      where: { deliberationId: params.id, status: FacilitationSessionStatus.OPEN },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    })) ??
    (await prisma.facilitationSession.findFirst({
      where: { deliberationId: params.id },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    }));
  if (!session) {
    return NextResponse.json({
      deliberationId: params.id,
      metricKind: parsed.data.metricKind,
      sessionId: null,
      items: [],
    });
  }

  try {
    let items = await getHistory(session.id, parsed.data.metricKind, {
      limit: parsed.data.limit ?? 200,
    });
    if (parsed.data.since) {
      const since = new Date(parsed.data.since);
      items = items.filter((s) => s.windowEnd >= since);
    }
    if (parsed.data.until) {
      const until = new Date(parsed.data.until);
      items = items.filter((s) => s.windowEnd <= until);
    }
    return NextResponse.json({
      deliberationId: params.id,
      sessionId: session.id,
      metricKind: parsed.data.metricKind,
      items: items.map((s) => ({
        id: s.id,
        value: Number(s.value as unknown as string),
        breakdownJson: s.breakdownJson,
        windowStart: s.windowStart,
        windowEnd: s.windowEnd,
        isFinal: s.isFinal,
      })),
    });
  } catch (err) {
    return mapServiceError(err);
  }
}
