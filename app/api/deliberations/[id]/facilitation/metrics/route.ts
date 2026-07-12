export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  requireAuth,
  zodError,
} from "@/lib/facilitation/apiHelpers";
import { CurrentMetricsQuerySchema } from "@/lib/facilitation/schemas";
import { EquityMetricKind, FacilitationSessionStatus } from "@/lib/facilitation/types";
import { canManageFacilitation } from "@/lib/facilitation/auth";
import { METRIC_REGISTRY } from "@/lib/facilitation/metrics";

/**
 * GET /api/deliberations/[id]/facilitation/metrics?window=current|final
 *
 * Returns the latest snapshot per metric kind for the deliberation's
 * currently-OPEN session (window=current, default) or for the most
 * recently closed session's `isFinal=true` set (window=final).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = CurrentMetricsQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) return zodError(parsed.error);

  // Read access: any deliberation role suffices (facilitator/host/observer/contributor).
  const role = await prisma.deliberationRole.findFirst({
    where: { deliberationId: params.id, userId: auth.userId },
    select: { id: true },
  });
  const isManager = await canManageFacilitation(auth.userId, params.id);
  if (!role && !isManager) {
    return apiError("FORBIDDEN", "Deliberation role required to view metrics");
  }

  const window = parsed.data.window ?? "current";

  try {
    const targetSession =
      window === "final"
        ? await prisma.facilitationSession.findFirst({
            where: { deliberationId: params.id, status: { not: FacilitationSessionStatus.OPEN } },
            orderBy: { closedAt: "desc" },
            select: { id: true, status: true, closedAt: true },
          })
        : await prisma.facilitationSession.findFirst({
            where: { deliberationId: params.id, status: FacilitationSessionStatus.OPEN },
            orderBy: { openedAt: "desc" },
            select: { id: true, status: true, openedAt: true },
          });
    if (!targetSession) {
      return NextResponse.json({
        deliberationId: params.id,
        window,
        sessionId: null,
        snapshots: [],
      });
    }

    const snapshots = await Promise.all(
      METRIC_REGISTRY.map(async (calc) => {
        const row = await prisma.equityMetricSnapshot.findFirst({
          where: {
            sessionId: targetSession.id,
            metricKind: calc.kind,
            ...(window === "final" ? { isFinal: true } : {}),
          },
          orderBy: { windowEnd: "desc" },
        });
        if (!row) return null;
        return {
          id: row.id,
          metricKind: row.metricKind as EquityMetricKind,
          metricVersion: row.metricVersion,
          value: Number(row.value as unknown as string),
          breakdownJson: row.breakdownJson,
          windowStart: row.windowStart,
          windowEnd: row.windowEnd,
          isFinal: row.isFinal,
        };
      }),
    );

    return NextResponse.json({
      deliberationId: params.id,
      window,
      sessionId: targetSession.id,
      snapshots: snapshots.filter((s) => s != null),
    });
  } catch (err) {
    return mapServiceError(err);
  }
}
