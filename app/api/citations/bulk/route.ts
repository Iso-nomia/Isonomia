export const dynamic = "force-dynamic";

// app/api/citations/bulk/route.ts
// Phase 2.4: Bulk operations API for citations

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { emitBus } from "@/lib/server/bus";
import { triggerBulkAggregation } from "@/lib/triggers/citationTriggers";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, citationIds, data } = body;

  if (!action || !citationIds || !Array.isArray(citationIds) || citationIds.length === 0) {
    return NextResponse.json(
      { error: "action and citationIds[] required" },
      { status: 400 }
    );
  }

  // Limit bulk operations to reasonable size
  if (citationIds.length > 100) {
    return NextResponse.json(
      { error: "Maximum 100 citations per bulk operation" },
      { status: 400 }
    );
  }

  try {
    // Verify ownership of all citations
    const citations = await prisma.citation.findMany({
      where: { id: { in: citationIds } },
      select: { id: true, createdById: true, targetType: true, targetId: true, sourceId: true },
    });

    const ownedIds = citations
      .filter((c) => c.createdById === String(userId))
      .map((c) => c.id);

    if (ownedIds.length === 0) {
      return NextResponse.json(
        { error: "No citations found that you can modify" },
        { status: 404 }
      );
    }

    // Get unique targets for bus events
    const targets = new Set(
      citations.map((c) => `${c.targetType}:${c.targetId}`)
    );

    // Phase 3.3: Get unique source IDs for aggregation
    const sourceIds = [...new Set(citations.map((c) => c.sourceId))];

    switch (action) {
      case "delete": {
        const result = await prisma.citation.deleteMany({
          where: { id: { in: ownedIds } },
        });

        // Emit bus events for each affected target
        for (const target of targets) {
          const [targetType, targetId] = target.split(":");
          emitBus("citations:changed", { action: "bulk-deleted", targetType, targetId });
        }

        // Phase 3.3: Trigger bulk aggregation for affected sources
        triggerBulkAggregation(sourceIds);

        return NextResponse.json({
          ok: true,
          deleted: result.count,
          skipped: citationIds.length - ownedIds.length,
        });
      }

      case "updateIntent": {
        const intent = data?.intent;
        // Allow null to clear intent
        if (intent === undefined) {
          return NextResponse.json(
            { error: "data.intent required (can be null to clear)" },
            { status: 400 }
          );
        }

        const validIntents = [
          "supports", "refutes", "context", "defines",
          "method", "background", "acknowledges", "example",
          null,
        ];
        if (!validIntents.includes(intent)) {
          return NextResponse.json(
            { error: `Invalid intent: ${intent}` },
            { status: 400 }
          );
        }

        const result = await prisma.citation.updateMany({
          where: { id: { in: ownedIds } },
          data: { intent },
        });

        // Emit bus events
        for (const target of targets) {
          const [targetType, targetId] = target.split(":");
          emitBus("citations:changed", { action: "bulk-updated", targetType, targetId });
        }

        return NextResponse.json({
          ok: true,
          updated: result.count,
          intent,
          skipped: citationIds.length - ownedIds.length,
        });
      }

      case "updateRelevance": {
        const relevance = data?.relevance;
        if (typeof relevance !== "number" || relevance < 1 || relevance > 5) {
          return NextResponse.json(
            { error: "data.relevance must be 1-5" },
            { status: 400 }
          );
        }

        const result = await prisma.citation.updateMany({
          where: { id: { in: ownedIds } },
          data: { relevance },
        });

        // Emit bus events
        for (const target of targets) {
          const [targetType, targetId] = target.split(":");
          emitBus("citations:changed", { action: "bulk-updated", targetType, targetId });
        }

        return NextResponse.json({
          ok: true,
          updated: result.count,
          relevance,
          skipped: citationIds.length - ownedIds.length,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: delete, updateIntent, updateRelevance` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Bulk citation operation failed:", error);
    return NextResponse.json(
      { error: error.message || "Bulk operation failed" },
      { status: 500 }
    );
  }
}
