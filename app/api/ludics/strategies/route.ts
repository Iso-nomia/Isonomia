export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

/**
 * GET /api/ludics/strategies?deliberationId=xxx
 * Lists all strategies for a deliberation (through their designs)
 */
export async function GET(req: NextRequest) {
  const deliberationId = req.nextUrl.searchParams.get("deliberationId") || "";
  const designId = req.nextUrl.searchParams.get("designId") || "";
  
  if (!deliberationId && !designId) {
    return NextResponse.json({ ok: false, error: "missing deliberationId or designId" }, { status: 400 });
  }

  try {
    // Build where clause
    const where: any = {};
    
    if (designId) {
      where.designId = designId;
    } else if (deliberationId) {
      where.design = { deliberationId };
    }

    const strategies = await prisma.ludicStrategy.findMany({
      where,
      include: {
        design: {
          select: {
            id: true,
            participantId: true,
            scope: true,
            scopeType: true,
            acts: {
              select: { id: true, polarity: true, expression: true },
              take: 3,
              orderBy: { orderInDesign: "asc" }
            }
          }
        },
        innocenceCheck: true,
        propagationCheck: true,
        _count: {
          select: { plays: true, viewCache: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Format for UI consumption
    const formatted = strategies.map(s => ({
      id: s.id,
      designId: s.designId,
      player: s.player,
      isInnocent: s.isInnocent,
      satisfiesPropagation: s.satisfiesPropagation,
      playCount: s.playCount,
      viewCount: s._count.viewCache,
      design: s.design,
      innocenceCheck: s.innocenceCheck,
      propagationCheck: s.propagationCheck,
      createdAt: s.createdAt,
      label: `${s.player}-Strategy for ${s.design?.participantId || "design"} (${s.isInnocent ? "innocent" : "non-innocent"})`
    }));

    return NextResponse.json({ ok: true, strategies: formatted });
  } catch (error) {
    console.error("Error fetching strategies:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch strategies" }, { status: 500 });
  }
}
