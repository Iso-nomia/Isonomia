export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { syncToAif, syncBatchToAif, LudicsActionType } from "packages/ludics-engine/aif-sync";
import { Prisma } from "@prisma/client";

const zSyncRequest = z.object({
  deliberationId: z.string(),
  mode: z.enum(["single", "backfill", "verify", "status"]).default("single"),
  // For single mode
  actionType: z.enum(["CONCESSION", "FORCE_CONCESSION", "BRANCH_CLOSE", "DAIMON", "ACK"]).optional(),
  actorId: z.string().optional(),
  locusPath: z.string().optional(),
  expression: z.string().optional(),
  ludicActId: z.string().optional(),
  ludicDesignId: z.string().optional(),
  // For backfill mode
  syncAllActs: z.boolean().optional().default(false), // If true, sync ALL acts; if false, only significant ones
});

/**
 * Determine if a ludics act should be synced to DialogueMove
 * 
 * We should ONLY sync:
 * 1. DAIMON acts (game termination)
 * 2. Force concession acts (judge intervention)
 * 3. Explicit concession acts (ACK with concession semantics)
 * 
 * Regular P/O interaction acts are part of the ludics game, not dialogue moves.
 */
function shouldSyncAct(act: {
  kind: string;
  polarity: string | null;
  expression: string | null;
}): { shouldSync: boolean; actionType: LudicsActionType; reason: string } {
  // Always sync DAIMON acts
  if (act.kind === "DAIMON") {
    if (act.expression?.includes("BRANCH_CLOSED")) {
      return { shouldSync: true, actionType: "BRANCH_CLOSE", reason: "Branch closure daimon" };
    }
    if (act.expression?.includes("fail") || act.expression?.includes("FORCED")) {
      return { shouldSync: true, actionType: "FORCE_CONCESSION", reason: "Forced termination" };
    }
    return { shouldSync: true, actionType: "DAIMON", reason: "Game termination daimon" };
  }

  // Sync explicit concession acts
  const expr = act.expression?.toLowerCase() ?? "";
  if (expr.includes("concede") || expr.includes("forced") || expr === "ack") {
    return { shouldSync: true, actionType: "CONCESSION", reason: "Explicit concession" };
  }

  // Don't sync regular P/O interaction acts
  return { shouldSync: false, actionType: "ACK", reason: "Regular interaction act" };
}

/**
 * POST /api/ludics/aif-sync
 * 
 * Sync ludics actions to AIF/DialogueMove system
 * 
 * Modes:
 * - single: Sync a single action
 * - backfill: Sync significant ludics acts (daimons, concessions) that don't have DialogueMoves
 * - verify: Check sync status without making changes
 * - status: Get detailed sync statistics
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = zSyncRequest.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", issues: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { deliberationId, mode, actionType, actorId, locusPath, expression, ludicActId, ludicDesignId, syncAllActs } = parsed.data;

    if (mode === "single") {
      if (!actionType || !actorId || !locusPath) {
        return NextResponse.json(
          { ok: false, error: { code: "BAD_REQUEST", message: "Single mode requires actionType, actorId, and locusPath" } },
          { status: 400 }
        );
      }

      const result = await syncToAif({
        deliberationId,
        actionType: actionType as LudicsActionType,
        actorId,
        locusPath,
        expression,
        ludicActId,
        ludicDesignId,
      });

      return NextResponse.json({ ok: true, result });
    }

    // Get designs for this deliberation
    const designs = await prisma.ludicDesign.findMany({
      where: { deliberationId },
      select: { id: true, participantId: true },
    });

    if (designs.length === 0) {
      return NextResponse.json({ ok: true, message: "No designs found", stats: { total: 0, synced: 0, pending: 0 } });
    }

    // Get all ludic acts
    const allActs = await prisma.ludicAct.findMany({
      where: { designId: { in: designs.map(d => d.id) } },
      include: {
        locus: { select: { path: true } },
        design: { select: { participantId: true } },
      },
      orderBy: { orderInDesign: "asc" },
    });

    // Get already synced act IDs
    const syncedActIds = await prisma.aifNode.findMany({
      where: {
        deliberationId,
        ludicActId: { not: null },
      },
      select: { ludicActId: true },
    });
    const syncedSet = new Set(syncedActIds.map(n => n.ludicActId));

    // Analyze acts
    const analysis = allActs.map(act => {
      const syncDecision = shouldSyncAct(act);
      return {
        actId: act.id,
        kind: act.kind,
        polarity: act.polarity,
        expression: act.expression,
        locusPath: act.locus?.path ?? "0",
        designId: act.designId,
        participantId: act.design?.participantId,
        alreadySynced: syncedSet.has(act.id),
        ...syncDecision,
      };
    });

    // Status/Verify mode - return analysis without syncing
    if (mode === "status" || mode === "verify") {
      const stats = {
        totalActs: allActs.length,
        alreadySynced: analysis.filter(a => a.alreadySynced).length,
        shouldSync: analysis.filter(a => a.shouldSync && !a.alreadySynced).length,
        skipped: analysis.filter(a => !a.shouldSync).length,
        byActionType: {
          DAIMON: analysis.filter(a => a.actionType === "DAIMON").length,
          BRANCH_CLOSE: analysis.filter(a => a.actionType === "BRANCH_CLOSE").length,
          FORCE_CONCESSION: analysis.filter(a => a.actionType === "FORCE_CONCESSION").length,
          CONCESSION: analysis.filter(a => a.actionType === "CONCESSION").length,
          ACK: analysis.filter(a => a.actionType === "ACK").length,
        },
        breakdown: analysis.slice(0, 20), // First 20 for debugging
      };

      return NextResponse.json({ ok: true, mode, stats });
    }

    // Backfill mode - sync pending acts
    if (mode === "backfill") {
      const toSync = analysis.filter(a => {
        if (a.alreadySynced) return false;
        if (syncAllActs) return true;
        return a.shouldSync;
      });

      if (toSync.length === 0) {
        return NextResponse.json({
          ok: true,
          message: "No acts need syncing",
          stats: {
            totalActs: allActs.length,
            alreadySynced: analysis.filter(a => a.alreadySynced).length,
            synced: 0,
            skipped: analysis.filter(a => !a.shouldSync).length,
          },
        });
      }

      // Batch sync with progress tracking
      const batchSize = 10;
      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < toSync.length; i += batchSize) {
        const batch = toSync.slice(i, i + batchSize);
        
        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(act =>
            syncToAif({
              deliberationId,
              actionType: act.actionType,
              actorId: act.participantId ?? (act.polarity === "P" ? "Proponent" : "Opponent"),
              locusPath: act.locusPath,
              expression: act.expression ?? undefined,
              ludicActId: act.actId,
              ludicDesignId: act.designId,
            })
          )
        );

        for (const result of results) {
          if (result.status === "fulfilled" && result.value.dialogueMoveId) {
            synced++;
          } else {
            failed++;
            if (result.status === "rejected") {
              errors.push(result.reason?.message ?? "Unknown error");
            }
          }
        }
      }

      return NextResponse.json({
        ok: true,
        message: `Backfill complete`,
        stats: {
          totalActs: allActs.length,
          alreadySynced: analysis.filter(a => a.alreadySynced).length,
          synced,
          failed,
          skipped: analysis.filter(a => !a.shouldSync && !syncAllActs).length,
        },
        errors: errors.slice(0, 5), // First 5 errors
      });
    }

    return NextResponse.json(
      { ok: false, error: { code: "UNSUPPORTED_MODE", message: `Unknown mode: ${mode}` } },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[aif-sync route] Error:", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: err?.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ludics/aif-sync?deliberationId=...
 * 
 * Get sync status for a deliberation
 */
