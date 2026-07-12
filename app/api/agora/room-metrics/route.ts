import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Query = z.object({
  roomId: z.string(),
});

/**
 * GET /api/agora/room-metrics?roomId=...
 * 
 * Returns room-level metrics for Plexus hover cards:
 * - schemes: Top 5 argument schemes used + counts
 * - cqStatus: Open/answered/total CQs
 * - conflictDensity: Average conflicts per argument
 * - dialogueActivity: Dialogue moves by type (counts)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const parsed = Query.safeParse({
    roomId: searchParams.get("roomId"),
  });
  
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  
  const { roomId } = parsed.data;
  
  try {
    // 1. Fetch top schemes used in this deliberation
    const args = await prisma.argument.findMany({
      where: { deliberationId: roomId },
      select: {
        id: true,
        schemeId: true,
        scheme: {
          select: { key: true, name: true },
        },
      },
    });
    
    const schemeMap = new Map<string, { key: string; name: string; count: number }>();
    args.forEach((arg) => {
      if (arg.scheme) {
        const existing = schemeMap.get(arg.scheme.key);
        if (existing) {
          existing.count++;
        } else {
          schemeMap.set(arg.scheme.key, {
            key: arg.scheme.key,
            name: arg.scheme.name ?? arg.scheme.key,
            count: 1,
          });
        }
      }
    });
    
    const topSchemes = Array.from(schemeMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // 2. Fetch CQ status
    const cqStatuses = await prisma.cQStatus.findMany({
      where: {
        roomId: roomId,
      },
      select: {
        id: true,
        satisfied: true,
        cqKey: true,
      },
    });
    
    const cqKeys = new Set<string>();
    let answeredCount = 0;
    cqStatuses.forEach((cq) => {
      cqKeys.add(cq.cqKey);
      if (cq.satisfied) answeredCount++;
    });
    
    const cqStatus = {
      total: cqStatuses.length,
      answered: answeredCount,
      open: cqStatuses.length - answeredCount,
      keys: Array.from(cqKeys),
    };
    
    // 3. Fetch conflict density (CA-nodes)
    let conflictCount = 0;
    try {
      conflictCount = await (prisma as any).conflictApplication.count({
        where: { deliberationId: roomId },
      });
    } catch (e) {
      console.warn("[room-metrics] ConflictApplication query failed:", e);
    }
    
    const argumentCount = args.length;
    const conflictDensity = argumentCount > 0 ? conflictCount / argumentCount : 0;
    
    // 4. Fetch dialogue activity
    const dialogueMoves = await prisma.dialogueMove.findMany({
      where: {
        deliberationId: roomId,
      },
      select: {
        kind: true,
      },
    });
    
    const dialogueActivity: Record<string, number> = {};
    dialogueMoves.forEach((move) => {
      const type = move.kind || "unknown";
      dialogueActivity[type] = (dialogueActivity[type] || 0) + 1;
    });
    
    // 5. Return response
    return NextResponse.json({
      ok: true,
      roomId,
      metrics: {
        schemes: topSchemes,
        cqStatus,
        conflictDensity: Math.round(conflictDensity * 100) / 100, // 2 decimal places
        dialogueActivity,
        argumentCount,
        conflictCount,
      },
    });
  } catch (error) {
    console.error("[room-metrics] Error:", error);
    return NextResponse.json({
      ok: false,
      error: "Failed to fetch room metrics",
    }, { status: 500 });
  }
}