export async function GET(req: NextRequest) {
  try {
    const deliberationId = req.nextUrl.searchParams.get("deliberationId");
    
    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing deliberationId" } },
        { status: 400 }
      );
    }

    // Count total ludic acts
    const designs = await prisma.ludicDesign.findMany({
      where: { deliberationId },
      select: { id: true },
    });
    
    const totalActs = await prisma.ludicAct.count({
      where: { designId: { in: designs.map(d => d.id) } },
    });

    // Count significant acts by type
    const daimonCount = await prisma.ludicAct.count({
      where: {
        designId: { in: designs.map(d => d.id) },
        kind: "DAIMON",
      },
    });

    // Count acts with explicit concession expressions
    const concessionCount = await prisma.ludicAct.count({
      where: {
        designId: { in: designs.map(d => d.id) },
        kind: "PROPER",
        OR: [
          { expression: { contains: "concede", mode: "insensitive" } },
          { expression: { contains: "forced", mode: "insensitive" } },
          { expression: { equals: "ACK" } },
        ],
      },
    });

    const significantActs = daimonCount + concessionCount;

    // Count synced significant acts (AIF nodes linked to daimons or concession acts)
    const allActs = await prisma.ludicAct.findMany({
      where: { designId: { in: designs.map(d => d.id) } },
      select: { id: true, kind: true, expression: true },
    });
    
    const significantActIds = allActs
      .filter(act => {
        if (act.kind === "DAIMON") return true;
        const expr = act.expression?.toLowerCase() ?? "";
        return expr.includes("concede") || expr.includes("forced") || act.expression === "ACK";
      })
      .map(act => act.id);

    const syncedSignificantCount = await prisma.aifNode.count({
      where: {
        deliberationId,
        ludicActId: { in: significantActIds },
      },
    });

    // Total synced (for info)
    const totalSyncedCount = await prisma.aifNode.count({
      where: {
        deliberationId,
        ludicActId: { not: null },
      },
    });

    // Count DialogueMoves with ludics payload
    const dialogueMoves = await prisma.dialogueMove.count({
      where: {
        deliberationId,
        payload: {
          path: ["ludicsAction"],
          not: Prisma.DbNull,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      deliberationId,
      stats: {
        totalLudicActs: totalActs,
        significantActs,
        daimonActs: daimonCount,
        concessionActs: concessionCount,
        regularActs: totalActs - significantActs,
        syncedSignificant: syncedSignificantCount,
        totalSynced: totalSyncedCount,
        dialogueMovesWithLudics: dialogueMoves,
        syncPercentage: significantActs > 0 ? Math.round((syncedSignificantCount / significantActs) * 100) : 100,
        needsSync: significantActs - syncedSignificantCount,
      },
    });
  } catch (err: any) {
    console.error("[aif-sync route GET] Error:", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: err?.message ?? "Unknown error" } },
      { status: 500 }
    );
  }
}
